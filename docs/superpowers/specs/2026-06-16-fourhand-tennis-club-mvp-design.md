# Fourhand Tennis Club — MVP Design (Phases 0–3b)

**Date:** 2026-06-16
**Status:** Approved for implementation
**Source:** `Fourhand_Tennis_Club_Plan.docx` (product) + `Fourhand_Tennis_Club_Tech_Stack.docx` (technical)

## 1. Scope

MVP = Development Plan Phases 0–3b:

1. **Phase 0** — Project setup: Next.js (App Router) + Tailwind tokens + Framer Motion + Supabase schema/RLS/RPCs + env templates.
2. **Phase 1** — Landing page: hero, court showcase, amenities, events teaser, about snapshot, contact + map, footer, sticky "Book a Court" CTA, section motion.
3. **Phase 2** — Booking core: visual court grid, live availability panel, slot holds, guest booking, atomic confirm, confirmation screen.
4. **Phase 3** — Mailing: transactional email templates (confirmation + `.ics`, staff notification, cancellation, contact ack) routed through a queue/log.
5. **Phase 3b** — Minimum admin: secure Supabase Auth login + read-only booked-courts overview (day view, summary strip, live booking list).

### Locked decisions (from §19 of product doc)

| Decision | Choice |
| --- | --- |
| Infrastructure | **Build code only** — migrations + env templates, no live connection/run. Real keys swapped in later. |
| Payments | **Reserve-only** (pay in person). No Stripe in MVP. |
| Slot length | **Fixed 60-minute** slots. |
| Player accounts | **Guest-only** booking in MVP; admin still has secure login. |
| Courts | **6 courts**: 4 hard, 1 clay, 1 grass; mixed indoor/outdoor + lighting. Grid loosely mirrors facility. |
| Business hours | **06:00–22:00** → sixteen 60-min slots/day. |
| Photography | Not available yet — tasteful placeholders with marked swap points (Supabase Storage paths). |

### Explicitly out of MVP scope
Stripe payments, player accounts / My Account, full admin (dashboard, CRUD, pricing UI, members, reports), reminder scheduling (24h/1–2h), waitlist promotion, marketing email. All left as clearly-marked extension points.

## 2. Architecture

Browser → Next.js app (Vercel) → Supabase (Postgres + Auth + Realtime + Storage). Email via Resend. Secrets server-side only; browser uses the Supabase anon key behind RLS.

The single correctness-critical path — confirming a booking — lives in a **Postgres RPC**, not app code, so the database enforces integrity atomically.

```
app/
  (marketing)/        landing + about + contact (server-rendered/static)
  book/               court grid + availability panel (interactive)
  admin/              login + read-only booked-courts overview
  api/                route handlers: hold, confirm, cancel, contact, cron/release-holds
components/
  ui/                 shadcn primitives
  domain/             court-tile, availability-panel, slot, date-control, summary-strip
lib/
  supabase/           browser, server, admin (service-role) clients
  email/              mailer (Resend wrapper, logs+no-ops without key), templates render
  ics.ts              .ics calendar generation
  pricing.ts          peak/off-peak resolution
  validation.ts       zod schemas
supabase/migrations/  schema + RLS + RPCs + seed
emails/               React Email templates
```

## 3. Data Model

Postgres tables, **RLS enabled on every table from day one**:

- **courts** — `id, name, surface (hard|clay|grass), environment (indoor|outdoor), lighting (bool), open_time, close_time, status, sort_order, photo_path`
- **slots** — `id, court_id, starts_at, ends_at, status (free|held|booked), hold_expires_at, hold_key`. Generated per court per day across business hours.
- **bookings** — `id, court_id, slot_id, guest_name, guest_email, guest_phone, price_cents, status (confirmed|cancelled), idempotency_key (unique), cancel_token, created_at`
- **pricing_rules** — `id, scope, peak_start, peak_end, is_member, rate_cents` (peak/off-peak; member flag reserved for future)
- **events** + **event_signups** — scaffolded light (table + minimal read); sign-up flow not built in MVP
- **email_log** — `id, type, recipient, subject, status (queued|sent|failed), payload, created_at`

**Constraints:** unique `(court_id, starts_at)` enforced via a partial unique index on booked slots is the duplicate backstop; `bookings.idempotency_key` unique for retry safety.

## 4. Booking Integrity (§7 of tech doc)

`confirm_booking(p_slot_id, p_guest..., p_idempotency_key)` RPC:

```
begin;
  -- idempotency: return existing booking if key already used
  -- lock the slot row
  select ... from slots where id = p_slot_id for update;
  -- verify still free or held-by-this-session and not expired
  -- insert booking, set slot status = 'booked'
commit;  -- loser waits, then gets a clear "slot taken" error
```

Holds: opening checkout calls `hold_slot` (sets status `held` + `hold_expires_at` ~5 min). `/api/cron/release-holds` flips expired holds back to `free` (wired as a route handler; scheduling is a later increment).

## 5. Realtime

Booking page subscribes to `slots` changes (a slot another player takes greys out live). Admin overview subscribes to `bookings` (new bookings appear without refresh). Active whenever Supabase is reachable; degrades to initial server-fetched state otherwise.

## 6. Email

Resend + React Email branded templates sharing the design tokens. A thin `mailer` wrapper: inserts an `email_log` row, and **sends via Resend only when `RESEND_API_KEY` is present — otherwise logs to console and no-ops the network call**. Triggered by the booking server action (queued the moment the booking commits, never blocking the success screen).

Templates: booking confirmation (+`.ics`, cancel link), staff new-booking notification, cancellation confirmation, contact-form acknowledgement.

## 7. Admin (minimum)

Supabase Auth email/password. `/admin/*` protected by middleware + server session check. Landing screen = read-only booked-courts overview: date control (defaults today), summary strip (bookings today, courts occupied vs free, next upcoming booking), booking list (court, time, player name, status). Single admin role; RLS restricts booking reads to authenticated admins. Sign-out always available.

## 8. Design System & Motion

- **Palette tokens:** primary green `#00B050`, white `#FFFFFF`, charcoal `#3E3E42`, accent purple `#7B5BA7`, accent pink `#E56CB5`, surface gray `#E8E8E8`.
- **Type:** Inter, clear scale, generous line-height, quiet so photography leads.
- **Components:** shadcn/ui primitives + domain components, rounded corners, soft shadows, full default/hover/focus/active/disabled states.
- **Motion (Framer Motion):** court-tile → availability-panel expand anchored on the tile; slot soft fill + lift with confirm sliding up; date change cross-fade in place; section fade-and-rise on enter; success animation on confirm. Durations ~150–300ms, animate only transform/opacity, honour `prefers-reduced-motion` with simple fades.
- **Court tile states:** Available = white fill / green outline; Selected = solid green / white label; Fully booked = gray fill / muted / inert.
- **Responsive:** mobile-first; panel = side panel (desktop) / bottom sheet (mobile).

## 9. Non-Functional

WCAG AA (keyboard, labels, contrast, large tap targets, reduced motion); server-rendered marketing pages for SEO/Core Web Vitals; lazy-loaded responsive images with skeletons; no double-bookings; graceful empty/loading/error/fully-booked states.

## 10. Verification

- `confirm_booking` concurrency: SQL test issuing two simultaneous confirms on one slot — exactly one succeeds.
- Idempotency: same key twice returns the same booking, no duplicate.
- Typecheck + build pass (`next build`), lint clean.
- Pricing resolution unit test (peak vs off-peak).
- Manual: code-only, so no live run; correctness verified via build + SQL/unit tests.
