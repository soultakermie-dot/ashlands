-- Усі міграції разом: створює базу з нуля одним запуском.
-- Те саме, що запустити по черзі файли з migrations/. Безпечно запускати повторно.

-- ===== 001_users.sql =====
create table if not exists public.users (
  id                uuid primary key,
  login             text        not null,
  password_hash     text        not null,
  role              text        not null default 'player' check (role in ('player', 'dm')),
  dm_note           text        not null default '' check (char_length(dm_note) <= 200),
  first_admitted_at timestamptz,
  created_at        timestamptz not null default now()
);
create unique index if not exists users_login_lower_idx on public.users (lower(login));
alter table public.users enable row level security;

-- ===== 002_sessions.sql =====
create table if not exists public.sessions (
  token_hash text        primary key,
  user_id    uuid        not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_id_idx on public.sessions (user_id);
alter table public.sessions enable row level security;

-- ===== 003_admissions.sql =====
create table if not exists public.admissions (
  user_id     uuid        primary key references public.users (id) on delete cascade,
  admitted_at timestamptz not null default now(),
  away_since  timestamptz
);
alter table public.admissions enable row level security;

-- ===== 004_meta.sql =====
create table if not exists public.app_meta (
  key   text  primary key,
  value jsonb not null
);
alter table public.app_meta enable row level security;
