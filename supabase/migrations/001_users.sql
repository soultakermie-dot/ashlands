-- 001: Акаунти гравців і ДМ.
-- Запускати один раз у Supabase → SQL Editor → Run.

create table if not exists public.users (
  id                uuid primary key,
  login             text        not null,
  password_hash     text        not null,              -- зашифрований пароль (scrypt), сам пароль ніде не зберігається
  role              text        not null default 'player' check (role in ('player', 'dm')),
  dm_note           text        not null default '' check (char_length(dm_note) <= 200), -- примітка, яку бачить тільки ДМ
  first_admitted_at timestamptz,                       -- коли ДМ вперше пустив у гру (null = «Новий»)
  created_at        timestamptz not null default now()
);

-- Логін унікальний без урахування регістру («Аня» = «аня»).
create unique index if not exists users_login_lower_idx on public.users (lower(login));

-- Доступ лише з сервера гри (секретним ключем). Ззовні таблиця закрита.
alter table public.users enable row level security;
