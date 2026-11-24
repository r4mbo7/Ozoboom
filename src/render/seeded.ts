import { frac } from '../shared/scalar';

// The same scatter on every run, for drawings that must not shimmer from one load to the next.
export function seeded(index: number): number {
  return frac(Math.sin(index * 12.9898 + 4.1414) * 43758.5453);
}
