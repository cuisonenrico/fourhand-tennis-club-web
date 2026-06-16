-- Fourhand Tennis Club — core schema (Spec §3)
-- Bookings are inherently relational and need transactional integrity.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type court_surface as enum ('hard', 'clay', 'grass');
create type court_environment as enum ('indoor', 'outdoor');
create type court_status as enum ('active', 'maintenance');
create type slot_status as enum ('free', 'held', 'booked');
create type booking_status as enum ('confirmed', 'cancelled');
create type email_status as enum ('queued', 'sent', 'failed');

-- ---------------------------------------------------------------------------
-- Courts
-- ---------------------------------------------------------------------------
create table courts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  surface     court_surface not null,
  environment court_environment not null,
  lighting    boolean not null default true,
  open_time   time not null default '06:00',
  close_time  time not null default '22:00',
  status      court_status not null default 'active',
  sort_order  integer not null default 0,
  photo_path  text,
  blurb       text
);

-- ---------------------------------------------------------------------------
-- Slots — one row per court per bookable hour (fixed 60-minute slots).
-- ---------------------------------------------------------------------------
create table slots (
  id              uuid primary key default gen_random_uuid(),
  court_id        uuid not null references courts (id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          slot_status not null default 'free',
  hold_expires_at timestamptz,
  hold_key        text,
  -- A court can have exactly one slot at a given start time.
  unique (court_id, starts_at)
);

create index slots_court_start_idx on slots (court_id, starts_at);
create index slots_status_idx on slots (status) where status = 'held';

-- ---------------------------------------------------------------------------
-- Pricing rules — peak / off-peak, member flag reserved for future.
-- ---------------------------------------------------------------------------
create table pricing_rules (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null,            -- 'peak' | 'off-peak'
  peak_start time,                     -- inclusive (local Asia/Manila)
  peak_end   time,                     -- exclusive
  is_member  boolean not null default false,
  rate_cents integer not null
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table bookings (
  id              uuid primary key default gen_random_uuid(),
  court_id        uuid not null references courts (id),
  slot_id         uuid not null references slots (id),
  guest_name      text not null,
  guest_email     text not null,
  guest_phone     text not null,
  price_cents     integer not null,
  status          booking_status not null default 'confirmed',
  idempotency_key text not null,
  cancel_token    uuid not null default gen_random_uuid(),
  created_at      timestamptz not null default now()
);

-- A retried confirm with the same key must never create a second booking.
create unique index bookings_idempotency_key_idx on bookings (idempotency_key);
-- Duplicate backstop: at most one *confirmed* booking per slot, even under a logic bug.
create unique index bookings_one_confirmed_per_slot_idx
  on bookings (slot_id)
  where status = 'confirmed';
create index bookings_court_created_idx on bookings (court_id, created_at);

-- ---------------------------------------------------------------------------
-- Events (light scaffold — sign-up flow is a later phase)
-- ---------------------------------------------------------------------------
create table events (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,           -- 'competition' | 'class' | 'workshop'
  title       text not null,
  description text,
  starts_at   timestamptz not null,
  coach       text,
  capacity    integer not null default 0,
  price_cents integer not null default 0,
  photo_path  text
);

create table event_signups (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events (id) on delete cascade,
  guest_name  text not null,
  guest_email text not null,
  status      text not null default 'confirmed',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Email log — every transactional send is recorded here for auditing.
-- ---------------------------------------------------------------------------
create table email_log (
  id         uuid primary key default gen_random_uuid(),
  type       text not null,
  recipient  text not null,
  subject    text not null,
  status     email_status not null default 'queued',
  payload    jsonb,
  created_at timestamptz not null default now()
);
