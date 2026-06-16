# Fourhand Tennis Club MVP Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Build is code-only (no live Supabase/Resend); verification is via `next build`, `tsc`, vitest unit tests, and a SQL concurrency test that runs when a local Postgres is available.

**Goal:** Build the Fourhand Tennis Club MVP — a polished landing page, a visual three-tap court booking flow with DB-enforced concurrency safety, transactional email templates, and a secure read-only admin overview.

**Architecture:** Next.js App Router on Vercel → Supabase (Postgres + Auth + Realtime + Storage). The one correctness-critical path (confirm booking) lives in a Postgres RPC with row-lock + unique constraint + idempotency. Marketing pages server-rendered; booking page interactive with Realtime; email queued via `email_log` and sent through Resend only when a key is present.

**Tech Stack:** Next.js 15 (App Router, TS), Tailwind v4, shadcn/ui, Framer Motion, @supabase/supabase-js + @supabase/ssr, Resend + React Email, zod, vitest, `ics`.

---

## Phase 0 — Setup & Foundations

### Task 0.1: Scaffold Next.js + tooling
**Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `.eslintrc`, `.gitignore`, `.env.example`
- [ ] Initialize Next.js (App Router, TS, Tailwind, ESLint), src-less `app/` layout.
- [ ] Add deps: `@supabase/supabase-js @supabase/ssr framer-motion zod resend react-email @react-email/components ics clsx tailwind-merge class-variance-authority lucide-react`; dev: `vitest @vitejs/plugin-react jsdom @testing-library/react`.
- [ ] `.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `STAFF_EMAIL`, `NEXT_PUBLIC_SITE_URL`.
- [ ] Commit.

### Task 0.2: Design tokens & Tailwind theme
**Files:** `app/globals.css`, `lib/utils.ts`
- [ ] Define palette CSS vars + Tailwind theme: green `#00B050`, white, charcoal `#3E3E42`, purple `#7B5BA7`, pink `#E56CB5`, gray `#E8E8E8`. Inter font via `next/font`.
- [ ] `cn()` helper (clsx + tailwind-merge).
- [ ] Commit.

### Task 0.3: Supabase clients
**Files:** `lib/supabase/browser.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/types.ts`
- [ ] Browser client (anon), server client (SSR cookies), admin client (service role, server-only guard).
- [ ] Hand-written `Database` types matching the schema.
- [ ] Commit.

### Task 0.4: Database schema, RLS, seed
**Files:** `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql`, `supabase/seed.sql`, `supabase/config.toml`
- [ ] Tables: courts, slots, bookings, pricing_rules, events, event_signups, email_log (per spec §3). Partial unique index on booked `(court_id, starts_at)`; unique `bookings.idempotency_key`.
- [ ] RLS on every table: public read for courts/events; slots read public; bookings/email_log restricted to service role / authenticated admin; inserts via RPC only.
- [ ] Functions: `hold_slot`, `confirm_booking`, `cancel_booking`, `release_expired_holds`, `generate_slots_for_range`.
- [ ] Seed 6 courts + pricing rules + slots for a date range.
- [ ] Commit.

### Task 0.5: Concurrency test (runs when Postgres available)
**Files:** `supabase/tests/confirm_booking.test.sql`
- [ ] pgTAP-style / plain SQL test: two concurrent `confirm_booking` on one slot → exactly one booking row.
- [ ] Commit.

## Phase 1 — Landing Page

### Task 1.1: Shared layout, nav, footer, motion primitives
**Files:** `app/layout.tsx`, `components/site/nav.tsx`, `components/site/footer.tsx`, `components/site/sticky-cta.tsx`, `components/motion/reveal.tsx`
- [ ] Persistent top bar (logo, Book/Events/About/Contact, green Book CTA), mobile slide-in menu, sticky Book CTA, `Reveal` fade-and-rise honoring reduced motion.
- [ ] Commit.

### Task 1.2: Landing sections
**Files:** `app/(marketing)/page.tsx`, `components/landing/{hero,court-showcase,amenities,events-teaser,about-snapshot,contact-section}.tsx`, `lib/data/courts.ts`
- [ ] Hero, court showcase (placeholder imagery + swap-point comments), amenities cards, events teaser, about snapshot, contact + embedded map, in the spec's order.
- [ ] Commit.

### Task 1.3: About & Contact pages + contact action
**Files:** `app/(marketing)/about/page.tsx`, `app/(marketing)/contact/page.tsx`, `app/api/contact/route.ts`, `lib/validation.ts`
- [ ] About story page; Contact page with zod-validated form posting to route handler → email_log (ack + staff forward).
- [ ] Commit.

## Phase 2 — Booking Core

### Task 2.1: Pricing + validation units (TDD)
**Files:** `lib/pricing.ts`, `lib/validation.ts`, `lib/pricing.test.ts`
- [ ] Test peak/off-peak resolution; implement `resolvePrice(startsAt, rules)`.
- [ ] zod schemas: `holdSchema`, `confirmBookingSchema`, `contactSchema`.
- [ ] `vitest run` green. Commit.

### Task 2.2: Booking data access + server actions
**Files:** `lib/booking/queries.ts`, `lib/booking/actions.ts`
- [ ] `getCourtsWithAvailability(date)`, `getSlots(courtId, date)`; server actions `holdSlot`, `confirmBooking`, `cancelBooking` calling RPCs, validating input, queueing email.
- [ ] Commit.

### Task 2.3: Court grid + availability panel + date control
**Files:** `app/book/page.tsx`, `components/booking/{court-grid,court-tile,availability-panel,slot-button,date-control,confirm-form,success.tsx}`
- [ ] Court tiles with the three states; tap → Framer Motion layout expand into side panel (desktop) / bottom sheet (mobile); date control cross-fade; slot select → confirm form (guest name/email/phone) → success animation.
- [ ] Realtime subscription greys out taken slots live; skeleton loaders.
- [ ] Deep link `?court=&date=`.
- [ ] Commit.

## Phase 3 — Mailing

### Task 3.1: ICS generation (TDD)
**Files:** `lib/ics.ts`, `lib/ics.test.ts`
- [ ] Test `.ics` contains court/time/location; implement with `ics`.
- [ ] `vitest run` green. Commit.

### Task 3.2: Mailer + React Email templates
**Files:** `lib/email/mailer.ts`, `emails/{booking-confirmation,staff-new-booking,cancellation,contact-ack}.tsx`, `lib/email/send.ts`
- [ ] `mailer.queue(type, to, react, attachments)`: insert email_log; send via Resend only if `RESEND_API_KEY`, else console + mark `queued`. Branded templates using tokens.
- [ ] Wire into booking confirm + cancel + contact actions.
- [ ] Commit.

### Task 3.3: Cancel page + release-holds cron
**Files:** `app/cancel/[token]/page.tsx`, `app/api/cron/release-holds/route.ts`
- [ ] Cancel via token (from email) → `cancel_booking` + email; cron handler calls `release_expired_holds`.
- [ ] Commit.

## Phase 3b — Minimum Admin

### Task 3b.1: Auth + route protection
**Files:** `middleware.ts`, `app/admin/login/page.tsx`, `app/admin/login/actions.ts`, `lib/supabase/server.ts` (session helper)
- [ ] Supabase Auth email/password login; middleware guards `/admin/*` except login; sign-out action.
- [ ] Commit.

### Task 3b.2: Read-only booked-courts overview
**Files:** `app/admin/page.tsx`, `components/admin/{summary-strip,booking-list,admin-date-control}.tsx`, `lib/admin/queries.ts`
- [ ] Day view (defaults today), summary strip (bookings today, courts occupied/free, next booking), booking list (court, time, player, status); Realtime live updates.
- [ ] Commit.

## Final

### Task F.1: Verify + docs
**Files:** `README.md`
- [ ] `tsc --noEmit`, `next build`, `vitest run`, `next lint` all pass.
- [ ] README: setup, env, migrations, "what's stubbed", swap-in instructions.
- [ ] Commit.
