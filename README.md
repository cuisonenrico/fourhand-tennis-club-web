# Fourhand Tennis Club — Booking Web App

A visually rich, fast court-booking experience: pick a court, pick a time, confirm — with an
instant confirmation email. Built per the product & technical specs in `docs/superpowers/specs/`.

**Stack:** Next.js 15 (App Router) · Supabase (Postgres + Auth + Realtime) · Resend · Tailwind v4 · Framer Motion · shadcn-style UI · zod.

## MVP scope (Phases 0–3b)

- **Landing page** — hero, court showcase, amenities, events teaser, about, contact + map, sticky CTA, motion.
- **Visual booking** — clickable court grid → live availability panel → guest checkout → animated confirmation. Concurrency-safe (Postgres row-lock + unique constraint + idempotency).
- **Transactional email** — booking confirmation (+`.ics`), staff notification, cancellation, contact ack. Queued via `email_log`.
- **Minimum admin** — secure Supabase Auth login + read-only, live booked-courts overview.

## Admin core modules (§10.2, Phase A)

The admin shell lives at `app/admin/(panel)/` (route group, auth-guarded layout). All writes go through `SECURITY DEFINER` RPCs or service-role queries; no public policies touch the new tables.

| Section | Route | What it does |
|---|---|---|
| **Dashboard** | `/admin` | Day summary strip — confirmed bookings, revenue, slot occupancy, next upcoming booking. Date control via URL param. |
| **Courts & Closures** | `/admin/courts` | CRUD for courts (name, surface, hours, status). Closure panel: preview impact → cancel affected bookings + notify guests → mark slots `closed`. Reopen lifts the closure and frees un-covered slots. Day schedule grid (court × hour). |
| **Bookings** | `/admin/bookings` | Search/filter by date, court, status, or name/email. Manual phone booking (admin_create_booking RPC, optional guest email). Cancel any booking. Reassign a booking group to equal-count free slots (re-prices). |
| **Email templates** | `/admin/templates` | Override subject + intro for confirmation, reminder, cancellation, closure-notice, and staff-notification emails. Stored in `email_templates` table; live emails merge the override with the React Email base template. |
| **Settings** | `/admin/settings` | Business settings singleton: club name, logo, accent colour, contact details, cancellation window, reminder offset. |
| **Reports** | `/admin/reports` | Per-day revenue + occupancy for a date range. CSV export via `GET /api/admin/export?start=YYYY-MM-DD&end=YYYY-MM-DD`. |

### Migration `0006_admin_core.sql`

Run `supabase db reset` (or apply the migration to an existing instance) to get:
- New columns on `bookings`: `source` (`'guest'|'admin'`), `reassigned_from_slot`, `reminded_at`.
- New `slot_status` value: `'closed'` (used by the closure system).
- New tables: `admin_audit`, `closures`, `email_templates`, `business_settings`.
- New RPCs (service-role only): `preview_closure_impact`, `close_court`, `reopen_closure`, `admin_create_booking`, `admin_reassign_booking`.
- Updated `generate_slots_for_range` — new slots inside an active closure are created as `'closed'`.

### Booking reminder cron (`send-reminders`)

`app/api/cron/send-reminders/route.ts` sends a reminder email to every confirmed guest whose slot starts within `reminder_offset_hours` (default 24 h, configurable in Settings). It marks each booking `reminded_at` so it is sent exactly once. Secured by `CRON_SECRET` bearer token.

Scheduled in `vercel.json`:

```jsonc
// vercel.json (extract)
{ "path": "/api/cron/send-reminders", "schedule": "0 1 * * *" }  // daily, 09:00 Asia/Manila
{ "path": "/api/cron/release-holds",   "schedule": "0 0 * * *" }  // daily cosmetic cleanup
```

Vercel Hobby allows only **one run per day per cron**, so both jobs use daily schedules. With a daily reminder run, keep `reminder_offset_hours` at **≥ 24** (the default) so every booking is caught by the next run — a shorter window would miss bookings created between runs. For finer cadence (e.g. hourly reminders, frequent hold cleanup), upgrade to Pro, or apply `supabase/optional_pg_cron.sql` for in-DB scheduling at no Vercel cost.

### Deferred §10.2 modules

These are intentionally absent from Phase A:
- **Members** — member accounts, login, profile management.
- **Events depth** — event CRUD, registrations, capacity management.
- **Promo / member rates** — discount codes, tiered pricing for members.
- **Refunds** — automated or manual refund flows (depends on Stripe, which is out of MVP).

Decisions baked in: reserve-only (no payments), 60-minute slots **bookable in multiples (up to 8 hours per booking)**, guest-only booking (admin still authenticated), 6 seeded courts, hours 06:00–22:00, **90-day booking horizon** (slots generated on demand for far dates).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev
```

### Environment variables

See `.env.example`. The app runs in **"log-only" email mode** until `RESEND_API_KEY` is set —
emails are written to the `email_log` table and console instead of being sent, so the whole
booking flow works before email credentials exist.

### Database (Supabase)

```bash
# With the Supabase CLI and Docker:
supabase start
supabase db reset            # applies migrations + seed.sql
# Create the first admin (no public sign-up):
#   supabase dashboard → Authentication → Add user (email + password)
```

Migrations live in `supabase/migrations/` (schema → RLS → functions). RLS is on for every table
from day one; all booking writes go through `SECURITY DEFINER` RPCs called server-side with the
service role.

### Tests

```bash
npm test                     # vitest: pricing + .ics units
# Booking concurrency + group bookings (need a running Postgres):
psql "$DATABASE_URL" -f supabase/tests/confirm_booking.test.sql
psql "$DATABASE_URL" -f supabase/tests/confirm_booking_multi.test.sql
```

## How the booking integrity works (the critical path)

`confirm_booking` (in `supabase/migrations/0003_functions.sql`) runs in one transaction: it locks
the slot row `FOR UPDATE`, verifies it's still bookable, inserts the booking and marks the slot
booked. A unique index on confirmed `(slot_id)` is the duplicate backstop, and an idempotency key
makes retries safe. Two simultaneous confirms → exactly one wins (see the SQL test).

## What's stubbed / deferred (clearly marked extension points)

- **Live email sending** — add `RESEND_API_KEY` + verify a domain to flip from log-only to real sends.
- **Court photography** — `lib/data/site.ts` uses Unsplash placeholders; swap for Supabase Storage URLs (`// SWAP POINT` comments).
- **Payments (Stripe)** — out of MVP; the confirm step is the natural insertion point.
- **Player accounts / My Account** — guest-only for now.
- **Admin §10.2 deferred modules** — Members, Events depth, promo/member rates, refunds. See "Admin core modules" above.
- **Waitlist** — later phase.
- **Hold expiry** needs no scheduler: abandoned holds expire **lazily on read**, so a stale hold is bookable again immediately. The `release-holds` cron is just cosmetic cleanup — `vercel.json` runs it daily (Vercel Hobby allows one cron/day). For frequent in-DB sweeps at no cost, apply `supabase/optional_pg_cron.sql` (Supabase pg_cron) and you can drop the Vercel cron.

## Project layout

```
app/(marketing)/        landing, about, contact
app/book/               visual booking flow
app/admin/              login page
app/admin/(panel)/      auth-guarded admin shell: dashboard, courts, bookings, templates, settings, reports
app/api/admin/export/   CSV export endpoint
app/api/cron/           scheduled jobs: release-holds (daily), send-reminders (daily)
components/             ui · site · landing · booking · admin · contact · motion
lib/                    supabase clients · booking · admin (queries, actions, audit, csv) · email · pricing · ics · validation
emails/                 React Email templates
supabase/               migrations · seed · tests
```
