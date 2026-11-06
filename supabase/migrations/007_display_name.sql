-- 007: Ім'я або нік гравця (те, що бачать інші; логін — лише для входу).
-- Запускати після 006.

alter table public.users add column if not exists display_name text not null default '';

-- Уже існуючим акаунтам тимчасовим ім'ям стає логін.
update public.users set display_name = left(login, 30) where display_name = '';

do $$ begin
  alter table public.users add constraint users_display_name_len check (char_length(display_name) <= 30);
exception when duplicate_object then null;
end $$;
