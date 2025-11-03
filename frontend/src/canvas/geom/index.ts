// frontend/src/canvas/geom/index.ts
/**
 * canvas/geom
 * Геометрия для линий связей, пересечения с рамками карточек и т.п.
 */
export type Point = { x: number; y: number };

/** Точка выхода луча из центра прямоугольника к targetCenter.
 * halfW/halfH — полуразмеры прямоугольника; pad — отступ от края. */
export function edgePointRayIntersect(
  rectCenter: Point,
  targetCenter: Point,
  halfW: number,
  halfH: number,
  pad = 8
): Point {
  const dx = targetCenter.x - rectCenter.x;
  const dy = targetCenter.y - rectCenter.y;
  if (dx === 0 && dy === 0) return rectCenter;

  const t = Math.min(halfW / Math.abs(dx), halfH / Math.abs(dy));
  let ex = rectCenter.x + dx * t;
  let ey = rectCenter.y + dy * t;

  const len = Math.hypot(dx, dy) || 1;
  ex += (dx / len) * pad;
  ey += (dy / len) * pad;

  return { x: ex, y: ey };
}
