import type { Shape } from "./shape-types";

export const GRID = 20;

export function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

export function shapeCenter(s: Shape) {
  return { x: s.x + s.width / 2, y: s.y + s.height / 2 };
}

// Compute connector endpoint on shape edge along line toward target.
export function edgePoint(s: Shape, toward: { x: number; y: number }) {
  const c = shapeCenter(s);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = s.width / 2;
  const hh = s.height / 2;
  const scale = Math.min(hw / Math.abs(dx || 0.0001), hh / Math.abs(dy || 0.0001));
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}
