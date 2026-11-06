// Геометрія ламаних ліній (дороги, маршрути). Точка — [x, y].

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function lengthOf(path) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += dist(path[i - 1], path[i]);
  return total;
}

// Точка на відстані d від початку ламаної.
export function pointAt(path, d) {
  if (d <= 0) return [...path[0]];
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i]);
    if (d <= seg) {
      const k = seg === 0 ? 0 : d / seg;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k];
    }
    d -= seg;
  }
  return [...path[path.length - 1]];
}

// Найближча до p точка ламаної: { point, distance (від p), along (від початку ламаної), index (номер відрізка) }.
export function project(path, p) {
  let best = null;
  let along = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const seg = dist(a, b);
    const t = seg === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (seg * seg)));
    const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const d = dist(p, point);
    if (!best || d < best.distance) best = { point, distance: d, along: along + seg * t, index: i };
    along += seg;
  }
  return best;
}

// Частина ламаної від точки проєкції до кінця (forward) або до початку (backward), включно з точкою проєкції.
export function splitAt(path, proj) {
  const forward = [proj.point, ...path.slice(proj.index)];
  const backward = [proj.point, ...path.slice(0, proj.index).reverse()];
  return { forward, backward };
}
