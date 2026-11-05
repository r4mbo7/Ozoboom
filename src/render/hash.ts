import { frac } from '../shared/scalar';

// An integer mix, for picks that must not follow their input.
export function scramble(value: number): number {
  let bits = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  bits = Math.imul(bits ^ (bits >>> 16), 0x45d9f3b);
  return (bits ^ (bits >>> 16)) >>> 0;
}

export function hash(a: number, b = 0): number {
  return frac(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
}
