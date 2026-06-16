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

-- NOTE: EXECUTE grants on the write RPCs live at the end of 0003_functions.sql,
-- since the functions must exist before they can be granted.

-- ---------------------------------------------------------------------------
-- Realtime: stream slot + booking changes to connected clients (Tech doc §8).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table slots;
alter publication supabase_realtime add table bookings;
