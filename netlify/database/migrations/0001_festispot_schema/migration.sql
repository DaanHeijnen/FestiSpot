create extension if not exists pgcrypto;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  passcode_hash text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  name text not null,
  profile_photo_url text,
  is_visible boolean default false,
  location_status text not null default 'hidden' check (location_status in ('locked', 'moving', 'hidden')),
  created_at timestamptz default now(),
  last_seen_at timestamptz
);

create table if not exists location_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  source text not null default 'gps',
  location_photo_url text,
  stage_marker jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  from_user_id uuid references users(id) on delete cascade,
  to_user_id uuid references users(id) on delete cascade,
  type text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  seen_at timestamptz
);

create index if not exists idx_users_session_id on users(session_id);
create index if not exists idx_locations_session_updated on location_updates(session_id, updated_at desc);
create index if not exists idx_signals_receiver on signals(session_id, to_user_id, seen_at, expires_at);

insert into sessions (id, name, passcode_hash, expires_at)
values (
  '11111111-1111-4111-8111-111111111111',
  'FestiSpot',
  '926c7551fea60fd3b11ff8f1693384f69d342f54b02288755411fd8c721b56fa',
  now() + interval '30 days'
)
on conflict (id) do update set
  name = excluded.name,
  passcode_hash = excluded.passcode_hash,
  expires_at = greatest(sessions.expires_at, now() + interval '30 days');
