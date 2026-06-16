-- Multi-slot bookings (book several consecutive/!consecutive hours at once) and
-- a longer booking horizon. Adds a booking group so many slots share one
-- confirmation + cancel link, and group-aware hold/confirm/cancel RPCs.

-- ---------------------------------------------------------------------------
-- Schema: group id + per-slot idempotency
-- ---------------------------------------------------------------------------
alter table bookings add column if not exists booking_group_id uuid;
create index if not exists bookings_group_idx on bookings (booking_group_id);

-- A multi-slot confirm writes N rows sharing one idempotency_key, so uniqueness
-- moves from (idempotency_key) to (idempotency_key, slot_id).
drop index if exists bookings_idempotency_key_idx;
create unique index if not exists bookings_idem_slot_idx on bookings (idempotency_key, slot_id);

-- ---------------------------------------------------------------------------
-- Hold many slots at once — all-or-nothing.
-- ---------------------------------------------------------------------------
create or replace function hold_slots(
  p_slot_ids uuid[],
  p_hold_key text,
  p_minutes int default 5
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot slots%rowtype;
  v_expires timestamptz;
begin
  if coalesce(array_length(p_slot_ids, 1), 0) = 0 then
    raise exception 'no_slots' using errcode = 'P0001';
  end if;

  -- Lock all requested slots in a stable order; reject if any is unavailable.
  for v_slot in select * from slots where id = any(p_slot_ids) order by id for update loop
    if v_slot.status = 'booked' then
      raise exception 'slot_unavailable' using errcode = 'P0001';
    end if;
    if v_slot.status = 'held'
       and v_slot.hold_key is distinct from p_hold_key
       and v_slot.hold_expires_at > now() then
      raise exception 'slot_unavailable' using errcode = 'P0001';
    end if;
  end loop;

  v_expires := now() + make_interval(mins => p_minutes);
  update slots
  set status = 'held', hold_key = p_hold_key, hold_expires_at = v_expires
  where id = any(p_slot_ids);

  return v_expires;
end;
$$;

-- ---------------------------------------------------------------------------
-- Confirm a group of slots atomically. One winner per slot; one cancel token
-- and group id shared across the rows. Idempotent on p_idempotency_key.
-- ---------------------------------------------------------------------------
create or replace function confirm_booking_multi(
  p_slot_ids uuid[],
  p_hold_key text,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_idempotency_key text
) returns table (
  booking_group_id uuid,
  cancel_token uuid,
  total_price_cents integer,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_slot slots%rowtype;
  v_group uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
  v_total int := 0;
  v_price int;
  v_existing_group uuid;
  v_existing_token uuid;
  v_existing_total int;
begin
  if coalesce(array_length(p_slot_ids, 1), 0) = 0 then
    raise exception 'no_slots' using errcode = 'P0001';
  end if;

  -- Idempotency: a retried request returns the original group.
  select b.booking_group_id, b.cancel_token
    into v_existing_group, v_existing_token
  from bookings b
  where b.idempotency_key = p_idempotency_key
  limit 1;
  if found then
    select coalesce(sum(price_cents), 0) into v_existing_total
    from bookings where idempotency_key = p_idempotency_key;
    return query select v_existing_group, v_existing_token, v_existing_total, 'confirmed'::text;
    return;
  end if;

  -- All requested slots must exist.
  if (select count(*) from slots where id = any(p_slot_ids)) <> array_length(p_slot_ids, 1) then
    raise exception 'slot_not_found' using errcode = 'P0002';
  end if;

  -- Pass 1: lock every slot and verify it is still bookable. Any conflict aborts
  -- the whole group (no rows inserted, locks released on rollback).
  for v_slot in select * from slots where id = any(p_slot_ids) order by id for update loop
    if v_slot.status = 'booked' then
      return query select null::uuid, null::uuid, null::integer, 'slot_taken'::text;
      return;
    end if;
    if v_slot.status = 'held'
       and v_slot.hold_key is distinct from p_hold_key
       and v_slot.hold_expires_at > now() then
      return query select null::uuid, null::uuid, null::integer, 'slot_taken'::text;
      return;
    end if;
  end loop;

  -- Pass 2: insert one booking per slot, sharing group id + cancel token.
  for v_slot in select * from slots where id = any(p_slot_ids) order by starts_at loop
    v_price := resolve_price_cents(v_slot.starts_at);
    v_total := v_total + v_price;
    insert into bookings (
      court_id, slot_id, guest_name, guest_email, guest_phone,
      price_cents, idempotency_key, booking_group_id, cancel_token
    ) values (
      v_slot.court_id, v_slot.id, p_guest_name, p_guest_email, p_guest_phone,
      v_price, p_idempotency_key, v_group, v_token
    );
    update slots
    set status = 'booked', hold_key = null, hold_expires_at = null
    where id = v_slot.id;
  end loop;

  return query select v_group, v_token, v_total, 'confirmed'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancel an entire group by its shared token. Frees every slot.
-- (Replaces the single-row version from 0003.)
-- ---------------------------------------------------------------------------
drop function if exists cancel_booking(uuid);
create function cancel_booking(p_cancel_token uuid)
returns table (
  group_id uuid,
  guest_email text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_email text;
  v_group uuid;
  v_count int;
begin
  select count(*) into v_count from bookings where cancel_token = p_cancel_token;
  if v_count = 0 then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if (select bool_and(status = 'cancelled') from bookings where cancel_token = p_cancel_token) then
    select guest_email, booking_group_id into v_email, v_group
    from bookings where cancel_token = p_cancel_token limit 1;
    return query select v_group, v_email, 'already_cancelled'::text;
    return;
  end if;

  update slots set status = 'free', hold_key = null, hold_expires_at = null
  where id in (
    select slot_id from bookings where cancel_token = p_cancel_token and status = 'confirmed'
  );
  update bookings set status = 'cancelled' where cancel_token = p_cancel_token;

  select guest_email, booking_group_id into v_email, v_group
  from bookings where cancel_token = p_cancel_token limit 1;
  return query select v_group, v_email, 'cancelled'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants for the new/replaced functions (service role only).
-- ---------------------------------------------------------------------------
revoke execute on function hold_slots(uuid[], text, int) from public;
revoke execute on function confirm_booking_multi(uuid[], text, text, text, text, text) from public;
revoke execute on function cancel_booking(uuid) from public;

grant execute on function hold_slots(uuid[], text, int) to service_role;
grant execute on function confirm_booking_multi(uuid[], text, text, text, text, text) to service_role;
grant execute on function cancel_booking(uuid) to service_role;
