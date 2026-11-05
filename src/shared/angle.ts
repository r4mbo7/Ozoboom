import type { Vec2 } from './vec';

// Math.sin, Math.cos and Math.atan2 are not reproducible across engines (docs/architecture.md).

const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;
const SERIES_TERMS = 14;

export function unitFromAngle(radians: number): Vec2 {
  const x = radians - TWO_PI * Math.floor((radians + Math.PI) / TWO_PI);
  const squared = x * x;
  let cos = 1;
  let sin = x;
  let cosTerm = 1;
  let sinTerm = x;
  for (let k = 1; k <= SERIES_TERMS; k++) {
    cosTerm *= -squared / ((2 * k - 1) * (2 * k));
    sinTerm *= -squared / (2 * k * (2 * k + 1));
    cos += cosTerm;
    sin += sinTerm;
  }
  return { x: cos, y: sin };
}

export function rotate(v: Vec2, radians: number): Vec2 {
  const turn = unitFromAngle(radians);
  return { x: v.x * turn.x - v.y * turn.y, y: v.x * turn.y + v.y * turn.x };
}

// From `from` toward `to`, both unit, by at most `maxRadians`, the short way round.
export function turnToward(from: Vec2, to: Vec2, maxRadians: number): Vec2 {
  const delta = angleOf({
    x: from.x * to.x + from.y * to.y,
    y: from.x * to.y - from.y * to.x,
  });
  if (Math.abs(delta) <= maxRadians) {
    return to;
  }
  return rotate(from, delta < 0 ? -maxRadians : maxRadians);
}

export function angleOf(v: Vec2): number {
  if (v.y === 0) {
    return v.x < 0 ? Math.PI : 0;
  }
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  const halfTangent = v.x >= 0 ? v.y / (len + v.x) : (len - v.x) / v.y;
  return 2 * arctangent(halfTangent);
}

function arctangent(t: number): number {
  if (t > 1) {
    return HALF_PI - arctangent(1 / t);
  }
  if (t < -1) {
    return -HALF_PI - arctangent(1 / t);
  }
  const quarter = halveArctangent(halveArctangent(t));
  const squared = quarter * quarter;
  let power = quarter;
  let sum = quarter;
  for (let k = 1; k <= SERIES_TERMS; k++) {
    power *= -squared;
    sum += power / (2 * k + 1);
  }
  return 4 * sum;
}

function halveArctangent(t: number): number {
  return t / (1 + Math.sqrt(1 + t * t));
}
