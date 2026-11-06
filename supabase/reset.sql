-- Очистити ВСІ дані гри (акаунти, входи, допуски, службову інфо).
-- Таблиці лишаються, видаляються тільки записи.
-- Використовувати перед справжньою грою, щоб прибрати тестові акаунти.
-- ⚠️ Скасувати не можна!

truncate table
  public.admissions,
  public.sessions,
  public.users,
  public.app_meta
restart identity cascade;
