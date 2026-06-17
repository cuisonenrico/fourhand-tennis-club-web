# Fourhand Tennis Club — Admin Core Modules Design (§10.2, Phase A)

**Date:** 2026-06-17
**Status:** Draft for review
**Source:** `Fourhand_Admin_Controls_Features.docx` §10.2 (Core admin modules) + existing MVP (`2026-06-16-fourhand-tennis-club-mvp-design.md`)
**Companion spec:** `2026-06-17-fourhand-admin-control-areas-design.md` (Booking policy + Check-in; closures are specified *here*).

> **Execution order:** this spec is built **first**. The companion control-areas spec builds on the admin shell, `admin_audit`, and closures introduced here.

## 1. Scope

The §10.2 "Core admin modules" are the full admin operations surface the MVP grows into. This spec covers **only the modules buildable on the current foundation** — guest-based bookings, fixed 60-minute slots, reserve-only (no online payments), single admin login. Foundation-dependent modules are explicitly deferred.

### In scope (Phase A)

| # | Module | Summary |
|---|---|---|
| A0 | **Admin shell & audit** | Navigable multi-section admin replacing the single read-only page; shared `admin_audit` log for every mutation. |
| A1 | **Dashboard** | Today's bookings, court occupancy, revenue-at-a-glance, next booking. |
| A2 | **Courts & schedule** | CRUD courts; whole-court + **time-ranged closures** (impact preview, auto-cancel + rebook-link email); day/week calendar grid of all bookings. |
| A3 | **Bookings management** | Search/filter; manual (phone) booking; cancel; **reassign** to another slot/court. |
| A4 | **Email templates** | DB-editable subject/body copy per email type; configurable booking-reminder timing + reminder send. |
| A5 | **Settings** | Business-hours defaults, cancellation-policy window, branding (name/logo/accent/contact). |
| A6 | **Reports** | Revenue + occupancy over a date range; CSV export. |

### Explicitly deferred (foundations track)

- **Members** module (profiles, credit balances, history) — needs a Members/Users entity.
- **Events** depth (rosters, waitlists, coach assignment) — needs the events/coach foundation.
- **Pricing** promo codes & member rates — promo engine + Members.
- **Refunds** in Bookings — needs the payments/Transaction layer.

These are named so reviewers see the seam; each gets its own spec when the foundations track begins.

### Locked decisions inherited from MVP

Reserve-only (no Stripe), fixed 60-minute slots, guest-only bookings, Asia/Manila wall-clock, 6 courts, code-only build (migrations + actions; no live Supabase run required to verify via `tsc`/`next build`/`vitest`/SQL tests).

## 2. Architecture

Unchanged stack: Next.js App Router (Vercel) → Supabase (Postgres + Auth + Realtime). **Correctness rules live in Postgres RPCs** (Approach A); admin server actions call those RPCs via the service-role client behind the existing `getSessionUser` guard. Admin UI reflects rules for UX but the database is the authority.

```
app/admin/
  page.tsx              dashboard (was: read-only overview)
  courts/               court CRUD + closures
  bookings/             search / manual create / reassign / cancel
  templates/            email template + reminder editor
  settings/             business / cancellation / branding
  reports/              revenue + occupancy + CSV export
  layout.tsx            admin shell: nav + auth guard
components/admin/       section UIs (server components + client islands)
lib/admin/
  queries.ts            read models (extend existing)
  actions.ts            server actions → RPCs (NEW)
  audit.ts              audit-write helper (NEW)
supabase/migrations/
  0006_admin_core.sql   tables + enums + RPCs for this spec
emails/
  closure-notice.tsx    NEW
  booking-reminder.tsx  NEW
```

### Authorization

Single admin role this phase — every signed-in admin can do everything; the manager/finance/coach split is deferred with RBAC. `admin_audit` records `actor_email` on every mutation so the trail exists before roles do.

## 3. Data model (migration `0006_admin_core.sql`)

All new tables get RLS: **no public access; service-role only** (admin reads/writes go through the service-role client, matching the existing `bookings`/`email_log` model).

### 3.1 Enum + column additions

```sql
alter type slot_status add value 'closed';          -- closure-blocked slots
-- bookings: track manual + reassignment provenance
alter table bookings add column source text not null default 'guest';   -- 'guest' | 'admin'
alter table bookings add column reassigned_from_slot uuid references slots(id);
alter table bookings add column reminded_at timestamptz;                 -- set when a booking reminder is sent (A4)
```

### 3.2 `admin_audit`

```sql
create table admin_audit (
  id           uuid primary key default gen_random_uuid(),
  actor_email  text not null,
  action       text not null,          -- 'court.update' | 'closure.create' | 'booking.reassign' | ...
  target_type  text,                   -- 'court' | 'booking' | 'closure' | 'settings' | ...
  target_id    text,
  detail       jsonb,
  created_at   timestamptz not null default now()
);
create index admin_audit_created_idx on admin_audit (created_at desc);
```

### 3.3 `closures`

```sql
create table closures (
  id          uuid primary key default gen_random_uuid(),
  court_id    uuid not null references courts(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text not null,
  status      text not null default 'active',   -- 'active' | 'lifted'
  created_by  text,
  created_at  timestamptz not null default now()
);
create index closures_court_range_idx on closures (court_id, starts_at, ends_at);
```

Closures are the source of truth; the `close_court` RPC also **materialises** the effect by flipping affected `free` slots to `closed`, so the existing status-driven availability UI hides them with no query change. `reopen_closure` reverses it.

### 3.4 `email_templates`

```sql
create table email_templates (
  type        text primary key,        -- 'booking_confirmation' | 'cancellation' | 'closure_notice' | 'booking_reminder' | ...
  subject     text not null,
  intro       text,                    -- editable lead paragraph; structural layout stays in code
  updated_at  timestamptz not null default now(),
  updated_by  text
);
```

Templates store **copy overrides**, not layout: React Email components keep the branded structure and read `subject`/`intro` overrides with the current hard-coded strings as fallback when no row exists. This keeps rich layout in code while making wording editable.

### 3.5 `business_settings` (single row, `id = true`)

```sql
create table business_settings (
  id                   boolean primary key default true check (id),
  club_name            text not null default 'Fourhand Tennis Club',
  logo_path            text,
  accent_hex           text not null default '#00B050',
  contact_email        text,
  contact_phone        text,
  default_open_time    time not null default '06:00',
  default_close_time   time not null default '22:00',
  cancellation_window_hours int not null default 24,   -- free-cancel window (surfaced to players)
  reminder_offset_hours     int not null default 24,   -- when booking reminders send
  updated_at           timestamptz not null default now(),
  updated_by           text
);
insert into business_settings (id) values (true) on conflict do nothing;
```

> Note: the **booking-policy** numeric rules (window, lead-time, durations) live in a *separate* `booking_policy` table defined by the companion spec, to keep operational settings and enforcement policy cleanly separated.

## 4. Module designs

### A0 — Admin shell & audit
- `app/admin/layout.tsx`: server-side `getSessionUser` guard (redirect to login), top nav across the six sections, sign-out (existing). Pages render section UIs.
- `lib/admin/audit.ts`: `recordAudit(supabase, {actorEmail, action, targetType, targetId, detail})`. Called by every mutating action. Never throws into the caller (audit failure must not break the operation; it logs).

### A1 — Dashboard (`/admin`)
Read-only, extends the existing summary strip + live list:
- **Bookings today** (confirmed count), **Occupancy** (booked slots ÷ bookable slots today, excluding `closed`), **Revenue today** (Σ `price_cents` of confirmed bookings whose slot is today), **Next booking** (soonest upcoming today).
- Keeps the existing Realtime live booking list. New numbers are pure read queries in `lib/admin/queries.ts`.

### A2 — Courts & schedule (`/admin/courts`)
- **Court CRUD:** form over the `courts` columns (name, surface, environment, lighting, open/close, sort_order, photo_path, blurb, status). `admin_upsert_court` action → audit. Whole-court `maintenance` status is the existing coarse control.
- **Closures (time-ranged):**
  - `close_court(p_court_id, p_starts_at, p_ends_at, p_reason)` RPC: lock affected slots `for update`; cancel overlapping **confirmed** bookings (reuse cancel semantics — free not needed, they go `closed`); flip affected `free`/freed slots to `closed`; insert `closures` row + audit; **return the affected bookings** (guest, email, slot times, cancel group) for notification.
  - Action layer emails each affected player the **`closure_notice`** template (reason + apology + rebook link to `/book?court=&date=`), via existing `queueEmail`.
  - **Impact preview:** a read-only `preview_closure_impact(court_id, starts_at, ends_at)` query returning affected bookings *before* the admin confirms.
  - `reopen_closure(p_id)` RPC: flip the closure's `closed` slots back to `free`, mark closure `lifted`, audit. (Cancelled bookings are **not** auto-restored — players rebook.)
  - `generate_slots_for_range` / `ensure-slots` updated to skip (or create-then-close) times inside an `active` closure so later-generated slots don't reopen a closed window.
- **Calendar/grid:** day (and week) grid of all courts × hours showing each slot's state (free/held/booked/closed) with booking guest on booked cells. Read query `getScheduleGrid(dateKey | weekStart)`.

### A3 — Bookings management (`/admin/bookings`)
- **Search/filter:** by date range, court, guest name/email, booking status, check-in status (check-in column lands with the companion spec; the filter is built tolerant of it). Paginated read query.
- **Manual (phone) booking:** `admin_create_booking(p_slot_ids, p_guest_*)` RPC — same atomic lock/insert/mark-booked path as `confirm_booking_multi` but **without a hold key**, `source = 'admin'`, idempotency on a server-generated key; queues the normal confirmation email (optional toggle to suppress). Audit.
- **Cancel:** existing `cancel_booking` exposed in admin by cancel token / group id; sends cancellation email; audit.
- **Reassign:** `admin_reassign_booking(p_booking_group_id, p_new_slot_ids)` RPC — atomically free old slot(s), book equal-count new free slot(s), keep the same booking group + cancel token, set `reassigned_from_slot`, re-price to the new slot(s), audit. Emails the player the updated details. Rejects if any target slot isn't free.
- **Refund:** out of scope (no payments) — UI omits it; re-add with the payments foundation.

### A4 — Email templates (`/admin/templates`)
- Editor lists each email `type` with editable **subject** + **intro** copy; save → `email_templates` upsert + audit.
- React Email templates refactored to accept `subject`/`intro` props resolved from `email_templates` (fallback to current literals). `lib/email/send.ts` loads overrides before rendering.
- **Reminders:** new `booking-reminder.tsx` template + `app/api/cron/send-reminders/route.ts` (guarded by `CRON_SECRET`, like `release-holds`) that, each run, emails confirmed bookings starting within the `reminder_offset_hours` window that haven't been reminded yet (track via a `reminded_at` column on `bookings` or an `email_log` lookup). `reminder_offset_hours` editable in Settings (A5).

### A5 — Settings (`/admin/settings`)
- Form over `business_settings`: branding (club name, logo upload path, accent hex, contact email/phone), default business hours, `cancellation_window_hours`, `reminder_offset_hours`. Save → upsert + audit.
- Consumers: branding/contact surfaced in email templates and (optionally) the marketing footer; cancellation window surfaced on the cancel page and in emails; default hours pre-fill new-court forms.

### A6 — Reports (`/admin/reports`)
- **Revenue:** Σ confirmed `price_cents` grouped by day over a chosen range.
- **Occupancy:** booked ÷ bookable slots per day (exclude `closed`), as a trend.
- **Export:** `app/api/admin/export/route.ts` streams a CSV (bookings or daily aggregates) for the range; guarded by `getSessionUser`. Read-only; no new tables.

## 5. Notifications

Reuse `queueEmail` + `email_log`. New templates: `closure-notice.tsx`, `booking-reminder.tsx`. All copy honours `email_templates` overrides (A4) and branding (A5).

## 6. Testing

- **SQL concurrency:** `close_court` racing `confirm_booking_multi` on the same slot → consistent end state (slot `closed`, no orphan confirmed booking). `admin_reassign_booking` racing a guest confirm on the target slot → exactly one winner. Mirrors `confirm_booking_multi.test.sql`.
- **Unit (vitest):** occupancy/revenue aggregation helpers; CSV serialisation; template-override resolution (override vs fallback).
- **Build gate:** `tsc --noEmit`, `next build`, `vitest run`, `next lint` all green (matches MVP Final task).

## 7. Open decisions for reviewer

1. **Reminders:** include the reminder template + cron in Phase A (recommended), or store `reminder_offset_hours` now and add sending later?
2. **Manual booking email:** default to sending the player a confirmation, with a "don't email" toggle? (Assumed: yes, send by default.)
3. **Reassign re-pricing:** re-price to the new slot's peak/off-peak rate (recommended) vs keep original price? (Assumed: re-price.)
4. **Calendar grid:** day-only for v1, or day **and** week? (Assumed: day first, week if cheap.)
5. **Branding in marketing site:** wire `business_settings` into the public footer now, or admin-only for Phase A? (Assumed: admin + emails only; marketing later.)

## 8. Data-model & role implications (summary)

| Module | New/changed data | Role impact |
|---|---|---|
| Shell & audit | `admin_audit` | foundation for future RBAC |
| Courts & schedule | `closures`; `slot_status += 'closed'` | — |
| Bookings | `bookings.source`, `bookings.reassigned_from_slot` | — |
| Email templates | `email_templates`; `bookings.reminded_at` | — |
| Settings | `business_settings` | — |
| Reports | none (read-only) | — |
