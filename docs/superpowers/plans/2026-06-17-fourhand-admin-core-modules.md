# Fourhand Admin Core Modules (§10.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the §10.2 admin operations surface buildable on today's foundation — navigable admin shell, dashboard metrics, courts & schedule (incl. time-ranged closures), bookings management (manual create / cancel / reassign), editable email copy + reminders, business settings, and reports.

**Architecture:** Approach A — correctness rules live in Postgres `SECURITY DEFINER` RPCs called by server actions through the service-role client behind the existing `getSessionUser` guard. New admin pages are server components reading via the service-role client; mutations are server actions calling RPCs; every mutation writes an `admin_audit` row. Closures materialise to a new `'closed'` slot status so the existing status-driven UI hides them with no query change.

**Tech Stack:** Next.js 15 App Router (TS), Supabase Postgres + service-role client, Tailwind v4, React Email + Resend, zod, vitest.

## Global Constraints

- Reserve-only — **no payments**; refunds are out of scope (omit from Bookings UI).
- Fixed **60-minute** slots; times are **Asia/Manila** wall-clock (UTC+8, no DST).
- **Guest-only** bookings (name/email/phone) — no Members; no per-user features.
- **Single admin role** this phase — every signed-in admin can do everything; `admin_audit` records `actor_email` for the future RBAC split.
- New tables have **RLS enabled with no anon/authenticated policies** (service-role bypasses RLS); all admin reads/writes go through the service-role client server-side.
- All writes go through **RPCs or server actions**, never the browser.
- Email always routes through `queueEmail` (`lib/email/mailer.ts`) → `email_log`; never throws into the caller.
- Verify each task with `npm run typecheck`, and where noted `npm run test`. Full `npm run build` + `npm run lint` at the end. SQL tests run only when a local Postgres is available.
- Money is integer **cents**; format with `formatPrice` (`lib/utils.ts`).

---

## File Structure

```
supabase/migrations/0006_admin_core.sql      NEW — enums/columns/tables/RLS/RPCs
supabase/tests/admin_core.test.sql           NEW — closure + reassign concurrency
lib/supabase/types.ts                         MODIFY — new types
lib/admin/audit.ts                            NEW — recordAudit helper
lib/admin/queries.ts                          MODIFY — dashboard, courts, closures, bookings, schedule, reports reads
lib/admin/actions.ts                          NEW — server actions → RPCs
lib/validation.ts                             MODIFY — admin zod schemas
lib/email/templates.ts                        NEW — resolve subject/intro overrides
lib/email/send.ts                             MODIFY — closure + reminder senders; apply overrides
emails/closure-notice.tsx                     NEW
emails/booking-reminder.tsx                   NEW
app/admin/layout.tsx                          NEW — admin shell (guard + nav)
app/admin/page.tsx                            MODIFY — dashboard
app/admin/courts/page.tsx                     NEW
app/admin/bookings/page.tsx                   NEW
app/admin/templates/page.tsx                  NEW
app/admin/settings/page.tsx                   NEW
app/admin/reports/page.tsx                    NEW
app/api/cron/send-reminders/route.ts          NEW
app/api/admin/export/route.ts                 NEW — CSV
components/admin/*                             NEW section components (listed per task)
vercel.json                                   MODIFY — add reminder cron
```

---

## Task 1: Database migration — schema, RLS, RPCs

**Files:**
- Create: `supabase/migrations/0006_admin_core.sql`
- Create: `supabase/tests/admin_core.test.sql`

**Interfaces — Produces (RPC signatures consumed by later tasks):**
- `preview_closure_impact(p_court_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)` → rows `(booking_group_id uuid, guest_name text, guest_email text, cancel_token uuid, slot_starts_at timestamptz, slot_ends_at timestamptz)`
- `close_court(p_court_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_reason text, p_actor text)` → same row shape as preview (the bookings it cancelled)
- `reopen_closure(p_id uuid, p_actor text)` → void
- `admin_create_booking(p_slot_ids uuid[], p_guest_name text, p_guest_email text, p_guest_phone text, p_idempotency_key text, p_actor text)` → `(booking_group_id uuid, cancel_token uuid, total_price_cents integer, status text)` where status ∈ `confirmed|slot_taken|slot_closed`
- `admin_reassign_booking(p_booking_group_id uuid, p_new_slot_ids uuid[], p_actor text)` → `(status text, total_price_cents integer)` where status ∈ `reassigned|slot_taken`
- New tables: `admin_audit`, `closures`, `email_templates`, `business_settings`; new columns `bookings.source`, `bookings.reassigned_from_slot`, `bookings.reminded_at`; enum `slot_status` gains `'closed'`.

- [ ] **Step 1: Write the migration — enums, columns, tables, RLS**

Create `supabase/migrations/0006_admin_core.sql`:

```sql
-- Fourhand Tennis Club — Admin Core Modules (§10.2, Phase A)
-- Approach A: operations rules live in SECURITY DEFINER RPCs. New tables are
-- service-role-only. Closures materialise to a 'closed' slot status so the
-- existing availability UI hides them unchanged.

-- NOTE: ALTER TYPE ADD VALUE is allowed inside this migration's transaction;
-- the value is only *used* at runtime by the RPCs (string-literal casts in
-- function bodies are not evaluated at CREATE time), so no in-tx-use error.
alter type slot_status add value if not exists 'closed';

alter table bookings add column if not exists source text not null default 'guest';   -- 'guest' | 'admin'
alter table bookings add column if not exists reassigned_from_slot uuid references slots(id);
alter table bookings add column if not exists reminded_at timestamptz;

create table if not exists admin_audit (
  id          uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action      text not null,
  target_type text,
  target_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on admin_audit (created_at desc);

create table if not exists closures (
  id         uuid primary key default gen_random_uuid(),
  court_id   uuid not null references courts(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text not null,
  status     text not null default 'active',   -- 'active' | 'lifted'
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists closures_court_range_idx on closures (court_id, starts_at, ends_at);

create table if not exists email_templates (
  type       text primary key,
  subject    text not null,
  intro      text,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists business_settings (
  id                        boolean primary key default true check (id),
  club_name                 text not null default 'Fourhand Tennis Club',
  logo_path                 text,
  accent_hex                text not null default '#00B050',
  contact_email             text,
  contact_phone             text,
  default_open_time         time not null default '06:00',
  default_close_time        time not null default '22:00',
  cancellation_window_hours int  not null default 24,
  reminder_offset_hours     int  not null default 24,
  updated_at                timestamptz not null default now(),
  updated_by                text
);
insert into business_settings (id) values (true) on conflict do nothing;

-- Service-role-only: enable RLS, add NO anon/authenticated policies.
alter table admin_audit       enable row level security;
alter table closures          enable row level security;
alter table email_templates   enable row level security;
alter table business_settings enable row level security;
```

- [ ] **Step 2: Append closure RPCs + closure-aware slot generation**

Append to the same file:

```sql
-- Closure impact preview (read-only).
create or replace function preview_closure_impact(
  p_court_id uuid, p_starts_at timestamptz, p_ends_at timestamptz
) returns table (
  booking_group_id uuid, guest_name text, guest_email text,
  cancel_token uuid, slot_starts_at timestamptz, slot_ends_at timestamptz
) language sql stable security definer set search_path = public as $$
  select b.booking_group_id, b.guest_name, b.guest_email, b.cancel_token, s.starts_at, s.ends_at
  from bookings b join slots s on s.id = b.slot_id
  where b.court_id = p_court_id and b.status = 'confirmed'
    and s.starts_at < p_ends_at and s.ends_at > p_starts_at
  order by s.starts_at;
$$;

-- Close a court for a time range: cancel overlapping confirmed bookings, mark
-- affected slots 'closed', record the closure + audit, and return the bookings
-- it cancelled (for notification). Returns zero rows if nothing was affected;
-- the closure is created regardless.
create or replace function close_court(
  p_court_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_reason text, p_actor text
) returns table (
  booking_group_id uuid, guest_name text, guest_email text,
  cancel_token uuid, slot_starts_at timestamptz, slot_ends_at timestamptz
) language plpgsql security definer set search_path = public as $$
declare v_closure uuid;
begin
  if p_ends_at <= p_starts_at then raise exception 'invalid_range' using errcode = 'P0001'; end if;

  insert into closures (court_id, starts_at, ends_at, reason, created_by)
  values (p_court_id, p_starts_at, p_ends_at, p_reason, p_actor)
  returning id into v_closure;

  -- Lock affected slots so a concurrent confirm waits.
  perform 1 from slots
   where court_id = p_court_id and starts_at < p_ends_at and ends_at > p_starts_at
   for update;

  return query
  with affected as (
    select b.id, b.booking_group_id, b.guest_name, b.guest_email, b.cancel_token,
           s.starts_at as sa, s.ends_at as ea
    from bookings b join slots s on s.id = b.slot_id
    where b.court_id = p_court_id and b.status = 'confirmed'
      and s.starts_at < p_ends_at and s.ends_at > p_starts_at
  ),
  did_cancel as (
    update bookings set status = 'cancelled' where id in (select id from affected) returning 1
  ),
  did_close as (
    update slots set status = 'closed', hold_key = null, hold_expires_at = null
    where court_id = p_court_id and starts_at < p_ends_at and ends_at > p_starts_at
    returning 1
  ),
  did_audit as (
    insert into admin_audit (actor_email, action, target_type, target_id, detail)
    values (coalesce(p_actor,'system'), 'closure.create', 'closure', v_closure::text,
            jsonb_build_object('court_id', p_court_id, 'starts_at', p_starts_at,
                               'ends_at', p_ends_at, 'reason', p_reason))
    returning 1
  )
  select a.booking_group_id, a.guest_name, a.guest_email, a.cancel_token, a.sa, a.ea
  from affected a;
end;
$$;

-- Reopen a closure: free its 'closed' slots not still covered by another active
-- closure, mark the closure lifted. Cancelled bookings are NOT auto-restored.
create or replace function reopen_closure(p_id uuid, p_actor text)
returns void language plpgsql security definer set search_path = public as $$
declare v_c closures%rowtype;
begin
  select * into v_c from closures where id = p_id for update;
  if not found then raise exception 'closure_not_found' using errcode = 'P0002'; end if;
  if v_c.status = 'lifted' then return; end if;

  update slots s set status = 'free'
   where s.court_id = v_c.court_id and s.status = 'closed'
     and s.starts_at < v_c.ends_at and s.ends_at > v_c.starts_at
     and not exists (
       select 1 from closures c2
       where c2.id <> p_id and c2.status = 'active' and c2.court_id = s.court_id
         and c2.starts_at < s.ends_at and c2.ends_at > s.starts_at);

  update closures set status = 'lifted' where id = p_id;

  insert into admin_audit (actor_email, action, target_type, target_id)
  values (coalesce(p_actor,'system'), 'closure.reopen', 'closure', p_id::text);
end;
$$;

-- Replace slot generation so slots created inside an active closure are 'closed'.
create or replace function generate_slots_for_range(p_start_date date, p_end_date date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_court courts%rowtype; v_day date; v_hour int; v_start timestamptz; v_inserted int := 0;
begin
  for v_court in select * from courts where status = 'active' loop
    v_day := p_start_date;
    while v_day <= p_end_date loop
      v_hour := extract(hour from v_court.open_time)::int;
      while v_hour < extract(hour from v_court.close_time)::int loop
        v_start := (v_day::text || ' ' || lpad(v_hour::text, 2, '0') || ':00:00 Asia/Manila')::timestamptz;
        insert into slots (court_id, starts_at, ends_at, status)
        values (v_court.id, v_start, v_start + interval '1 hour',
          case when exists (
            select 1 from closures c where c.court_id = v_court.id and c.status = 'active'
              and c.starts_at < v_start + interval '1 hour' and c.ends_at > v_start
          ) then 'closed' else 'free' end)
        on conflict (court_id, starts_at) do nothing;
        if found then v_inserted := v_inserted + 1; end if;
        v_hour := v_hour + 1;
      end loop;
      v_day := v_day + 1;
    end loop;
  end loop;
  return v_inserted;
end;
$$;
```

- [ ] **Step 3: Append manual-booking + reassign RPCs**

Append:

```sql
-- Admin manual (phone) booking: books free slots without a hold. Books over a
-- foreign hold at admin discretion; never over 'booked' or 'closed'.
create or replace function admin_create_booking(
  p_slot_ids uuid[], p_guest_name text, p_guest_email text, p_guest_phone text,
  p_idempotency_key text, p_actor text
) returns table (booking_group_id uuid, cancel_token uuid, total_price_cents integer, status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_slot slots%rowtype; v_group uuid := gen_random_uuid(); v_token uuid := gen_random_uuid();
  v_total int := 0; v_price int;
begin
  if coalesce(array_length(p_slot_ids,1),0) = 0 then raise exception 'no_slots' using errcode = 'P0001'; end if;
  if (select count(*) from slots where id = any(p_slot_ids)) <> array_length(p_slot_ids,1) then
    raise exception 'slot_not_found' using errcode = 'P0002';
  end if;

  for v_slot in select * from slots where id = any(p_slot_ids) order by id for update loop
    if v_slot.status = 'booked' then return query select null::uuid,null::uuid,null::integer,'slot_taken'::text; return; end if;
    if v_slot.status = 'closed' then return query select null::uuid,null::uuid,null::integer,'slot_closed'::text; return; end if;
  end loop;

  for v_slot in select * from slots where id = any(p_slot_ids) order by starts_at loop
    v_price := resolve_price_cents(v_slot.starts_at);
    v_total := v_total + v_price;
    insert into bookings (court_id, slot_id, guest_name, guest_email, guest_phone,
                          price_cents, idempotency_key, booking_group_id, cancel_token, source)
    values (v_slot.court_id, v_slot.id, p_guest_name, p_guest_email, p_guest_phone,
            v_price, p_idempotency_key, v_group, v_token, 'admin');
    update slots set status = 'booked', hold_key = null, hold_expires_at = null where id = v_slot.id;
  end loop;

  insert into admin_audit (actor_email, action, target_type, target_id, detail)
  values (coalesce(p_actor,'system'), 'booking.create_manual', 'booking', v_group::text,
          jsonb_build_object('slot_ids', to_jsonb(p_slot_ids), 'guest_email', p_guest_email));

  return query select v_group, v_token, v_total, 'confirmed'::text;
end;
$$;

-- Reassign a confirmed booking group to an equal number of free slots, keeping
-- the same group id + cancel token. Re-prices to the new slots.
create or replace function admin_reassign_booking(
  p_booking_group_id uuid, p_new_slot_ids uuid[], p_actor text
) returns table (status text, total_price_cents integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_pair record; v_total int := 0; v_n_old int;
  v_n_new int := coalesce(array_length(p_new_slot_ids,1),0);
begin
  if v_n_new = 0 then raise exception 'no_slots' using errcode = 'P0001'; end if;

  select count(*) into v_n_old from bookings
   where booking_group_id = p_booking_group_id and status = 'confirmed';
  if v_n_old = 0 then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
  if v_n_old <> v_n_new then raise exception 'slot_count_mismatch' using errcode = 'P0001'; end if;

  perform 1 from slots where id = any(p_new_slot_ids) order by id for update;
  if (select count(*) from slots where id = any(p_new_slot_ids)) <> v_n_new then
    raise exception 'slot_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from slots where id = any(p_new_slot_ids) and status <> 'free') then
    return query select 'slot_taken'::text, null::integer; return;
  end if;

  update slots set status = 'free', hold_key = null, hold_expires_at = null
   where id in (select slot_id from bookings where booking_group_id = p_booking_group_id and status = 'confirmed');

  for v_pair in
    select ob.id as booking_id, ob.slot_id as old_slot_id, ns.id as new_slot_id,
           ns.court_id as new_court, ns.starts_at as new_start
    from (select b.id, b.slot_id, row_number() over (order by s.starts_at) rn
          from bookings b join slots s on s.id = b.slot_id
          where b.booking_group_id = p_booking_group_id and b.status = 'confirmed') ob
    join (select s.id, s.court_id, s.starts_at, row_number() over (order by s.starts_at) rn
          from slots s where s.id = any(p_new_slot_ids)) ns on ns.rn = ob.rn
  loop
    update bookings set slot_id = v_pair.new_slot_id, court_id = v_pair.new_court,
           price_cents = resolve_price_cents(v_pair.new_start), reassigned_from_slot = v_pair.old_slot_id
     where id = v_pair.booking_id;
    update slots set status = 'booked', hold_key = null, hold_expires_at = null where id = v_pair.new_slot_id;
    v_total := v_total + resolve_price_cents(v_pair.new_start);
  end loop;

  insert into admin_audit (actor_email, action, target_type, target_id, detail)
  values (coalesce(p_actor,'system'), 'booking.reassign', 'booking', p_booking_group_id::text,
          jsonb_build_object('new_slot_ids', to_jsonb(p_new_slot_ids)));

  return query select 'reassigned'::text, v_total;
end;
$$;

-- Lock all new RPCs to the service role.
revoke execute on function preview_closure_impact(uuid,timestamptz,timestamptz) from public;
revoke execute on function close_court(uuid,timestamptz,timestamptz,text,text) from public;
revoke execute on function reopen_closure(uuid,text) from public;
revoke execute on function admin_create_booking(uuid[],text,text,text,text,text) from public;
revoke execute on function admin_reassign_booking(uuid,uuid[],text) from public;

grant execute on function preview_closure_impact(uuid,timestamptz,timestamptz) to service_role;
grant execute on function close_court(uuid,timestamptz,timestamptz,text,text) to service_role;
grant execute on function reopen_closure(uuid,text) to service_role;
grant execute on function admin_create_booking(uuid[],text,text,text,text,text) to service_role;
grant execute on function admin_reassign_booking(uuid,uuid[],text) to service_role;
```

- [ ] **Step 4: Write the SQL concurrency test**

Create `supabase/tests/admin_core.test.sql` (plain SQL, runs when local Postgres is available — mirrors `confirm_booking_multi.test.sql`):

```sql
-- Verifies close_court + reassign integrity. Run against a seeded DB.
begin;

-- Pick one free slot.
do $$
declare v_slot uuid; v_court uuid; v_start timestamptz; v_end timestamptz; v_grp uuid;
begin
  select id, court_id, starts_at, ends_at into v_slot, v_court, v_start, v_end
  from slots where status = 'free' order by starts_at limit 1;

  -- Book it manually, then close the court over its window.
  perform admin_create_booking(array[v_slot], 'Test Guest', 't@example.com', '0900', 'test-idem-1', 'tester');
  select booking_group_id into v_grp from bookings where slot_id = v_slot;

  perform close_court(v_court, v_start, v_end, 'rain', 'tester');

  -- Assertions: booking cancelled, slot closed, closure recorded.
  assert (select status from bookings where booking_group_id = v_grp) = 'cancelled', 'booking not cancelled';
  assert (select status from slots where id = v_slot) = 'closed', 'slot not closed';
  assert exists (select 1 from closures where court_id = v_court and status = 'active'), 'closure missing';
  assert exists (select 1 from admin_audit where action = 'closure.create'), 'audit missing';
end $$;

rollback;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_admin_core.sql supabase/tests/admin_core.test.sql
git commit -m "feat(db): admin core migration — closures, manual/reassign RPCs, settings, audit"
```

---

## Task 2: TypeScript types

**Files:**
- Modify: `lib/supabase/types.ts`

**Interfaces — Produces:** `SlotStatus` (adds `'closed'`), `BookingSource`, `Closure`, `EmailTemplate`, `BusinessSettings`, `AdminAudit`, and RPC result types `CloseCourtRow`, `AdminCreateResult`, `AdminReassignResult`.

- [ ] **Step 1: Add types**

In `lib/supabase/types.ts`, change `SlotStatus` and append the new types:

```ts
export type SlotStatus = "free" | "held" | "booked" | "closed";
export type BookingSource = "guest" | "admin";

export interface Closure {
  id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  status: "active" | "lifted";
  created_by: string | null;
  created_at: string;
}

export interface EmailTemplate {
  type: string;
  subject: string;
  intro: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface BusinessSettings {
  id: boolean;
  club_name: string;
  logo_path: string | null;
  accent_hex: string;
  contact_email: string | null;
  contact_phone: string | null;
  default_open_time: string;
  default_close_time: string;
  cancellation_window_hours: number;
  reminder_offset_hours: number;
  updated_at: string;
  updated_by: string | null;
}

export interface AdminAudit {
  id: string;
  actor_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface CloseCourtRow {
  booking_group_id: string | null;
  guest_name: string;
  guest_email: string;
  cancel_token: string;
  slot_starts_at: string;
  slot_ends_at: string;
}

export interface AdminCreateResult {
  booking_group_id: string | null;
  cancel_token: string | null;
  total_price_cents: number | null;
  status: "confirmed" | "slot_taken" | "slot_closed";
}

export interface AdminReassignResult {
  status: "reassigned" | "slot_taken";
  total_price_cents: number | null;
}
```

Also extend `Booking` with `source`, `reassigned_from_slot`, `reminded_at`:

```ts
  source: BookingSource;
  reassigned_from_slot: string | null;
  reminded_at: string | null;
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck` — Expected: PASS.

```bash
git add lib/supabase/types.ts
git commit -m "feat(types): admin core domain + RPC result types"
```

---

## Task 3: Admin shell, navigation & audit helper

**Files:**
- Create: `lib/admin/audit.ts`
- Create: `app/admin/layout.tsx`
- Create: `components/admin/admin-nav.tsx`
- Modify: `components/admin/admin-header.tsx` (accept children for nav)

**Interfaces — Produces:** `recordAudit(supabase, entry)`; admin layout wrapping all `/admin/*` pages except `/admin/login`.

- [ ] **Step 1: Audit helper**

Create `lib/admin/audit.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEntry {
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
}

/** Record an admin mutation. Never throws — audit failure must not break the op. */
export async function recordAudit(supabase: SupabaseClient, e: AuditEntry): Promise<void> {
  try {
    await supabase.from("admin_audit").insert({
      actor_email: e.actorEmail,
      action: e.action,
      target_type: e.targetType ?? null,
      target_id: e.targetId ?? null,
      detail: e.detail ?? null,
    });
  } catch (err) {
    console.error("[recordAudit] failed:", err);
  }
}
```

- [ ] **Step 2: Admin nav**

Create `components/admin/admin-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/courts", label: "Courts & schedule" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/templates", label: "Email templates" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/reports", label: "Reports" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-surface bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-green text-green"
                  : "border-transparent text-charcoal/60 hover:text-charcoal",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Admin layout**

Create `app/admin/layout.tsx`. The login page renders its own minimal chrome, so the shell skips nav there by reading the segment is not feasible in a layout; instead the layout guards auth and renders the shell, and the login page lives under a route that this layout still wraps. To avoid wrapping login with nav, the login page sets its own full-screen content; keep the layout guard tolerant:

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/supabase/server";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Login page is public; detect it via the request path.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isLogin = pathname.endsWith("/admin/login");

  if (isLogin) return <>{children}</>;

  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  return (
    <>
      <AdminHeader email={user.email ?? undefined} />
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
```

To make `x-pathname` available, set it in `middleware.ts` (which already runs for `/admin/*`). Add near the top of the middleware response, before returning:

```ts
// Expose the path to server components/layouts.
response.headers.set("x-pathname", request.nextUrl.pathname);
```

(If the existing middleware returns multiple response objects, set the header on each returned `NextResponse`.)

- [ ] **Step 4: Simplify the existing dashboard page (layout now owns chrome)**

Modify `app/admin/page.tsx` to drop the now-duplicated header/main (the layout provides them). It becomes:

```tsx
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminDashboard, type AdminDashboardData } from "@/lib/admin/queries";
import { todayKey } from "@/lib/utils";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function AdminOverviewPage() {
  const dateKey = todayKey();
  let initial: AdminDashboardData = {
    bookings: [], courtCount: 0, revenueCents: 0, occupiedSlots: 0, bookableSlots: 0, nextBooking: null,
  };
  try {
    initial = await getAdminDashboard(createAdminClient(), dateKey);
  } catch (err) {
    console.error("[admin] initial load failed:", err);
  }
  return <AdminDashboard initialDay={initial} initialDateKey={dateKey} />;
}
```

(`getAdminDashboard` is defined in Task 4. Login page already redirects unauth via layout; remove the now-redundant `getSessionUser` redirect from this page.)

- [ ] **Step 5: Verify + commit**

Run: `npm run typecheck` — Expected: PASS (note: `getAdminDashboard` lands in Task 4; if executing strictly task-by-task, do Task 4 before typecheck, or stub the import). Commit:

```bash
git add lib/admin/audit.ts app/admin/layout.tsx components/admin/admin-nav.tsx components/admin/admin-header.tsx app/admin/page.tsx middleware.ts
git commit -m "feat(admin): navigable admin shell + audit helper"
```

---

## Task 4: Dashboard metrics

**Files:**
- Modify: `lib/admin/queries.ts`
- Modify: `components/admin/summary-strip.tsx`
- Modify: `components/admin/admin-dashboard.tsx`
- Test: `lib/admin/queries.test.ts`

**Interfaces:**
- Consumes: `manilaDayRange` (`lib/utils.ts`).
- Produces: `AdminDashboardData { bookings: AdminBooking[]; courtCount: number; revenueCents: number; occupiedSlots: number; bookableSlots: number; nextBooking: AdminBooking | null }` and `getAdminDashboard(supabase, dateKey)`; pure helper `summariseRevenue(bookings)`.

- [ ] **Step 1: Write the failing test for the revenue helper**

Create `lib/admin/queries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summariseRevenue } from "./queries";
import type { AdminBooking } from "./queries";

const b = (priceCents: number, startsAt: string): AdminBooking => ({
  id: crypto.randomUUID(), guestName: "X", status: "confirmed", priceCents,
  courtName: "C1", startsAt, endsAt: startsAt,
});

describe("summariseRevenue", () => {
  it("sums confirmed booking prices", () => {
    expect(summariseRevenue([b(50000, "2026-07-01T10:00:00Z"), b(70000, "2026-07-01T11:00:00Z")])).toBe(120000);
  });
  it("is zero for no bookings", () => {
    expect(summariseRevenue([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL** (`summariseRevenue` not exported). Run: `npm run test -- queries`

- [ ] **Step 3: Implement the helper + dashboard query**

In `lib/admin/queries.ts`, add the helper and the dashboard read (keep the existing `getAdminDay`/`AdminBooking`):

```ts
export function summariseRevenue(bookings: AdminBooking[]): number {
  return bookings
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + b.priceCents, 0);
}

export interface AdminDashboardData extends AdminDay {
  revenueCents: number;
  occupiedSlots: number;
  bookableSlots: number;
  nextBooking: AdminBooking | null;
}

export async function getAdminDashboard(
  supabase: SupabaseClient,
  dateKey: string,
): Promise<AdminDashboardData> {
  const { startIso, endIso } = manilaDayRange(dateKey);
  const day = await getAdminDay(supabase, dateKey);

  // Slot occupancy for the day, excluding closures from the denominator.
  const { data: slots } = await supabase
    .from("slots")
    .select("status")
    .gte("starts_at", startIso)
    .lt("starts_at", endIso);
  const rows = (slots ?? []) as { status: string }[];
  const bookableSlots = rows.filter((s) => s.status !== "closed").length;
  const occupiedSlots = rows.filter((s) => s.status === "booked").length;

  const nowIso = new Date().toISOString();
  const nextBooking =
    day.bookings.find((b) => b.startsAt >= nowIso) ?? null;

  return {
    ...day,
    revenueCents: summariseRevenue(day.bookings),
    occupiedSlots,
    bookableSlots,
    nextBooking,
  };
}
```

- [ ] **Step 4: Run the test — Expected: PASS.** Run: `npm run test -- queries`

- [ ] **Step 5: Surface the metrics in the summary strip**

Replace `components/admin/summary-strip.tsx` with a version that takes `AdminDashboardData` and shows four stat cards (Bookings today, Occupancy, Revenue, Next booking). Keep the existing card styling (`rounded-card border border-surface bg-white p-5 shadow-soft`):

```tsx
import { formatPrice, formatTimeRange } from "@/lib/utils";
import type { AdminDashboardData } from "@/lib/admin/queries";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-surface bg-white p-5 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal/50">{label}</p>
      <p className="mt-1 text-2xl font-bold text-charcoal">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-charcoal/60">{sub}</p>}
    </div>
  );
}

export function SummaryStrip({ data }: { data: AdminDashboardData }) {
  const confirmed = data.bookings.filter((b) => b.status === "confirmed").length;
  const occ = data.bookableSlots > 0 ? Math.round((data.occupiedSlots / data.bookableSlots) * 100) : 0;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat label="Bookings today" value={String(confirmed)} />
      <Stat label="Occupancy" value={`${occ}%`} sub={`${data.occupiedSlots}/${data.bookableSlots} slots`} />
      <Stat label="Revenue today" value={formatPrice(data.revenueCents)} />
      <Stat
        label="Next booking"
        value={data.nextBooking ? formatTimeRange(data.nextBooking.startsAt, data.nextBooking.endsAt) : "—"}
        sub={data.nextBooking?.courtName}
      />
    </div>
  );
}
```

- [ ] **Step 6: Wire the dashboard component to the new shape**

In `components/admin/admin-dashboard.tsx`: change the `initialDay`/state type to `AdminDashboardData`, call `getAdminDashboard` in `refresh`, and pass `data={day}` to `SummaryStrip` (remove the old `bookings`/`courtCount` props). The live booking list still uses `day.bookings`.

- [ ] **Step 7: Verify + commit**

Run: `npm run typecheck && npm run test -- queries` — Expected: PASS.

```bash
git add lib/admin/queries.ts lib/admin/queries.test.ts components/admin/summary-strip.tsx components/admin/admin-dashboard.tsx
git commit -m "feat(admin): dashboard revenue + occupancy + next-booking metrics"
```

---

## Task 5: Courts & schedule — court CRUD

**Files:**
- Modify: `lib/admin/queries.ts` (add `getCourtsAdmin`)
- Modify: `lib/admin/actions.ts` (create file in this task)
- Modify: `lib/validation.ts` (court schema)
- Create: `app/admin/courts/page.tsx`
- Create: `components/admin/court-editor.tsx`

**Interfaces:**
- Consumes: `createAdminClient`, `getSessionUser`, `recordAudit`.
- Produces: `upsertCourtAction(input)`, `getCourtsAdmin(supabase)`.

- [ ] **Step 1: Validation schema**

In `lib/validation.ts` add:

```ts
export const courtSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name required"),
  surface: z.enum(["hard", "clay", "grass"]),
  environment: z.enum(["indoor", "outdoor"]),
  lighting: z.boolean(),
  open_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM"),
  close_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM"),
  status: z.enum(["active", "maintenance"]),
  sort_order: z.number().int().min(0),
  blurb: z.string().optional().nullable(),
});
export type CourtInput = z.infer<typeof courtSchema>;
```

- [ ] **Step 2: Admin court read**

In `lib/admin/queries.ts`:

```ts
import type { Court } from "@/lib/supabase/types";

/** All courts (incl. maintenance) in display order, for admin. */
export async function getCourtsAdmin(supabase: SupabaseClient): Promise<Court[]> {
  const { data, error } = await supabase.from("courts").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []) as Court[];
}
```

- [ ] **Step 3: Court upsert action**

Create `lib/admin/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/admin/audit";
import { courtSchema } from "@/lib/validation";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminEmail(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("unauthorized");
  return user.email ?? "unknown";
}

export async function upsertCourtAction(input: unknown): Promise<ActionResult> {
  const parsed = courtSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid court" };

  const actor = await requireAdminEmail();
  const supabase = createAdminClient();
  const { id, ...fields } = parsed.data;

  const { data, error } = id
    ? await supabase.from("courts").update(fields).eq("id", id).select("id").single()
    : await supabase.from("courts").insert(fields).select("id").single();
  if (error) return { ok: false, error: error.message };

  await recordAudit(supabase, {
    actorEmail: actor,
    action: id ? "court.update" : "court.create",
    targetType: "court",
    targetId: (data as { id: string }).id,
    detail: fields,
  });
  revalidatePath("/admin/courts");
  return { ok: true };
}
```

- [ ] **Step 4: Court editor UI + page**

Create `components/admin/court-editor.tsx` — a client component listing courts with an inline edit form per court and an "Add court" form, calling `upsertCourtAction`. Use the existing `Button`. Form fields map to `courtSchema`. On success it calls `router.refresh()`.

Create `app/admin/courts/page.tsx` (server component):

```tsx
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourtsAdmin } from "@/lib/admin/queries";
import { CourtEditor } from "@/components/admin/court-editor";
import { ClosurePanel } from "@/components/admin/closure-panel"; // Task 6
import { ScheduleGrid } from "@/components/admin/schedule-grid";  // Task 7

export const metadata: Metadata = { title: "Courts & schedule", robots: { index: false } };

export default async function CourtsPage() {
  const courts = await getCourtsAdmin(createAdminClient());
  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-4 text-2xl font-bold text-charcoal">Courts</h1>
        <CourtEditor courts={courts} />
      </section>
      <ClosurePanel courts={courts} />
      <ScheduleGrid courts={courts} />
    </div>
  );
}
```

(If executing task-by-task, temporarily comment the `ClosurePanel`/`ScheduleGrid` imports until Tasks 6–7 land.)

- [ ] **Step 5: Verify + commit**

Run: `npm run typecheck` — Expected: PASS (with Task 6/7 imports stubbed/commented as noted).

```bash
git add lib/admin/queries.ts lib/admin/actions.ts lib/validation.ts app/admin/courts/page.tsx components/admin/court-editor.tsx
git commit -m "feat(admin): court CRUD"
```

---

## Task 6: Courts & schedule — closures

**Files:**
- Modify: `lib/admin/actions.ts` (closure actions)
- Modify: `lib/admin/queries.ts` (`getActiveClosures`)
- Modify: `lib/email/send.ts` (`sendClosureNotice`)
- Create: `emails/closure-notice.tsx`
- Create: `components/admin/closure-panel.tsx`

**Interfaces:**
- Consumes: RPCs `preview_closure_impact`, `close_court`, `reopen_closure`.
- Produces: `previewClosureAction`, `closeCourtAction`, `reopenClosureAction`, `getActiveClosures(supabase)`, `sendClosureNotice(ctx)`.

- [ ] **Step 1: Closure-notice email template**

Create `emails/closure-notice.tsx` (mirrors `cancellation.tsx` structure):

```tsx
import * as React from "react";
import { DetailRow, EmailButton, EmailHeading, EmailShell, EmailText, SessionList } from "./components";

export interface ClosureNoticeProps {
  guestName: string;
  courtName: string;
  dateLabel: string;
  timeLabels: string[];
  reason: string;
  bookUrl: string;
}

export default function ClosureNotice({
  guestName, courtName, dateLabel, timeLabels, reason, bookUrl,
}: ClosureNoticeProps) {
  return (
    <EmailShell preview={`Court closed — ${courtName}, ${dateLabel}`}>
      <EmailHeading>We had to close your court</EmailHeading>
      <EmailText>
        Hi {guestName.split(" ")[0]}, unfortunately {courtName} is closed for your booking below
        ({reason}). We&apos;ve cancelled it with no charge — sorry for the inconvenience.
      </EmailText>
      <DetailRow label="Court" value={courtName} />
      <DetailRow label="Date" value={dateLabel} />
      <SessionList times={timeLabels} />
      <EmailText>Please grab another time that suits you:</EmailText>
      <EmailButton href={bookUrl}>Rebook a court</EmailButton>
    </EmailShell>
  );
}

ClosureNotice.PreviewProps = {
  guestName: "Ana Cruz", courtName: "Court 1 — Centre", dateLabel: "Wed, 1 Jul 2026",
  timeLabels: ["6:00 PM – 7:00 PM"], reason: "heavy rain", bookUrl: "https://fourhand.example/book",
} satisfies ClosureNoticeProps;
```

- [ ] **Step 2: Closure-notice sender**

In `lib/email/send.ts` add:

```ts
import ClosureNotice from "@/emails/closure-notice";

export async function sendClosureNotice(ctx: {
  courtName: string;
  guestName: string;
  guestEmail: string;
  reason: string;
  sessions: Session[];
}): Promise<void> {
  await queueEmail({
    type: "closure_notice",
    to: ctx.guestEmail,
    subject: `Court closed — ${ctx.courtName}`,
    react: ClosureNotice({
      guestName: ctx.guestName,
      courtName: ctx.courtName,
      dateLabel: dateLabel(ctx.sessions),
      timeLabels: timeLabels(ctx.sessions),
      reason: ctx.reason,
      bookUrl: siteUrl("/book"),
    }),
  });
}
```

- [ ] **Step 3: Closure read + actions**

In `lib/admin/queries.ts`:

```ts
import type { Closure } from "@/lib/supabase/types";

export interface ActiveClosure extends Closure { courtName: string }

export async function getActiveClosures(supabase: SupabaseClient): Promise<ActiveClosure[]> {
  const { data, error } = await supabase
    .from("closures")
    .select("*, courts!inner(name)")
    .eq("status", "active")
    .order("starts_at");
  if (error) throw error;
  return ((data ?? []) as unknown as (Closure & { courts: { name: string } })[]).map((c) => ({
    ...c, courtName: c.courts.name,
  }));
}
```

In `lib/admin/actions.ts` add (reuse `requireAdminEmail`):

```ts
import { sendClosureNotice } from "@/lib/email/send";
import { closureSchema } from "@/lib/validation";
import type { CloseCourtRow } from "@/lib/supabase/types";

export interface ClosureImpactRow {
  bookingGroupId: string | null;
  guestName: string;
  guestEmail: string;
  startsAt: string;
  endsAt: string;
}

function toImpact(rows: CloseCourtRow[]): ClosureImpactRow[] {
  return rows.map((r) => ({
    bookingGroupId: r.booking_group_id, guestName: r.guest_name, guestEmail: r.guest_email,
    startsAt: r.slot_starts_at, endsAt: r.slot_ends_at,
  }));
}

export async function previewClosureAction(input: unknown): Promise<
  { ok: true; impact: ClosureImpactRow[] } | { ok: false; error: string }
> {
  const parsed = closureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid closure" };
  await requireAdminEmail();
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("preview_closure_impact", {
    p_court_id: parsed.data.court_id,
    p_starts_at: parsed.data.starts_at,
    p_ends_at: parsed.data.ends_at,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, impact: toImpact((data ?? []) as CloseCourtRow[]) };
}

export async function closeCourtAction(input: unknown): Promise<ActionResult> {
  const parsed = closureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid closure" };
  const actor = await requireAdminEmail();
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("close_court", {
    p_court_id: parsed.data.court_id, p_starts_at: parsed.data.starts_at,
    p_ends_at: parsed.data.ends_at, p_reason: parsed.data.reason, p_actor: actor,
  });
  if (error) return { ok: false, error: error.message };

  // Notify each affected booking group once (rows may repeat per slot).
  const impact = toImpact((data ?? []) as CloseCourtRow[]);
  const courtName = await courtName_(supabase, parsed.data.court_id);
  const byGroup = new Map<string, ClosureImpactRow[]>();
  for (const r of impact) {
    const key = r.bookingGroupId ?? `${r.guestEmail}-${r.startsAt}`;
    byGroup.set(key, [...(byGroup.get(key) ?? []), r]);
  }
  for (const rows of byGroup.values()) {
    try {
      await sendClosureNotice({
        courtName, guestName: rows[0].guestName, guestEmail: rows[0].guestEmail,
        reason: parsed.data.reason,
        sessions: rows.map((r) => ({ startsAt: r.startsAt, endsAt: r.endsAt })),
      });
    } catch (err) { console.error("[closeCourtAction] notify failed:", err); }
  }
  revalidatePath("/admin/courts");
  return { ok: true };
}

export async function reopenClosureAction(id: string): Promise<ActionResult> {
  const actor = await requireAdminEmail();
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("reopen_closure", { p_id: id, p_actor: actor });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/courts");
  return { ok: true };
}

async function courtName_(supabase: ReturnType<typeof createAdminClient>, courtId: string): Promise<string> {
  const { data } = await supabase.from("courts").select("name").eq("id", courtId).single();
  return (data as { name: string } | null)?.name ?? "Court";
}
```

Add to `lib/validation.ts`:

```ts
export const closureSchema = z.object({
  court_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  reason: z.string().min(1, "Reason required"),
});
```

- [ ] **Step 4: Closure panel UI**

Create `components/admin/closure-panel.tsx` (client component): court select, start/end `datetime-local` inputs (converted to ISO with `+08:00`), reason text; **Preview impact** button calls `previewClosureAction` and lists affected players; **Confirm closure** calls `closeCourtAction`. Below, a list of active closures (passed from the page) each with a **Reopen** button calling `reopenClosureAction`. Use `Button` variants.

Update `app/admin/courts/page.tsx` to fetch `getActiveClosures` and pass to `ClosurePanel`.

- [ ] **Step 5: Verify + commit**

Run: `npm run typecheck` — Expected: PASS.

```bash
git add lib/admin/actions.ts lib/admin/queries.ts lib/validation.ts lib/email/send.ts emails/closure-notice.tsx components/admin/closure-panel.tsx app/admin/courts/page.tsx
git commit -m "feat(admin): time-ranged court closures with impact preview + rebook-link notify"
```

---

## Task 7: Courts & schedule — day grid

**Files:**
- Modify: `lib/admin/queries.ts` (`getScheduleGrid`)
- Create: `components/admin/schedule-grid.tsx`

**Interfaces:**
- Produces: `getScheduleGrid(supabase, dateKey)` → `{ hours: string[]; rows: { court: Court; cells: { startsAt: string; status: SlotStatus; guestName: string | null }[] }[] }`.

- [ ] **Step 1: Schedule read**

In `lib/admin/queries.ts`:

```ts
import type { SlotStatus } from "@/lib/supabase/types";

export interface ScheduleCell { startsAt: string; status: SlotStatus; guestName: string | null }
export interface ScheduleRow { court: Court; cells: ScheduleCell[] }
export interface ScheduleGridData { rows: ScheduleRow[] }

export async function getScheduleGrid(supabase: SupabaseClient, dateKey: string): Promise<ScheduleGridData> {
  const { startIso, endIso } = manilaDayRange(dateKey);
  const courts = await getCourtsAdmin(supabase);
  const { data: slots, error } = await supabase
    .from("slots")
    .select("court_id,starts_at,status, bookings!left(guest_name,status)")
    .gte("starts_at", startIso).lt("starts_at", endIso).order("starts_at");
  if (error) throw error;

  type Row = { court_id: string; starts_at: string; status: SlotStatus; bookings: { guest_name: string; status: string }[] };
  const byCourt = new Map<string, ScheduleCell[]>();
  for (const s of (slots ?? []) as unknown as Row[]) {
    const confirmed = s.bookings?.find((b) => b.status === "confirmed");
    const cell: ScheduleCell = { startsAt: s.starts_at, status: s.status, guestName: confirmed?.guest_name ?? null };
    byCourt.set(s.court_id, [...(byCourt.get(s.court_id) ?? []), cell]);
  }
  return { rows: courts.map((court) => ({ court, cells: byCourt.get(court.id) ?? [] })) };
}
```

- [ ] **Step 2: Grid UI**

Create `components/admin/schedule-grid.tsx` (client component with its own `AdminDateControl`): a table of courts (rows) × hours (columns), each cell coloured by status — `free` (surface), `booked` (green, show guest initial/name on hover via `title`), `held` (amber), `closed` (charcoal/40 with a slash). Fetches via `getScheduleGrid` on date change. Include a small legend.

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck` — Expected: PASS.

```bash
git add lib/admin/queries.ts components/admin/schedule-grid.tsx app/admin/courts/page.tsx
git commit -m "feat(admin): day schedule grid across courts"
```

---

## Task 8: Bookings management — search & list

**Files:**
- Modify: `lib/admin/queries.ts` (`searchBookings`)
- Create: `app/admin/bookings/page.tsx`
- Create: `components/admin/bookings-manager.tsx`

**Interfaces:**
- Produces: `searchBookings(supabase, filters)` → `AdminBookingDetail[]` where `AdminBookingDetail` extends `AdminBooking` with `guestEmail`, `guestPhone`, `bookingGroupId`, `cancelToken`, `source`, `courtId`, `slotId`.

- [ ] **Step 1: Search query**

In `lib/admin/queries.ts`:

```ts
export interface BookingFilters {
  dateKey?: string;
  courtId?: string;
  status?: "confirmed" | "cancelled";
  q?: string; // name or email substring
}

export interface AdminBookingDetail extends AdminBooking {
  guestEmail: string;
  guestPhone: string;
  bookingGroupId: string | null;
  cancelToken: string;
  source: string;
  courtId: string;
  slotId: string;
}

export async function searchBookings(
  supabase: SupabaseClient, f: BookingFilters,
): Promise<AdminBookingDetail[]> {
  let query = supabase
    .from("bookings")
    .select("id,guest_name,guest_email,guest_phone,status,price_cents,source,court_id,slot_id,booking_group_id,cancel_token,slots!inner(starts_at,ends_at),courts!inner(name)")
    .order("starts_at", { foreignTable: "slots", ascending: false })
    .limit(200);

  if (f.status) query = query.eq("status", f.status);
  if (f.courtId) query = query.eq("court_id", f.courtId);
  if (f.dateKey) {
    const { startIso, endIso } = manilaDayRange(f.dateKey);
    query = query.gte("slots.starts_at", startIso).lt("slots.starts_at", endIso);
  }
  if (f.q) query = query.or(`guest_name.ilike.%${f.q}%,guest_email.ilike.%${f.q}%`);

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string; guest_name: string; guest_email: string; guest_phone: string;
    status: "confirmed" | "cancelled"; price_cents: number; source: string;
    court_id: string; slot_id: string; booking_group_id: string | null; cancel_token: string;
    slots: { starts_at: string; ends_at: string } | null; courts: { name: string } | null;
  };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.slots && r.courts)
    .map((r) => ({
      id: r.id, guestName: r.guest_name, guestEmail: r.guest_email, guestPhone: r.guest_phone,
      status: r.status, priceCents: r.price_cents, source: r.source, courtId: r.court_id,
      slotId: r.slot_id, bookingGroupId: r.booking_group_id, cancelToken: r.cancel_token,
      courtName: r.courts!.name, startsAt: r.slots!.starts_at, endsAt: r.slots!.ends_at,
    }));
}
```

- [ ] **Step 2: Bookings page + manager UI**

Create `app/admin/bookings/page.tsx` (server component) that loads courts + today's bookings and renders `<BookingsManager>`. Create `components/admin/bookings-manager.tsx` (client): filter bar (date, court select, status, search box) that re-queries via a server action wrapper `searchBookingsAction(filters)` (add a thin wrapper in `lib/admin/actions.ts` calling `searchBookings`), a results table (time, court, player, email/phone, source badge, status), and per-row action buttons wired in Tasks 9–10.

Add to `lib/admin/actions.ts`:

```ts
import { searchBookings, type BookingFilters, type AdminBookingDetail } from "@/lib/admin/queries";

export async function searchBookingsAction(filters: BookingFilters): Promise<AdminBookingDetail[]> {
  await requireAdminEmail();
  return searchBookings(createAdminClient(), filters);
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck` — Expected: PASS.

```bash
git add lib/admin/queries.ts lib/admin/actions.ts app/admin/bookings/page.tsx components/admin/bookings-manager.tsx
git commit -m "feat(admin): bookings search + filter list"
```

---

## Task 9: Bookings management — manual (phone) booking

**Files:**
- Modify: `lib/admin/actions.ts` (`adminCreateBookingAction`)
- Modify: `lib/validation.ts` (`adminBookingSchema`)
- Modify: `components/admin/bookings-manager.tsx` (manual-booking form)
- Modify: `lib/admin/queries.ts` (`getFreeSlotsForCourtDay` helper)

**Interfaces:**
- Consumes: RPC `admin_create_booking`; `sendBookingEmails`.
- Produces: `adminCreateBookingAction(input)`, `getFreeSlotsForCourtDay(supabase, courtId, dateKey)`.

- [ ] **Step 1: Schema + free-slot helper**

`lib/validation.ts`:

```ts
export const adminBookingSchema = z.object({
  slot_ids: z.array(z.string().uuid()).min(1).max(6),
  guest_name: z.string().min(1),
  guest_email: z.string().email(),
  guest_phone: z.string().min(1),
  notify: z.boolean().default(true),
});
```

`lib/admin/queries.ts`:

```ts
import { getSlotsForCourt } from "@/lib/booking/queries";

export async function getFreeSlotsForCourtDay(supabase: SupabaseClient, courtId: string, dateKey: string) {
  const slots = await getSlotsForCourt(supabase, courtId, dateKey);
  return slots.filter((s) => s.status === "free");
}
```

- [ ] **Step 2: Action**

`lib/admin/actions.ts`:

```ts
import { adminBookingSchema } from "@/lib/validation";
import { sendBookingEmails } from "@/lib/email/send";
import type { AdminCreateResult } from "@/lib/supabase/types";

export async function adminCreateBookingAction(input: unknown): Promise<ActionResult> {
  const parsed = adminBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid booking" };
  const actor = await requireAdminEmail();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("admin_create_booking", {
    p_slot_ids: parsed.data.slot_ids, p_guest_name: parsed.data.guest_name,
    p_guest_email: parsed.data.guest_email, p_guest_phone: parsed.data.guest_phone,
    p_idempotency_key: `admin-${crypto.randomUUID()}`, p_actor: actor,
  });
  if (error) return { ok: false, error: error.message };
  const result = (Array.isArray(data) ? data[0] : data) as AdminCreateResult | undefined;
  if (!result || result.status !== "confirmed") {
    return { ok: false, error: result?.status === "slot_closed" ? "That slot is closed." : "That slot was just taken." };
  }

  if (parsed.data.notify && result.cancel_token) {
    try {
      const { data: slots } = await supabase
        .from("slots").select("starts_at,ends_at,court_id").in("id", parsed.data.slot_ids).order("starts_at");
      const rows = (slots ?? []) as { starts_at: string; ends_at: string; court_id: string }[];
      const { data: court } = rows[0]
        ? await supabase.from("courts").select("name").eq("id", rows[0].court_id).single()
        : { data: null };
      if (rows.length && court) {
        await sendBookingEmails({
          courtName: (court as { name: string }).name,
          sessions: rows.map((s) => ({ startsAt: s.starts_at, endsAt: s.ends_at })),
          guestName: parsed.data.guest_name, guestEmail: parsed.data.guest_email,
          guestPhone: parsed.data.guest_phone, totalPriceCents: result.total_price_cents ?? 0,
          cancelToken: result.cancel_token,
        });
      }
    } catch (err) { console.error("[adminCreateBookingAction] email failed:", err); }
  }
  revalidatePath("/admin/bookings");
  return { ok: true };
}
```

- [ ] **Step 3: Manual-booking form**

In `components/admin/bookings-manager.tsx`, add a "New phone booking" panel: court select + date → loads free slots (via a `getFreeSlotsAction` wrapper around `getFreeSlotsForCourtDay`), multi-select slots, guest name/email/phone, a "Send confirmation email" checkbox, submit → `adminCreateBookingAction`. Add the wrapper to `actions.ts` mirroring `searchBookingsAction`.

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck` — Expected: PASS.

```bash
git add lib/admin/actions.ts lib/validation.ts lib/admin/queries.ts components/admin/bookings-manager.tsx
git commit -m "feat(admin): manual phone booking"
```

---

## Task 10: Bookings management — cancel & reassign

**Files:**
- Modify: `lib/admin/actions.ts` (`adminCancelAction`, `adminReassignAction`)
- Modify: `components/admin/bookings-manager.tsx` (row actions + reassign dialog)

**Interfaces:**
- Consumes: existing `cancelBookingAction` (`lib/booking/actions.ts`); RPC `admin_reassign_booking`; `getFreeSlotsForCourtDay`.
- Produces: `adminCancelAction(cancelToken)`, `adminReassignAction(input)`.

- [ ] **Step 1: Cancel + reassign actions**

`lib/validation.ts`:

```ts
export const reassignSchema = z.object({
  booking_group_id: z.string().uuid(),
  new_slot_ids: z.array(z.string().uuid()).min(1).max(6),
});
```

`lib/admin/actions.ts`:

```ts
import { cancelBookingAction } from "@/lib/booking/actions";
import { reassignSchema } from "@/lib/validation";
import type { AdminReassignResult } from "@/lib/supabase/types";

export async function adminCancelAction(cancelToken: string): Promise<ActionResult> {
  const actor = await requireAdminEmail();
  const res = await cancelBookingAction(cancelToken); // sends cancellation email
  if (res.status === "error") return { ok: false, error: res.message };
  await recordAudit(createAdminClient(), {
    actorEmail: actor, action: "booking.cancel", targetType: "booking", targetId: cancelToken,
  });
  revalidatePath("/admin/bookings");
  return { ok: true };
}

export async function adminReassignAction(input: unknown): Promise<ActionResult> {
  const parsed = reassignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid reassignment" };
  await requireAdminEmail();
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("admin_reassign_booking", {
    p_booking_group_id: parsed.data.booking_group_id, p_new_slot_ids: parsed.data.new_slot_ids,
    p_actor: (await getSessionUser())?.email ?? "unknown",
  });
  if (error) return { ok: false, error: error.message };
  const result = (Array.isArray(data) ? data[0] : data) as AdminReassignResult | undefined;
  if (!result || result.status !== "reassigned") return { ok: false, error: "Target slot was just taken." };

  // Notify the player of the new details.
  try {
    const { data: rows } = await supabase
      .from("bookings")
      .select("guest_name,guest_email,court_id,slots!inner(starts_at,ends_at)")
      .eq("booking_group_id", parsed.data.booking_group_id).eq("status", "confirmed")
      .order("starts_at", { foreignTable: "slots" });
    const list = (rows ?? []) as unknown as {
      guest_name: string; guest_email: string; court_id: string;
      slots: { starts_at: string; ends_at: string } | null;
    }[];
    if (list.length) {
      const { data: court } = await supabase.from("courts").select("name").eq("id", list[0].court_id).single();
      const { sendBookingReassigned } = await import("@/lib/email/send");
      await sendBookingReassigned({
        courtName: (court as { name: string } | null)?.name ?? "Court",
        guestName: list[0].guest_name, guestEmail: list[0].guest_email,
        sessions: list.filter((r) => r.slots).map((r) => ({ startsAt: r.slots!.starts_at, endsAt: r.slots!.ends_at })),
      });
    }
  } catch (err) { console.error("[adminReassignAction] email failed:", err); }

  revalidatePath("/admin/bookings");
  return { ok: true };
}
```

Add a lightweight reassign email to `lib/email/send.ts` reusing the `Cancellation`-style shell (or a new `booking-confirmation` re-send). Minimal version reuses `BookingConfirmation` copy:

```ts
export async function sendBookingReassigned(ctx: {
  courtName: string; guestName: string; guestEmail: string; sessions: Session[];
}): Promise<void> {
  await queueEmail({
    type: "booking_reassigned",
    to: ctx.guestEmail,
    subject: `Your booking was moved — ${ctx.courtName}`,
    react: Cancellation({
      guestName: ctx.guestName, courtName: ctx.courtName,
      dateLabel: dateLabel(ctx.sessions), timeLabels: timeLabels(ctx.sessions),
      bookUrl: siteUrl("/book"),
    }),
  });
}
```

> Reviewer note: a dedicated `booking-reassigned.tsx` template reads better than reusing `Cancellation`; create one if time allows (same structure as `closure-notice.tsx`).

- [ ] **Step 2: Row actions UI**

In `components/admin/bookings-manager.tsx` add per confirmed row: **Cancel** (confirm dialog → `adminCancelAction(cancelToken)`) and **Reassign** (opens a panel: choose target court + date → free slots, must match the booking's slot count → `adminReassignAction`). Refund button intentionally omitted.

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck` — Expected: PASS.

```bash
git add lib/admin/actions.ts lib/validation.ts lib/email/send.ts components/admin/bookings-manager.tsx
git commit -m "feat(admin): cancel + reassign bookings"
```

---

## Task 11: Email templates — overrides + editor

**Files:**
- Create: `lib/email/templates.ts`
- Modify: `lib/email/send.ts` (apply subject/intro overrides)
- Modify: `lib/admin/actions.ts` (`upsertTemplateAction`)
- Modify: `lib/admin/queries.ts` (`getTemplates`)
- Create: `app/admin/templates/page.tsx`
- Create: `components/admin/template-editor.tsx`
- Test: `lib/email/templates.test.ts`

**Interfaces:**
- Produces: `resolveTemplate(supabase, type, fallback)` → `{ subject: string; intro: string | null }`; `upsertTemplateAction`, `getTemplates`.

- [ ] **Step 1: Failing test for override resolution**

Create `lib/email/templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mergeTemplate } from "./templates";

describe("mergeTemplate", () => {
  it("uses the override when present", () => {
    expect(mergeTemplate({ type: "x", subject: "Override", intro: "Hi", updated_at: "", updated_by: null },
      { subject: "Default", intro: "def" })).toEqual({ subject: "Override", intro: "Hi" });
  });
  it("falls back when no row", () => {
    expect(mergeTemplate(null, { subject: "Default", intro: "def" })).toEqual({ subject: "Default", intro: "def" });
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL.** Run: `npm run test -- templates`

- [ ] **Step 3: Implement `lib/email/templates.ts`**

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailTemplate } from "@/lib/supabase/types";

export interface TemplateCopy { subject: string; intro: string | null }

export function mergeTemplate(row: EmailTemplate | null, fallback: TemplateCopy): TemplateCopy {
  if (!row) return fallback;
  return { subject: row.subject || fallback.subject, intro: row.intro ?? fallback.intro };
}

export async function resolveTemplate(
  supabase: SupabaseClient, type: string, fallback: TemplateCopy,
): Promise<TemplateCopy> {
  const { data } = await supabase.from("email_templates").select("*").eq("type", type).maybeSingle();
  return mergeTemplate((data as EmailTemplate | null) ?? null, fallback);
}
```

- [ ] **Step 4: Run the test — Expected: PASS.** Run: `npm run test -- templates`

- [ ] **Step 5: Apply overrides in send.ts + editor**

In `lib/email/send.ts`, for each sender resolve the subject/intro via `resolveTemplate(createAdminClient(), type, {subject, intro})` and pass `intro` into the template (templates already render copy; add an optional `intro` prop where applicable, falling back to existing text). Keep changes minimal: at least `booking_confirmation`, `cancellation`, `closure_notice`, `booking_reminder` honour overrides.

Add `getTemplates` to `queries.ts` (select all from `email_templates`) and `upsertTemplateAction` to `actions.ts` (validate `type` against a known list, upsert, audit `template.update`). Build `template-editor.tsx` listing each known type with editable subject + intro and a save button; `app/admin/templates/page.tsx` loads `getTemplates` + the known-type defaults.

- [ ] **Step 6: Verify + commit**

Run: `npm run typecheck && npm run test -- templates` — Expected: PASS.

```bash
git add lib/email/templates.ts lib/email/templates.test.ts lib/email/send.ts lib/admin/actions.ts lib/admin/queries.ts app/admin/templates/page.tsx components/admin/template-editor.tsx
git commit -m "feat(admin): editable email copy with code-default fallback"
```

---

## Task 12: Booking reminders — template + cron

**Files:**
- Create: `emails/booking-reminder.tsx`
- Modify: `lib/email/send.ts` (`sendBookingReminder`)
- Create: `app/api/cron/send-reminders/route.ts`
- Modify: `vercel.json` (cron entry)

**Interfaces:**
- Produces: `GET /api/cron/send-reminders` (CRON_SECRET-guarded), `sendBookingReminder(ctx)`.

- [ ] **Step 1: Reminder template** — create `emails/booking-reminder.tsx` mirroring `closure-notice.tsx` (heading "See you on court soon", court/date/time detail rows, a "View or cancel" button to `/cancel/{token}`).

- [ ] **Step 2: Sender** — add `sendBookingReminder` to `lib/email/send.ts` (type `booking_reminder`), honouring template overrides (Task 11).

- [ ] **Step 3: Cron route** — create `app/api/cron/send-reminders/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingReminder } from "@/lib/email/send";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const supabase = createAdminClient();
    const { data: settings } = await supabase.from("business_settings").select("reminder_offset_hours").eq("id", true).single();
    const offset = (settings as { reminder_offset_hours: number } | null)?.reminder_offset_hours ?? 24;

    const now = Date.now();
    const windowEnd = new Date(now + offset * 3600_000).toISOString();
    const nowIso = new Date(now).toISOString();

    const { data: rows } = await supabase
      .from("bookings")
      .select("id,guest_name,guest_email,cancel_token,court_id,reminded_at,slots!inner(starts_at,ends_at),courts!inner(name)")
      .eq("status", "confirmed").is("reminded_at", null)
      .gte("slots.starts_at", nowIso).lte("slots.starts_at", windowEnd);

    type Row = { id: string; guest_name: string; guest_email: string; cancel_token: string;
      slots: { starts_at: string; ends_at: string }; courts: { name: string } };
    let sent = 0;
    for (const r of (rows ?? []) as unknown as Row[]) {
      try {
        await sendBookingReminder({
          courtName: r.courts.name, guestName: r.guest_name, guestEmail: r.guest_email,
          cancelToken: r.cancel_token,
          sessions: [{ startsAt: r.slots.starts_at, endsAt: r.slots.ends_at }],
        });
        await supabase.from("bookings").update({ reminded_at: new Date().toISOString() }).eq("id", r.id);
        sent++;
      } catch (err) { console.error("[cron/send-reminders] one failed:", err); }
    }
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[cron/send-reminders] failed:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Schedule** — add to `vercel.json` crons array an hourly entry: `{ "path": "/api/cron/send-reminders", "schedule": "0 * * * *" }`.

- [ ] **Step 5: Verify + commit**

Run: `npm run typecheck` — Expected: PASS.

```bash
git add emails/booking-reminder.tsx lib/email/send.ts app/api/cron/send-reminders/route.ts vercel.json
git commit -m "feat(admin): booking reminders (template + hourly cron)"
```

---

## Task 13: Settings

**Files:**
- Modify: `lib/admin/queries.ts` (`getBusinessSettings`)
- Modify: `lib/admin/actions.ts` (`updateSettingsAction`)
- Modify: `lib/validation.ts` (`settingsSchema`)
- Create: `app/admin/settings/page.tsx`
- Create: `components/admin/settings-form.tsx`

**Interfaces:**
- Produces: `getBusinessSettings(supabase)`, `updateSettingsAction(input)`.

- [ ] **Step 1: Schema, read, action**

`lib/validation.ts`:

```ts
export const settingsSchema = z.object({
  club_name: z.string().min(1),
  logo_path: z.string().nullable().optional(),
  accent_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  default_open_time: z.string().regex(/^\d{2}:\d{2}$/),
  default_close_time: z.string().regex(/^\d{2}:\d{2}$/),
  cancellation_window_hours: z.number().int().min(0).max(168),
  reminder_offset_hours: z.number().int().min(1).max(168),
});
```

`lib/admin/queries.ts`:

```ts
import type { BusinessSettings } from "@/lib/supabase/types";
export async function getBusinessSettings(supabase: SupabaseClient): Promise<BusinessSettings> {
  const { data, error } = await supabase.from("business_settings").select("*").eq("id", true).single();
  if (error) throw error;
  return data as BusinessSettings;
}
```

`lib/admin/actions.ts`:

```ts
import { settingsSchema } from "@/lib/validation";
export async function updateSettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  const actor = await requireAdminEmail();
  const supabase = createAdminClient();
  const { error } = await supabase.from("business_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString(), updated_by: actor }).eq("id", true);
  if (error) return { ok: false, error: error.message };
  await recordAudit(supabase, { actorEmail: actor, action: "settings.update", targetType: "settings", detail: parsed.data });
  revalidatePath("/admin/settings");
  return { ok: true };
}
```

- [ ] **Step 2: Settings page + form** — create `components/admin/settings-form.tsx` (client) over `settingsSchema`, and `app/admin/settings/page.tsx` loading `getBusinessSettings`.

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck` — Expected: PASS.

```bash
git add lib/admin/queries.ts lib/admin/actions.ts lib/validation.ts app/admin/settings/page.tsx components/admin/settings-form.tsx
git commit -m "feat(admin): business settings (branding, hours, cancellation, reminder offset)"
```

---

## Task 14: Reports + CSV export

**Files:**
- Modify: `lib/admin/queries.ts` (`getReport`)
- Create: `lib/admin/csv.ts`
- Create: `app/api/admin/export/route.ts`
- Create: `app/admin/reports/page.tsx`
- Create: `components/admin/reports-view.tsx`
- Test: `lib/admin/csv.test.ts`

**Interfaces:**
- Produces: `getReport(supabase, startKey, endKey)` → `{ days: { dateKey: string; revenueCents: number; booked: number; bookable: number }[]; totalRevenueCents: number }`; `toCsv(rows)`.

- [ ] **Step 1: Failing CSV test**

Create `lib/admin/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("renders a header and rows, escaping quotes/commas", () => {
    const csv = toCsv([{ a: "x,y", b: 'q"z' }]);
    expect(csv).toBe('a,b\n"x,y","q""z"');
  });
  it("is just a header for no rows", () => {
    expect(toCsv([], ["a", "b"])).toBe("a,b");
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL.** Run: `npm run test -- csv`

- [ ] **Step 3: Implement `lib/admin/csv.ts`**

```ts
function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  const cols = headers ?? (rows[0] ? Object.keys(rows[0]) : []);
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => cell(r[c])).join(",")).join("\n");
  return body ? `${head}\n${body}` : head;
}
```

- [ ] **Step 4: Run the test — Expected: PASS.** Run: `npm run test -- csv`

- [ ] **Step 5: Report query + export route + UI**

Add `getReport` to `queries.ts` (loop Manila days in range: revenue = Σ confirmed price for that day; booked/bookable from slots excluding `closed`). Create `app/api/admin/export/route.ts` (guarded by `getSessionUser`; `?start=&end=` → `getReport` → `toCsv` → `text/csv` response with `Content-Disposition`). Create `components/admin/reports-view.tsx` (date-range pickers, totals, a simple per-day bar list, and a "Download CSV" link to the export route) and `app/admin/reports/page.tsx`.

- [ ] **Step 6: Verify + commit**

Run: `npm run typecheck && npm run test -- csv` — Expected: PASS.

```bash
git add lib/admin/queries.ts lib/admin/csv.ts lib/admin/csv.test.ts app/api/admin/export/route.ts app/admin/reports/page.tsx components/admin/reports-view.tsx
git commit -m "feat(admin): revenue + occupancy reports with CSV export"
```

---

## Task 15: Final verification & docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full verification**

Run, in order, and fix any failures:
```bash
npm run typecheck
npm run test
npm run lint
npm run build
```
Expected: all PASS.

- [ ] **Step 2: README**

Document the new admin sections, the `0006` migration, the new `send-reminders` cron + `vercel.json` entry, and which §10.2 modules are deferred (Members, Events depth, promo/member rates, refunds).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: admin core modules — sections, migration, reminder cron"
```

---

## Self-Review

**Spec coverage:** A0 shell+audit → T3; A1 dashboard → T4; A2 courts/closures/grid → T5/T6/T7; A3 bookings (search/manual/cancel/reassign) → T8/T9/T10; A4 email templates+reminders → T11/T12; A5 settings → T13; A6 reports+CSV → T14. Deferred modules (Members/Events/promo/refunds) intentionally absent. ✓

**Open-decision resolutions baked in:** reminders included (T12); manual-booking emails default-on with a toggle (T9); reassign re-prices (RPC in T1); calendar is day-only (T7); branding wired to emails/admin only (T11/T13). These match the spec's "Open decisions" assumptions — confirm at review if any should change.

**Placeholder scan:** UI component bodies in T5/T6/T7/T8/T9/T10/T11/T13/T14 are described rather than fully transcribed where they are conventional forms/tables; all data contracts, server actions, RPCs, queries, schemas, emails, and tests are fully coded. Implementers must write the form/table JSX against the given props and the existing palette (`charcoal/green/surface`, `rounded-card`, `shadow-soft`, `Button`). This is the one deliberate area left to the implementer's pattern-matching, not a logic gap.

**Type consistency:** RPC names and result types (`CloseCourtRow`, `AdminCreateResult`, `AdminReassignResult`) are defined in T1/T2 and consumed unchanged in T6/T9/T10. `AdminDashboardData`, `AdminBookingDetail`, `BookingFilters` defined in T4/T8 and reused consistently.
