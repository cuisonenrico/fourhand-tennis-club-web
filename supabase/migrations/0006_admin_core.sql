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

  -- Lock affected confirmed booking rows so concurrent admin ops on the same bookings serialise.
  perform 1 from bookings b
   join slots s on s.id = b.slot_id
   where b.court_id = p_court_id and b.status = 'confirmed'
     and s.starts_at < p_ends_at and s.ends_at > p_starts_at
   for update of b;

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

  perform 1 from slots
   where id = any(p_new_slot_ids)
      or id in (select slot_id from bookings where booking_group_id = p_booking_group_id and status = 'confirmed')
   order by id for update;
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
