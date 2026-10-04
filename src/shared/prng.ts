export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

const UINT32_RANGE = 2 ** 32;
const SEEDING_ROUNDS = 12;

export function seedRng(seed: number): RngState {
  if (!Number.isInteger(seed) || seed < 0 || seed >= UINT32_RANGE) {
    throw new RangeError(`seed must be a 32-bit unsigned integer, got ${String(seed)}`);
  }
  const rng: RngState = { a: 0, b: seed, c: 0, d: 1 };
  for (let i = 0; i < SEEDING_ROUNDS; i++) {
    nextU32(rng);
  }
  return rng;
}

export function nextU32(rng: RngState): number {
  const t = (rng.a + rng.b + rng.d) >>> 0;
  rng.d = (rng.d + 1) >>> 0;
  rng.a = (rng.b ^ (rng.b >>> 9)) >>> 0;
  rng.b = (rng.c + (rng.c << 3)) >>> 0;
  rng.c = (((rng.c << 21) | (rng.c >>> 11)) + t) >>> 0;
  return t;
}

export function nextFloat(rng: RngState): number {
  return nextU32(rng) / UINT32_RANGE;
}

export function nextInt(rng: RngState, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    throw new RangeError(
      `maxExclusive must be an integer in [1, 2^32], got ${String(maxExclusive)}`,
    );
  }
  return Math.floor(nextFloat(rng) * maxExclusive);
}

export function pick<T>(rng: RngState, items: readonly T[]): T {
  if (items.length === 0) {
    throw new RangeError('cannot pick from an empty list');
  }
  return items[nextInt(rng, items.length)] as T;
}
