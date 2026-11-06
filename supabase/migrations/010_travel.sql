-- 010: Подорожі — куди й як іде персонаж (шлях, швидкість, пауза). null = стоїть.
-- Запускати після 009.

alter table public.characters add column if not exists travel jsonb;
