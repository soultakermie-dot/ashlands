-- 008: Лист персонажа, золото, бібліотека предметів, інвентар, картинки предметів.
-- Запускати після 007.

-- Лист персонажа (поля — див. server/services/sheet.js) і золото.
alter table public.characters add column if not exists sheet jsonb not null default '{}'::jsonb;
alter table public.characters add column if not exists gold integer not null default 0;
do $$ begin
  alter table public.characters add constraint characters_gold_nonneg check (gold >= 0);
exception when duplicate_object then null;
end $$;

-- Бібліотека предметів: створює й змінює лише ДМ.
-- kind: 'common' — звичайний (зілля, стріли…), складається в стопку;
--       'special' — особливий (зброя, броня, артефакти), кожен окремо.
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

-- Інвентар: що лежить у кого.
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

-- Сховище картинок предметів (публічне читання; завантажує лише сервер гри).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('items', 'items', true, 524288, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;
