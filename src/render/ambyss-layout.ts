import type { Vec2 } from '../shared/vec';

// An almond is the overlap of two circles (a vesica piscis): tips on the east-west axis, apexes on the north-south.
export interface Almond {
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export const FLOOR: Almond = { halfWidth: 400, halfHeight: 230 };
// The mock-ups were drawn around an almond 346 wide: their measures grow with FLOOR.
export const SCALE = FLOOR.halfWidth / 346.4;
export const CANOPY: Almond = { halfWidth: 440, halfHeight: 255 };
// How far the guy ropes run past the canopy's edge, to their pegs.
export const ROPE_LENGTH = 80;

function arc({ halfWidth, halfHeight }: Almond): { radius: number; spread: number } {
  const radius = (halfWidth * halfWidth + halfHeight * halfHeight) / (2 * halfHeight);
  return { radius, spread: Math.asin(halfWidth / radius) };
}

// A point of the almond's edge, from the west tip (t = 0) to the east one (t = 1), along its north or south arc,
// pushed `grow` further out.
export function almondEdge(
  center: Vec2,
  almond: Almond,
  t: number,
  north: boolean,
  grow = 0,
): Vec2 {
  const { radius, spread } = arc(almond);
  const offset = radius - almond.halfHeight;
  const swing = -spread + 2 * spread * t;
  const angle = north ? -Math.PI / 2 + swing : Math.PI / 2 - swing;
  const cy = north ? center.y + offset : center.y - offset;
  return {
    x: center.x + (radius + grow) * Math.cos(angle),
    y: cy + (radius + grow) * Math.sin(angle),
  };
}

export function insideAlmond(center: Vec2, almond: Almond, point: Vec2, margin = 0): boolean {
  const { radius } = arc(almond);
  const offset = radius - almond.halfHeight;
  const dx = point.x - center.x;
  const reach = radius + margin;
  return (
    Math.hypot(dx, point.y - (center.y + offset)) < reach &&
    Math.hypot(dx, point.y - (center.y - offset)) < reach
  );
}
