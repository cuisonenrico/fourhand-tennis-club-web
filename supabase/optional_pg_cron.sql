-- OPTIONAL: free, in-database scheduling for frequent hold cleanup.
--
-- You do NOT need this for correctness. Holds expire lazily on read
-- (lib/booking/queries.ts), so an abandoned hold is treated as free
-- immediately, with no scheduler involved. This job only flips the stored
-- status back to 'free' so the slots table stays tidy.
--
-- Vercel Hobby allows crons to run at most once per day, which is why
-- vercel.json schedules /api/cron/release-holds daily. If you want a more
-- frequent sweep at no cost, use Supabase pg_cron instead (runs in the DB).
--
-- Run this once in the Supabase SQL Editor:

create extension if not exists pg_cron;

-- Every 5 minutes, free any holds whose expiry has passed.
select cron.schedule(
  'release-expired-holds',
  '*/5 * * * *',
  $$ select release_expired_holds(); $$
);

-- To remove it later:
--   select cron.unschedule('release-expired-holds');

-- If you use pg_cron, you can drop the Vercel cron entirely by deleting
-- the "crons" block from vercel.json.
