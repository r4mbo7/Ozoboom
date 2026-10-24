const frac = (value: number) => value - Math.floor(value);

// A share in [0, 1) drawn from two integers, the same on every image.
export function hash(a: number, b = 0): number {
  return frac(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
}
