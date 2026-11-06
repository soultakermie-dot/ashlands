-- 002: Активні входи (щоб не логінитись після оновлення сторінки).
-- Запускати після 001.

create table if not exists public.sessions (
  token_hash text        primary key,                  -- хеш токена (сам токен знає лише браузер гравця)
  user_id    uuid        not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);

alter table public.sessions enable row level security;
