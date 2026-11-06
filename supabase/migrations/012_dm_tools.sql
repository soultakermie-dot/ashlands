-- 012: Інструменти ДМ — нотатки ДМ і перебування персонажа в катакомбах.
-- Годинник дня й ночі зберігається в app_meta (ключ 'world'), кидки кубиків — лише в пам'яті сервера.
-- Запускати після 011.

-- Приватні нотатки ДМ (бачать лише ДМ).
create table if not exists public.dm_notes (
  id         uuid        primary key,
  title      text        not null default '' check (char_length(title) <= 100),
  body       text        not null default '' check (char_length(body) <= 10000),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.dm_notes enable row level security;

-- Персонаж у катакомбах (JSON: яке підземелля, звідки зайшов, скільки йти, пауза). null = не в катакомбах.
alter table public.characters add column if not exists dungeon jsonb;
