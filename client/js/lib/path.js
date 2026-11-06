// Геометрія ламаних (маршрути подорожей). Точка — [x, y]. Те саме, що server/services/geometry.js.
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Точка на відстані d від початку ламаної та номер відрізка, на якому вона лежить.
export function pointAt(path, d) {
  if (d <= 0) return { point: [...path[0]], index: 1 };
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i]);
    if (d <= seg) {
      const k = seg === 0 ? 0 : d / seg;
      return { point: [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k], index: i };
    }
    d -= seg;
  }
  return { point: [...path[path.length - 1]], index: path.length - 1 };
}

// Решта маршруту від пройденої відстані d до кінця.
export function remainingPath(path, d) {
  const { point, index } = pointAt(path, d);
  return [point, ...path.slice(index)];
}
