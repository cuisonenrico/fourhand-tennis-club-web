-- Fourhand Tennis Club — seed data
-- 6 courts (4 hard, 1 clay, 1 grass), peak/off-peak pricing, and two weeks of slots.

insert into courts (name, surface, environment, lighting, sort_order, blurb) values
  ('Court 1 — Centre',  'hard',  'outdoor', true,  1, 'Our show court. Premium acrylic hard surface under floodlights.'),
  ('Court 2',           'hard',  'outdoor', true,  2, 'Fast hard court, fully lit for evening play.'),
  ('Court 3 — Indoor',  'hard',  'indoor',  true,  3, 'Climate-controlled indoor hard court — rain or shine.'),
  ('Court 4 — Indoor',  'hard',  'indoor',  true,  4, 'Second indoor hard court with cushioned acrylic.'),
  ('Court 5 — Clay',    'clay',  'outdoor', true,  5, 'European red clay for that softer, slower game.'),
  ('Court 6 — Grass',   'grass', 'outdoor', false, 6, 'Natural grass court. Daytime play only.');

-- Off-peak ₱500/hr; peak (5pm–10pm) ₱800/hr. Member rates reserved for later.
insert into pricing_rules (scope, peak_start, peak_end, is_member, rate_cents) values
  ('off-peak', null,    null,    false, 50000),
  ('peak',     '17:00', '22:00', false, 80000);

-- Grass court (Court 6) has no lights → daytime only.
update courts set close_time = '18:00' where name = 'Court 6 — Grass';

-- Generate two weeks of bookable slots starting today (Asia/Manila).
select generate_slots_for_range(
  (now() at time zone 'Asia/Manila')::date,
  (now() at time zone 'Asia/Manila')::date + 14
);

-- A couple of sample events for the landing teaser + events list.
insert into events (type, title, description, starts_at, coach, capacity, price_cents) values
  ('competition', 'Summer Singles Ladder', 'Six-week singles ladder across all skill levels. Weekly fixtures, trophies for the top three.', now() + interval '10 days', null, 32, 150000),
  ('class', 'Adult Beginners Clinic', 'Four-week coached clinic covering grips, footwork, and rallying. Rackets provided.', now() + interval '5 days', 'Coach Marisol', 12, 120000),
  ('workshop', 'Serve & Volley Masterclass', 'A two-hour intensive on first-strike tennis with our head coach.', now() + interval '7 days', 'Coach Diego', 8, 90000);
