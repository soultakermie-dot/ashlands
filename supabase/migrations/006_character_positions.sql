-- 006: Де стоїть персонаж на карті світу (координати в пікселях карти).
-- Запускати після 005.

alter table public.characters add column if not exists pos_x real;  -- null = ще не на карті
alter table public.characters add column if not exists pos_y real;
