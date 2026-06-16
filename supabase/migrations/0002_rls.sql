-- Fourhand Tennis Club — Row Level Security (Tech doc §6.1, §15)
-- RLS is ON for every table from day one. The browser (anon key) can only read
-- public marketing/availability data. All writes go through SECURITY DEFINER
-- RPCs invoked server-side with the service role.

alter table courts        enable row level security;
alter table slots         enable row level security;
alter table pricing_rules enable row level security;
alter table bookings      enable row level security;
alter table events        enable row level security;
alter table event_signups enable row level security;
alter table email_log     enable row level security;

-- Public reads — needed to render the landing page and booking grid.
create policy "public reads courts"
  on courts for select to anon, authenticated using (true);

create policy "public reads slots"
  on slots for select to anon, authenticated using (true);

create policy "public reads pricing"
  on pricing_rules for select to anon, authenticated using (true);

create policy "public reads events"
  on events for select to anon, authenticated using (true);

-- Bookings are visible only to signed-in staff (the minimum admin).
-- Guests receive their details via the confirmation email, not table reads.
create policy "admins read bookings"
  on bookings for select to authenticated using (true);

-- event_signups and email_log have NO policies: anon/authenticated are denied;
-- only the service role (which bypasses RLS) can touch them.

-- ---------------------------------------------------------------------------
-- Function execution: lock the write RPCs to the service role only.
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

-- ---------------------------------------------------------------------------
-- Realtime: stream slot + booking changes to connected clients (Tech doc §8).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table slots;
alter publication supabase_realtime add table bookings;
