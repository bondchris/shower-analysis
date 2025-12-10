export function doPolygonsIntersect(a: { x: number; y: number }[], b: { x: number; y: number }[]): boolean {
  const polygons = [a, b];
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const NEXT_OFF = 1;
      const p1 = polygon[i];
      const p2 = polygon[(i + NEXT_OFF) % polygon.length];

      if (!p1 || !p2) {
        continue;
      }

      const normal = { x: -(p2.y - p1.y), y: p2.x - p1.x };

      let minA = Infinity;
      let maxA = -Infinity;
      for (const p of a) {
        const termX = normal.x * p.x;
        const termY = normal.y * p.y;
        const projected = termX + termY;
        if (projected < minA) {
          minA = projected;
        }
        if (projected > maxA) {
          maxA = projected;
        }
      }

      let minB = Infinity;
      let maxB = -Infinity;
      for (const p of b) {
        const termX = normal.x * p.x;
        const termY = normal.y * p.y;
        const projected = termX + termY;
        if (projected < minB) {
          minB = projected;
        }
        if (projected > maxB) {
          maxB = projected;
        }
      }

      if (maxA < minB || maxB < minA) {
        return false;
      }
    }
  }
  return true;
}
