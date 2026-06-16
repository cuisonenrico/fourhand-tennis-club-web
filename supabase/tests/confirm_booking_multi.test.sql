-- Correctness test for confirm_booking_multi (group bookings).
-- Run against a local Supabase after migrations:
--   psql "$DATABASE_URL" -f supabase/tests/confirm_booking_multi.test.sql
-- Asserts inline and RAISES on failure.

do $$
declare
  v_court uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid;
  v_status text;
  v_total int;
  v_group uuid;
  v_token uuid;
  v_count int;
begin
  insert into courts (name, surface, environment, lighting)
  values ('Multi Test Court', 'hard', 'indoor', true) returning id into v_court;

  insert into slots (court_id, starts_at, ends_at, status) values
    (v_court, '2026-08-01 09:00:00 Asia/Manila', '2026-08-01 10:00:00 Asia/Manila', 'free') returning id into v_s1;
  insert into slots (court_id, starts_at, ends_at, status) values
    (v_court, '2026-08-01 10:00:00 Asia/Manila', '2026-08-01 11:00:00 Asia/Manila', 'free') returning id into v_s2;
  insert into slots (court_id, starts_at, ends_at, status) values
    (v_court, '2026-08-01 11:00:00 Asia/Manila', '2026-08-01 12:00:00 Asia/Manila', 'free') returning id into v_s3;

  insert into pricing_rules (scope, is_member, rate_cents) values ('off-peak', false, 50000);

  -- Book all three hours in one group.
  select status, total_price_cents, booking_group_id, cancel_token
    into v_status, v_total, v_group, v_token
  from confirm_booking_multi(array[v_s1, v_s2, v_s3], 'k', 'Ana', 'ana@example.com', '0900', 'multi-1');

  if v_status <> 'confirmed' then
    raise exception 'FAIL: expected confirmed, got %', v_status;
  end if;
  if v_total <> 150000 then
    raise exception 'FAIL: expected total 150000, got %', v_total;
  end if;

  select count(*) into v_count from bookings where booking_group_id = v_group and status = 'confirmed';
  if v_count <> 3 then
    raise exception 'FAIL: expected 3 booking rows, got %', v_count;
  end if;

  -- All three rows share one cancel token.
  select count(distinct cancel_token) into v_count from bookings where booking_group_id = v_group;
  if v_count <> 1 then
    raise exception 'FAIL: expected one shared cancel token, got %', v_count;
  end if;

  -- Overlapping group must lose entirely (atomic): s3 already booked.
  select status into v_status
  from confirm_booking_multi(array[v_s3], 'k2', 'Ben', 'ben@example.com', '0901', 'multi-2');
  if v_status <> 'slot_taken' then
    raise exception 'FAIL: expected slot_taken for overlapping group, got %', v_status;
  end if;
  select count(*) into v_count from bookings where idempotency_key = 'multi-2';
  if v_count <> 0 then
    raise exception 'FAIL: a losing group must insert no rows, got %', v_count;
  end if;

  -- Idempotent replay returns the same group, no new rows.
  perform confirm_booking_multi(array[v_s1, v_s2, v_s3], 'k', 'Ana', 'ana@example.com', '0900', 'multi-1');
  select count(*) into v_count from bookings where idempotency_key = 'multi-1';
  if v_count <> 3 then
    raise exception 'FAIL: idempotent replay changed row count to %', v_count;
  end if;

  -- Cancelling the token frees every slot in the group.
  perform cancel_booking(v_token);
  select count(*) into v_count from slots where id in (v_s1, v_s2, v_s3) and status <> 'free';
  if v_count <> 0 then
    raise exception 'FAIL: % slots not freed after group cancel', v_count;
  end if;

  raise notice 'PASS: confirm_booking_multi group booking + atomicity + idempotency + cancel';

  delete from bookings where booking_group_id = v_group;
  delete from slots where id in (v_s1, v_s2, v_s3);
  delete from courts where id = v_court;
end;
$$;
