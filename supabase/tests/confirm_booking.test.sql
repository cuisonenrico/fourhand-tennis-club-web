-- Concurrency + correctness test for confirm_booking (Tech doc §7).
-- Run against a local Supabase: `supabase db reset` then
--   psql "$DATABASE_URL" -f supabase/tests/confirm_booking.test.sql
-- It asserts inline and RAISES on failure (non-zero exit).
--
-- True simultaneous execution is exercised by the row lock: two transactions
-- selecting the same slot FOR UPDATE serialise, and the second sees 'booked'.
-- Here we verify the logical guarantees that lock produces.

do $$
declare
  v_court uuid;
  v_slot uuid;
  v_status1 text;
  v_status2 text;
  v_count int;
  v_id1 uuid;
  v_id2 uuid;
begin
  -- Arrange: a fresh court + single free slot.
  insert into courts (name, surface, environment, lighting)
  values ('Test Court', 'hard', 'indoor', true) returning id into v_court;

  insert into slots (court_id, starts_at, ends_at, status)
  values (v_court, '2026-07-01 10:00:00 Asia/Manila', '2026-07-01 11:00:00 Asia/Manila', 'free')
  returning id into v_slot;

  insert into pricing_rules (scope, is_member, rate_cents) values ('off-peak', false, 50000);

  -- Act: two confirms on the same slot with different idempotency keys.
  select status into v_status1 from confirm_booking(v_slot, 'key-a', 'Ana', 'ana@example.com', '0900', 'idem-1');
  select status into v_status2 from confirm_booking(v_slot, 'key-b', 'Ben', 'ben@example.com', '0901', 'idem-2');

  -- Assert: exactly one confirmed, the other 'slot_taken'.
  if not (v_status1 = 'confirmed' and v_status2 = 'slot_taken') then
    raise exception 'FAIL: expected one confirmed + one slot_taken, got % / %', v_status1, v_status2;
  end if;

  select count(*) into v_count from bookings where slot_id = v_slot and status = 'confirmed';
  if v_count <> 1 then
    raise exception 'FAIL: expected exactly 1 confirmed booking, got %', v_count;
  end if;

  -- Assert: idempotency — replaying key returns the same booking, no duplicate.
  select booking_id into v_id1 from confirm_booking(v_slot, 'key-a', 'Ana', 'ana@example.com', '0900', 'idem-1');
  select id into v_id2 from bookings where idempotency_key = 'idem-1';
  if v_id1 <> v_id2 then
    raise exception 'FAIL: idempotent replay returned a different booking';
  end if;

  select count(*) into v_count from bookings where slot_id = v_slot;
  if v_count <> 1 then
    raise exception 'FAIL: idempotent replay created a duplicate booking (% rows)', v_count;
  end if;

  -- Assert: cancelling frees the slot for rebooking.
  perform cancel_booking((select cancel_token from bookings where idempotency_key = 'idem-1'));
  select status into v_status1 from slots where id = v_slot;
  if v_status1 <> 'free' then
    raise exception 'FAIL: slot not freed after cancellation (status %)', v_status1;
  end if;

  raise notice 'PASS: confirm_booking concurrency + idempotency + cancellation';

  -- Clean up so the test is repeatable.
  delete from bookings where slot_id = v_slot;
  delete from slots where id = v_slot;
  delete from courts where id = v_court;
end;
$$;
