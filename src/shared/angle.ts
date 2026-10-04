import type { Vec2 } from './vec';

// Trigonometry from + - * / and sqrt only: Math.sin, Math.cos and Math.atan2 are not reproducible
// from one engine to another (docs/architecture.md).

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
