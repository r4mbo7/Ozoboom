import type { Graphics } from 'pixi.js';

export function strokeArc(
  arc: Graphics,
  radius: number,
  from: number,
  to: number,
  width: number,
  color: number,
  alpha: number,
): void {
  arc.moveTo(Math.cos(from) * radius, Math.sin(from) * radius);
  arc.arc(0, 0, radius, from, to);
  arc.stroke({ width, color, alpha, cap: 'round' });
}
