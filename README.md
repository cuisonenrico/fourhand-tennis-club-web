# Fourhand Tennis Club — Booking Web App

A visually rich, fast court-booking experience: pick a court, pick a time, confirm — with an
instant confirmation email. Built per the product & technical specs in `docs/superpowers/specs/`.

**Stack:** Next.js 15 (App Router) · Supabase (Postgres + Auth + Realtime) · Resend · Tailwind v4 · Framer Motion · shadcn-style UI · zod.

## MVP scope (Phases 0–3b)

- **Landing page** — hero, court showcase, amenities, events teaser, about, contact + map, sticky CTA, motion.
- **Visual booking** — clickable court grid → live availability panel → guest checkout → animated confirmation. Concurrency-safe (Postgres row-lock + unique constraint + idempotency).
- **Transactional email** — booking confirmation (+`.ics`), staff notification, cancellation, contact ack. Queued via `email_log`.
- **Minimum admin** — secure Supabase Auth login + read-only, live booked-courts overview.

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
- **Full admin** (CRUD, pricing UI, members, reports), **reminders** (24h/1–2h) and **waitlist** — later phases.
- **Hold expiry** needs no scheduler: abandoned holds expire **lazily on read**, so a stale hold is bookable again immediately. The `release-holds` cron is just cosmetic cleanup — `vercel.json` runs it daily (Vercel Hobby allows one cron/day). For frequent in-DB sweeps at no cost, apply `supabase/optional_pg_cron.sql` (Supabase pg_cron) and you can drop the Vercel cron.

## Project layout

```
app/(marketing)/   landing, about, contact     app/book/      visual booking flow
app/admin/         login + booked-courts        app/api/cron/  scheduled jobs
components/        ui · site · landing · booking · admin · contact · motion
lib/              supabase clients · booking · admin · email · pricing · ics · validation
emails/           React Email templates         supabase/      migrations · seed · tests
```
