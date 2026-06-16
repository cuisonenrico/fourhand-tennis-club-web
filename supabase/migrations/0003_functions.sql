-- Fourhand Tennis Club — business logic in the database (Spec §4, Tech doc §7)
-- The booking-integrity guarantee lives here, not in app code.

-- ---------------------------------------------------------------------------
-- Slot generation — one 60-minute slot per court per open hour, per day.
-- Idempotent: re-running never duplicates (unique court_id+starts_at).
-- ---------------------------------------------------------------------------
create or replace function generate_slots_for_range(
  p_start_date date,
  p_end_date date
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_court courts%rowtype;
  v_day date;
  v_hour int;
  v_start timestamptz;
  v_inserted int := 0;
begin
  for v_court in select * from courts where status = 'active' loop
    v_day := p_start_date;
    while v_day <= p_end_date loop
      v_hour := extract(hour from v_court.open_time)::int;
      while v_hour < extract(hour from v_court.close_time)::int loop
        -- Interpret the wall-clock hour in Manila time.
        v_start := (v_day::text || ' ' || lpad(v_hour::text, 2, '0') || ':00:00 Asia/Manila')::timestamptz;
        insert into slots (court_id, starts_at, ends_at, status)
        values (v_court.id, v_start, v_start + interval '1 hour', 'free')
        on conflict (court_id, starts_at) do nothing;
        if found then
          v_inserted := v_inserted + 1;
        end if;
        v_hour := v_hour + 1;
      end loop;
      v_day := v_day + 1;
    end loop;
  end loop;
  return v_inserted;
end;
$$;

-- ---------------------------------------------------------------------------
-- Price resolution — peak vs off-peak by the slot's local hour.
-- Kept in sync with lib/pricing.ts (UI display).
-- ---------------------------------------------------------------------------
create or replace function resolve_price_cents(p_starts_at timestamptz)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_local_time time;
  v_rate int;
begin
  v_local_time := (p_starts_at at time zone 'Asia/Manila')::time;

  select rate_cents into v_rate
  from pricing_rules
  where is_member = false
    and scope = 'peak'
    and peak_start is not null
    and v_local_time >= peak_start
    and v_local_time < peak_end
  limit 1;

  if v_rate is not null then
    return v_rate;
  end if;

  select rate_cents into v_rate
  from pricing_rules
  where is_member = false and scope = 'off-peak'
  limit 1;

  return coalesce(v_rate, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Hold a slot at checkout-open (short-lived intent lock).
-- Succeeds if the slot is free, or already held by this same hold_key, or the
-- prior hold has expired. Raises 'slot_unavailable' otherwise.
-- ---------------------------------------------------------------------------
create or replace function hold_slot(
  p_slot_id uuid,
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
  select * into v_slot from slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot_not_found' using errcode = 'P0002';
  end if;

  if v_slot.status = 'booked' then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  if v_slot.status = 'held'
     and v_slot.hold_key is distinct from p_hold_key
     and v_slot.hold_expires_at > now() then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  v_expires := now() + make_interval(mins => p_minutes);
  update slots
  set status = 'held', hold_key = p_hold_key, hold_expires_at = v_expires
  where id = p_slot_id;

  return v_expires;
end;
$$;

-- ---------------------------------------------------------------------------
-- Confirm a booking — the one path that must be correct under concurrency.
-- Lock the slot row, verify it is bookable, insert booking, mark slot booked.
-- Idempotent via p_idempotency_key. Returns the booking or a 'slot_taken' row.
-- ---------------------------------------------------------------------------
create or replace function confirm_booking(
  p_slot_id uuid,
  p_hold_key text,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_idempotency_key text
) returns table (
  booking_id uuid,
  cancel_token uuid,
  price_cents integer,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing bookings%rowtype;
  v_slot slots%rowtype;
  v_price int;
  v_booking_id uuid;
  v_cancel uuid;
begin
  -- 1. Idempotency: a retried request returns the original booking.
  select * into v_existing from bookings where idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.cancel_token, v_existing.price_cents, 'confirmed'::text;
    return;
  end if;

  -- 2. Lock this exact slot so a second caller waits here.
  select * into v_slot from slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot_not_found' using errcode = 'P0002';
  end if;

  -- 3. The loser of a race finds the slot already booked.
  if v_slot.status = 'booked' then
    return query select null::uuid, null::uuid, null::integer, 'slot_taken'::text;
    return;
  end if;

  -- 4. Reject if a *different* session holds an unexpired hold.
  if v_slot.status = 'held'
     and v_slot.hold_key is distinct from p_hold_key
     and v_slot.hold_expires_at > now() then
    return query select null::uuid, null::uuid, null::integer, 'slot_taken'::text;
    return;
  end if;

  v_price := resolve_price_cents(v_slot.starts_at);

  insert into bookings (
    court_id, slot_id, guest_name, guest_email, guest_phone,
    price_cents, idempotency_key
  ) values (
    v_slot.court_id, p_slot_id, p_guest_name, p_guest_email, p_guest_phone,
    v_price, p_idempotency_key
  )
  returning id, cancel_token into v_booking_id, v_cancel;

  update slots
  set status = 'booked', hold_key = null, hold_expires_at = null
  where id = p_slot_id;

  return query select v_booking_id, v_cancel, v_price, 'confirmed'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancel a booking by its emailed token. Frees the slot for rebooking.
-- ---------------------------------------------------------------------------
create or replace function cancel_booking(p_cancel_token uuid)
returns table (
  booking_id uuid,
  court_id uuid,
  slot_id uuid,
  guest_email text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
begin
  select * into v_booking from bookings where cancel_token = p_cancel_token for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if v_booking.status = 'cancelled' then
    return query select v_booking.id, v_booking.court_id, v_booking.slot_id, v_booking.guest_email, 'already_cancelled'::text;
    return;
  end if;

  update bookings set status = 'cancelled' where id = v_booking.id;
  update slots set status = 'free', hold_key = null, hold_expires_at = null
  where id = v_booking.slot_id;

  return query select v_booking.id, v_booking.court_id, v_booking.slot_id, v_booking.guest_email, 'cancelled'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Release abandoned holds (run on a timer — Tech doc §13).
-- ---------------------------------------------------------------------------
create or replace function release_expired_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with released as (
    update slots
    set status = 'free', hold_key = null, hold_expires_at = null
    where status = 'held' and hold_expires_at < now()
    returning 1
  )
  select count(*) into v_count from released;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function execution: lock the write RPCs to the service role only.
-- (Defined here, after the functions exist; referenced by the RLS model.)
-- ---------------------------------------------------------------------------
revoke execute on function hold_slot(uuid, text, int) from public;
revoke execute on function confirm_booking(uuid, text, text, text, text, text) from public;
revoke execute on function cancel_booking(uuid) from public;
revoke execute on function release_expired_holds() from public;
revoke execute on function generate_slots_for_range(date, date) from public;

grant execute on function hold_slot(uuid, text, int) to service_role;
grant execute on function confirm_booking(uuid, text, text, text, text, text) to service_role;
grant execute on function cancel_booking(uuid) to service_role;
grant execute on function release_expired_holds() to service_role;
grant execute on function generate_slots_for_range(date, date) to service_role;
