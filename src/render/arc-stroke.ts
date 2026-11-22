import type { Graphics } from 'pixi.js';

// A fresh path: after a stroke Pixi moves to the last point, and a `moveTo` onto the arc's start
// would add that point twice, leaving the start cap with no direction to round toward.
export function strokeArc(
  arc: Graphics,
  radius: number,
  from: number,
  to: number,
  width: number,
  color: number,
  alpha: number,
): void {
  arc.beginPath();
  arc.arc(0, 0, radius, from, to);
  arc.stroke({ width, color, alpha, cap: 'round' });
}
