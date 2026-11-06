-- Очистити ВСІ дані гри (акаунти, персонажі, входи, допуски, службову інфо).
-- Таблиці лишаються, видаляються тільки записи.
-- Використовувати перед справжньою грою, щоб прибрати тестові акаунти.
-- ⚠️ Скасувати не можна!
--
-- Картинки аватарок цей скрипт не видаляє (Supabase не дозволяє чистити файли через SQL):
-- Storage → bucket «avatars» → виділити все → Delete.

truncate table
  public.characters,
  public.admissions,
  public.sessions,
  public.users,
  public.app_meta
restart identity cascade;
