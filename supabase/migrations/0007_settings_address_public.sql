-- Add an editable postal address to business settings, and expose the
-- (non-sensitive) branding/contact singleton publicly so the marketing site
-- can render club name, address, hours, and contact details from one source.

alter table business_settings add column if not exists address text;

-- Public read of the settings row. Writes remain service-role only (admin),
-- which bypasses RLS, so no write policy is added here.
drop policy if exists "business_settings public read" on business_settings;
create policy "business_settings public read"
  on business_settings for select
  to anon, authenticated
  using (true);
