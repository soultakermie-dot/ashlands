-- 011: Групи гравців (загони). Лідер — персонаж, який зібрав групу (або обраний голосуванням).
-- members — [{ "characterId": "...", "joinedAt": "..." }, ...]
-- Запускати після 010.

create table if not exists public.groups (
  id                  uuid        primary key,
  leader_character_id uuid        not null,
  members             jsonb       not null default '[]'::jsonb,
  created_at          timestamptz not null default now()
);
alter table public.groups enable row level security;
