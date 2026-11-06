-- 005: Персонажі гравців і сховище аватарок.
-- Запускати після 004.

create table if not exists public.characters (
  id          uuid        primary key,
  user_id     uuid        not null references public.users (id) on delete cascade,
  name        text        not null check (char_length(name) between 2 and 40),
  avatar_path text,                                     -- шлях до картинки в сховищі (null = без аватарки)
  status      text        not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz                               -- коли ДМ підтвердив або відхилив
);

create index if not exists characters_user_id_idx on public.characters (user_id);

alter table public.characters enable row level security;

-- Який персонаж зараз вибраний у гравця (без зовнішнього ключа: персонаж і акаунт зберігаються незалежно).
alter table public.users add column if not exists active_character_id uuid;

-- Сховище картинок аватарок (публічне читання; завантажує лише сервер гри).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;
