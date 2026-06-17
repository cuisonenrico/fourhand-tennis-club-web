# Fourhand Tennis Club — Added Control Areas Design (Phase B)

**Date:** 2026-06-17
**Status:** Draft for review
**Source:** `Fourhand_Admin_Controls_Features.docx` — Added control areas **#3 Booking policy**, **#1 Check-in & attendance** (light), **#4 Court closure** (cross-referenced).
**Companion spec:** `2026-06-17-fourhand-admin-core-modules-design.md` — built **first**; provides the admin shell, `admin_audit`, closures, and the `business_settings` table this spec builds on.

> **Execution order:** built **after** the §10.2 core-modules spec. Court closure (#4) is fully specified in that spec (under Courts & schedule) and only referenced here.

## 1. Scope

The low-dependency "added control areas" that extend the existing booking engine without needing a Members system or payments.

### In scope (Phase B)

| # | Area | Summary |
|---|---|---|
| B1 | **Booking policy controls** (#3) | Booking window, minimum lead time, allowed slot-counts (durations), optional buffer, and per-court/time overrides — enforced authoritatively in the booking RPCs. |
| B2 | **Check-in & attendance** (#1, light) | Per-booking check-in status + timestamp; admin Arrived / No-show / Undo; attendance visible and filterable. Manual only. |
| B3 | **Court closure** (#4) | **Specified in the core-modules spec.** Referenced here for completeness only. |

### Decided scope guardrails (from brainstorming)

- **No per-user limits** — bookings are guest-only; per-user/per-week caps wait for Members. Window/lead-time/duration/buffer apply to everyone.
- **No no-show fees or strikes** — needs Members + payments. Check-in is status-only.
- **No auto no-show detection** — manual marking only (no cron this phase).
- **No refund/credit** on closure — cancel + notify with a rebook link (covered in core-modules spec).

### Locked decisions inherited from MVP

Reserve-only, fixed 60-minute slots, guest-only bookings, Asia/Manila wall-clock, Approach A (rules in Postgres RPCs), code-only build verified via `tsc`/`next build`/`vitest`/SQL tests.

## 2. Architecture

Approach A: policy checks are added **inside** the existing `hold_slots` and `confirm_booking_multi` RPCs so they cannot be bypassed and are race-safe. The booking UI reads the same policy to reflect rules (grey out too-early/too-late slots, cap selection length) but the database is the gate. Check-in is a small column + admin action set; no booking-engine change.

```
supabase/migrations/
  0007_booking_policy.sql   booking_policy + court_time_overrides; RPC guards; checkin columns
lib/
  policy.ts                 pure predicate: isSlotBookable(slot, policy, overrides, now) + UI mirror
  policy.test.ts            vitest unit tests (mirrors pricing.test.ts)
  booking/queries.ts        availability reflects policy (read-side)
  admin/queries.ts          attendance read model
  admin/actions.ts          check-in actions (extend)
app/admin/bookings/         check-in controls + attendance filter (extends core-modules A3)
```

## 3. Data model (migration `0007_booking_policy.sql`)

### 3.1 `booking_policy` (single row, `id = true`)

```sql
create table booking_policy (
  id                 boolean primary key default true check (id),
  booking_window_days int not null default 14,   -- how far ahead booking opens (drives slot horizon)
  min_lead_minutes    int not null default 0,    -- min time before a slot starts to still book it
  min_slots_per_booking int not null default 1,  -- min consecutive slots (duration floor)
  max_slots_per_booking int not null default 3,  -- max slots in one booking (duration ceiling)
  buffer_minutes      int not null default 0,    -- gap enforced after a booking on the same court (0 = off)
  guest_booking_enabled boolean not null default true,
  updated_at         timestamptz not null default now(),
  updated_by         text
);
insert into booking_policy (id) values (true) on conflict do nothing;
```

> Kept separate from `business_settings` (core-modules spec): operational/branding settings vs booking enforcement policy. The Settings admin page surfaces both.

### 3.2 `court_time_overrides`

```sql
create table court_time_overrides (
  id           uuid primary key default gen_random_uuid(),
  court_id     uuid not null references courts(id) on delete cascade,
  day_of_week  int,                 -- 0=Sun..6=Sat; null = every day
  start_time   time not null,       -- local Asia/Manila
  end_time     time not null,
  kind         text not null,       -- 'closed_to_public' | 'coaching'
  note         text,
  created_at   timestamptz not null default now()
);
create index court_time_overrides_court_idx on court_time_overrides (court_id);
```

A slot whose local time falls in a `closed_to_public`/`coaching` window for its court is not publicly bookable (admin manual booking may still override — see §4.3).

### 3.3 Check-in columns on `bookings`

```sql
create type checkin_status as enum ('booked', 'checked_in', 'no_show');
alter table bookings add column checkin_status checkin_status not null default 'booked';
alter table bookings add column checked_in_at timestamptz;
```

All new tables: RLS service-role-only (matching existing model).

## 4. Booking policy (B1)

### 4.1 Policy predicate — `lib/policy.ts`

Pure function shared by the read-side (availability UI) and mirrored by the RPC guards:

```ts
isSlotBookable(slot, policy, overrides, now): 
  | { ok: true }
  | { ok: false; reason: 'too_far' | 'too_soon' | 'override_blocked' | 'closed' }
```

- `too_far`: `slot.starts_at > now + booking_window_days`.
- `too_soon`: `slot.starts_at < now + min_lead_minutes`.
- `override_blocked`: slot local time within a matching `court_time_overrides` window.
- `closed`: slot status is `closed` (from a closure).

Slot-count rules (`min/max_slots_per_booking`, `buffer_minutes`) apply to a **selection**, validated separately at hold/confirm time, not per single slot.

### 4.2 RPC enforcement (authoritative)

Extend `hold_slots` and `confirm_booking_multi`:
- Reject (`slot_unavailable` / `slot_taken` shape already handled by the UI) if any slot fails `too_far`, `too_soon`, `override_blocked`, or is `closed`.
- Reject if `array_length(slot_ids)` is outside `[min_slots_per_booking, max_slots_per_booking]`.
- If `buffer_minutes > 0`: reject if booking the selection would leave less than the buffer gap before/after an existing confirmed booking on the same court. **Buffer defaults to 0 (off)** — it is the one sub-rule we will cut first if the reviewer wants Phase B leaner.
- `guest_booking_enabled = false` disables the public booking path (admin manual booking still works).

### 4.3 Read-side reflection
- `getSlotsForCourt` / `getCourtsWithAvailability` annotate slots with `bookable` + `reason` so the UI greys out and labels too-early/too-late/override slots (consistent with how lapsed holds are already normalised to free).
- `ensure-slots` horizon driven by `booking_window_days` (replaces the hard-coded horizon).
- Admin manual booking (core-modules A3) may bypass `too_soon`/`too_far`/overrides (front-desk discretion) but never books a `closed` or already-`booked` slot.

### 4.4 Policy admin
Surfaced on `/admin/settings` (alongside `business_settings`): the `booking_policy` numbers + a `court_time_overrides` editor (add/remove per-court windows). Saves write `admin_audit` rows.

## 5. Check-in & attendance (B2)

### 5.1 Actions (`lib/admin/actions.ts`)
- `markCheckedIn(bookingGroupId | bookingId)` → `checkin_status='checked_in'`, `checked_in_at=now()`, audit.
- `markNoShow(...)` → `checkin_status='no_show'`, audit.
- `undoCheckin(...)` → back to `booked`, clear timestamp, audit.

Simple updates via the service-role client; no RPC needed (no concurrency concern). Group-level marking updates all rows in the group.

### 5.2 UI
- Booking rows in `/admin` (dashboard list) and `/admin/bookings` gain **Arrived / No-show / Undo** controls and a status badge.
- `/admin/bookings` filter includes check-in status (the column the core-modules A3 filter was built tolerant of).

### 5.3 Attendance view
- Read model in `lib/admin/queries.ts`: per-day counts (arrived / no-show / not-marked) on the dashboard; per-booking history is implicit in the bookings list. (Per-player history waits for Members.)

## 6. Court closure (B3) — cross-reference

Time-ranged closures with impact preview, auto-cancel, and rebook-link notification are **fully specified in the core-modules spec** (Courts & schedule, §A2): `closures` table, `slot_status += 'closed'`, `close_court` / `reopen_closure` / `preview_closure_impact`, and `closure-notice` email. The policy predicate here treats `closed` slots as not bookable (§4.1), closing the loop between the two specs.

## 7. Testing

- **Unit (vitest) — `lib/policy.test.ts`:** `too_far` / `too_soon` / `override_blocked` boundaries; slot-count min/max; buffer on/off. Mirrors `pricing.test.ts`.
- **SQL:** `confirm_booking_multi` rejects a slot outside the window / inside lead-time / in an override window / over max-slots; a selection at the exact boundary succeeds. Extends `confirm_booking_multi.test.sql`.
- **Build gate:** `tsc --noEmit`, `next build`, `vitest run`, `next lint` green.

## 8. Open decisions for reviewer

1. **Buffer time:** keep `buffer_minutes` in (defaulted 0/off) or cut from Phase B entirely? (Assumed: keep, off by default.)
2. **Default window:** `booking_window_days = 14` and `min_lead_minutes = 0` reasonable starting values? (Assumed: yes.)
3. **Admin manual-booking bypass:** allow front-desk to book inside lead-time / overrides (recommended) vs hold admins to the same rules? (Assumed: allow bypass except `closed`/`booked`.)

## 9. Data-model & role implications (summary)

| Area | New/changed data | Role impact |
|---|---|---|
| Booking policy | `booking_policy`; `court_time_overrides` | owner/manager configure (single admin this phase) |
| Check-in | `bookings.checkin_status`, `bookings.checked_in_at`; `checkin_status` enum | front-desk action (single admin this phase) |
| Court closure | *(see core-modules spec)* | — |
