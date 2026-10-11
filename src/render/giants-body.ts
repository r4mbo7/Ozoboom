import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../shared/vec';

const TAU = Math.PI * 2;
const WHITE = 0xffffff;
const AURA = { x: 488, radius: 76, dots: 48 } as const;

// The face of the mock-up's `geant` symbol, turned so that it looks away from the core: x goes out, y across.
function head(sx: number, sy: number): [number, number] {
  return [440 + (-sy - 80) * 0.9, sx * 0.9];
}

// A giant seen from above in the mock-up's units, its back to the core: a dotted aura, the half-dome cap of a mushroom
// with its rings and spots, the face with closed eyes and a third eye, the torso and its dots, the roots.
export function traceBody(g: Graphics): void {
  for (let dot = 0; dot < AURA.dots; dot += 1) {
    const angle = (dot / AURA.dots) * TAU;
    g.circle(AURA.x + Math.cos(angle) * AURA.radius, Math.sin(angle) * AURA.radius, 0.9);
  }
  g.fill({ color: WHITE, alpha: 0.7 });

  g.moveTo(462, -64)
    .bezierCurveTo(510, -66, 545, -36, 545, 0)
    .bezierCurveTo(545, 36, 510, 66, 462, 64)
    .bezierCurveTo(454, 30, 454, -30, 462, -64)
    .closePath();
  g.fill({ color: WHITE, alpha: 0.16 });
  g.stroke({ width: 3, color: WHITE, cap: 'round', join: 'round' });
  g.moveTo(468, -48)
    .bezierCurveTo(504, -48, 527, -26, 527, 0)
    .bezierCurveTo(527, 26, 504, 48, 468, 48);
  g.moveTo(472, -30)
    .bezierCurveTo(492, -30, 507, -16, 507, 0)
    .bezierCurveTo(507, 16, 492, 30, 472, 30);
  g.stroke({ width: 1.3, color: WHITE, alpha: 0.75, cap: 'round' });
  for (const [x, y, r] of [
    [514, -28, 5],
    [520, 20, 4],
    [490, -6, 3.5],
  ] as const) {
    g.circle(x, y, r);
  }
  g.fill({ color: WHITE, alpha: 0.5 });

  g.ellipse(440, 0, 22.5, 18).fill({ color: WHITE, alpha: 0.22 });
  g.ellipse(440, 0, 22.5, 18).stroke({ width: 2.4, color: WHITE });
  for (const [x, y, dx] of [
    [-12, -84, 9],
    [3, -84, 9],
    [-5, -68, 10],
  ] as const) {
    const [fromX, fromY] = head(x, y);
    const [byX, byY] = head(x + dx / 2, y + 4);
    const [toX, toY] = head(x + dx, y);
    g.moveTo(fromX, fromY).quadraticCurveTo(byX, byY, toX, toY);
  }
  g.stroke({ width: 1.6, color: WHITE, cap: 'round' });
  g.circle(...head(0, -95), 2.6).fill(WHITE);

  g.moveTo(420, -10)
    .bezierCurveTo(412, -12, 410, -30, 398, -32)
    .bezierCurveTo(372, -36, 352, -24, 332, -18)
    .lineTo(332, 18)
    .bezierCurveTo(352, 24, 372, 36, 398, 32)
    .bezierCurveTo(410, 30, 412, 12, 420, 10);
  g.fill({ color: WHITE, alpha: 0.14 });
  g.stroke({ width: 2.4, color: WHITE, cap: 'round', join: 'round' });
  for (const x of [385, 364, 345]) {
    g.circle(x, 0, 3);
  }
  for (const [x, y] of [
    [470, -110],
    [500, 90],
    [360, -150],
    [380, 160],
    [560, -40],
  ] as const) {
    g.circle(x, y, 1.5);
  }
  g.fill(WHITE);
  for (const [y, endY] of [
    [-14, -48],
    [-4, -12],
    [6, 18],
    [14, 46],
  ] as const) {
    g.moveTo(332, y).bezierCurveTo(318, (y + endY) / 2, 310, endY * 0.85, 297, endY);
  }
  g.stroke({ width: 1.8, color: WHITE, cap: 'round' });
}

// A smooth curve through every point (Catmull-Rom), so that it runs over each stone of the arm.
export function traceThrough(g: Graphics, points: readonly Vec2[]): void {
  const [first] = points;
  if (first === undefined) {
    return;
  }
  g.moveTo(first.x, first.y);
  for (let index = 0; index + 1 < points.length; index += 1) {
    const p1 = points[index] ?? first;
    const p0 = points[index - 1] ?? p1;
    const p2 = points[index + 1] ?? p1;
    const p3 = points[index + 2] ?? p2;
    g.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6,
      p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6,
      p2.y - (p3.y - p1.y) / 6,
      p2.x,
      p2.y,
    );
  }
}
