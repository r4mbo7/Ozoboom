import { frac } from '../shared/scalar';

export function hash(a: number, b = 0): number {
  return frac(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
}
