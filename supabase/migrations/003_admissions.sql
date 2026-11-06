-- 003: Кого ДМ пустив у поточну гру.
-- Запускати після 002.

create table if not exists public.admissions (
  user_id     uuid        primary key references public.users (id) on delete cascade,
  admitted_at timestamptz not null default now(),
  away_since  timestamptz                               -- з якого моменту гравець відсутній (null = онлайн)
);

alter table public.admissions enable row level security;
