-- 013: 3D-сцени міст (режим «Будівельник»): яку папку моделей використовує місто і що в ньому стоїть.
-- objects — [{ "id", "model" (шлях моделі), "x", "y", "z", "rotY" (радіани), "scale" }, ...]
-- Запускати після 012.

create table if not exists public.city_scenes (
  location_id uuid        primary key references public.locations (id) on delete cascade,
  folder      text,                                    -- папка міста в client/assets/models/cities/ (null — лише спільні моделі)
  objects     jsonb       not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.city_scenes enable row level security;
