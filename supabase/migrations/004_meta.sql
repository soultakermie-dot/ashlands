-- 004: Службова інформація сервера (скільки разів запускався тощо).
-- Запускати після 003.

create table if not exists public.app_meta (
  key   text  primary key,
  value jsonb not null
);

alter table public.app_meta enable row level security;
