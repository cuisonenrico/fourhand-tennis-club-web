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
