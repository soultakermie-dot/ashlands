-- 014: Земля 3D-міст, яку ліпить будівельник: набір точок (x, y, z) + колір кожної точки.
-- data — { mode: 'points' | 'glb', version, size: { w, d }, spacing, points: base64(Float32 x,y,z...), colors: base64(Uint8) }
-- Запускати після 013.

create table if not exists public.city_terrains (
  location_id uuid        primary key references public.locations (id) on delete cascade,
  data        jsonb       not null,
  updated_at  timestamptz not null default now()
);
alter table public.city_terrains enable row level security;
