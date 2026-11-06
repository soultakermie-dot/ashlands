-- 009: Світ — локації (міста, підземелля) і дороги. Стартова точка — в app_meta (ключ 'world').
-- Запускати після 008.

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

-- Дорога між двома локаціями; points — точки згину між ними: [[x, y], ...]
create table if not exists public.roads (
  id         uuid        primary key,
  from_id    uuid        not null references public.locations (id) on delete cascade,
  to_id      uuid        not null references public.locations (id) on delete cascade,
  points     jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.roads enable row level security;
