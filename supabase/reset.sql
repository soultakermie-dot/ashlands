-- Очистити ВСІ дані гри (акаунти, персонажі, предмети, світ, входи, допуски, службову інфо).
-- Після очищення сервер знову створить тестові міста й дороги — їх можна видалити в творчому режимі.
-- Таблиці лишаються, видаляються тільки записи.
-- Використовувати перед справжньою грою, щоб прибрати тестові акаунти.
-- ⚠️ Скасувати не можна!
--
-- Картинки аватарок цей скрипт не видаляє (Supabase не дозволяє чистити файли через SQL):
-- Storage → bucket «avatars» і «items» → виділити все → Delete.

truncate table
  public.city_scenes,
  public.city_terrains,
  public.dm_notes,
  public.groups,
  public.roads,
  public.locations,
  public.inventory,
  public.items,
  public.characters,
  public.admissions,
  public.sessions,
  public.users,
  public.app_meta
restart identity cascade;
