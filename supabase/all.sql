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

    -- ===== 005_characters.sql =====
    create table if not exists public.characters (
      id          uuid        primary key,
      user_id     uuid        not null references public.users (id) on delete cascade,
      name        text        not null check (char_length(name) between 2 and 40),
      avatar_path text,
      status      text        not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
      created_at  timestamptz not null default now(),
      reviewed_at timestamptz
    );
    create index if not exists characters_user_id_idx on public.characters (user_id);
    alter table public.characters enable row level security;
    alter table public.users add column if not exists active_character_id uuid;
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/png', 'image/jpeg'])
    on conflict (id) do nothing;

-- ===== 006_character_positions.sql =====
        alter table public.characters add column if not exists pos_x real;
        alter table public.characters add column if not exists pos_y real;

-- ===== 007_display_name.sql =====
alter table public.users add column if not exists display_name text not null default '';
update public.users set display_name = left(login, 30) where display_name = '';
do $$ begin
  alter table public.users add constraint users_display_name_len check (char_length(display_name) <= 30);
exception when duplicate_object then null;
end $$;

    -- ===== 008_sheet_items_inventory.sql =====
    alter table public.characters add column if not exists sheet jsonb not null default '{}'::jsonb;
    alter table public.characters add column if not exists gold integer not null default 0;
    do $$ begin
      alter table public.characters add constraint characters_gold_nonneg check (gold >= 0);
    exception when duplicate_object then null;
    end $$;
    create table if not exists public.items (
      id          uuid        primary key,
      name        text        not null check (char_length(name) between 2 and 60),
      kind        text        not null default 'common' check (kind in ('common', 'special')),
      description text        not null default '' check (char_length(description) <= 1000),
      stats       text        not null default '' check (char_length(stats) <= 1000),   -- характеристики
      image_path  text,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    );
    alter table public.items enable row level security;
    create table if not exists public.inventory (
      id           uuid        primary key,
      character_id uuid        not null references public.characters (id) on delete cascade,
      item_id      uuid        not null references public.items (id) on delete cascade,
      quantity     integer     not null default 1 check (quantity >= 1),
      custom_stats text        check (custom_stats is null or char_length(custom_stats) <= 1000), -- свої характеристики особливого предмета
      created_at   timestamptz not null default now()
    );
    create index if not exists inventory_character_id_idx on public.inventory (character_id);
    alter table public.inventory enable row level security;
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('items', 'items', true, 524288, array['image/webp', 'image/png', 'image/jpeg'])
    on conflict (id) do nothing;

-- ===== 009_world.sql =====
create table if not exists public.locations (
  id          uuid        primary key,
  type        text        not null check (type in ('city', 'dungeon')),
  name        text        not null check (char_length(name) between 2 and 60),
  description text        not null default '' check (char_length(description) <= 2000),
  x           real        not null,
  y           real        not null,
  created_at  timestamptz not null default now()
);
alter table public.locations enable row level security;
create table if not exists public.roads (
  id         uuid        primary key,
  from_id    uuid        not null references public.locations (id) on delete cascade,
  to_id      uuid        not null references public.locations (id) on delete cascade,
  points     jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.roads enable row level security;

-- ===== 010_travel.sql =====
alter table public.characters add column if not exists travel jsonb;

-- ===== 011_groups.sql =====
    create table if not exists public.groups (
      id                  uuid        primary key,
      leader_character_id uuid        not null,
      members             jsonb       not null default '[]'::jsonb,
      created_at          timestamptz not null default now()
    );
    alter table public.groups enable row level security;

-- ===== 012_dm_tools.sql =====
create table if not exists public.dm_notes (
  id         uuid        primary key,
  title      text        not null default '' check (char_length(title) <= 100),
  body       text        not null default '' check (char_length(body) <= 10000),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.dm_notes enable row level security;
alter table public.characters add column if not exists dungeon jsonb;
