export const PALETTE_TOKENS = [
  'sol',
  'solClair',
  'or',
  'turquoise',
  'noyau',
  'mage',
  'tank',
  'healer',
  'badVibe',
  'badVibeRim',
  'texte',
  'rouge',
] as const;

export type PaletteToken = (typeof PALETTE_TOKENS)[number];

export type SunPalette = Record<PaletteToken, string>;

export type SunMoment = 'crepuscule' | 'nuit' | 'aube' | 'jour';

export interface Light {
  additive: boolean;
  haloAlpha: number;
}

export const SUN_PALETTES: Record<SunMoment, SunPalette> = {
  crepuscule: {
    sol: '#2a1830',
    solClair: '#5a2c48',
    or: '#f0b050',
    turquoise: '#5fd0c8',
    noyau: '#ffc860',
    mage: '#ff6fa8',
    tank: '#ff9a3d',
    healer: '#7cf2b0',
    badVibe: '#5a4c64',
    badVibeRim: '#f2c4a0',
    texte: '#fbeee0',
    rouge: '#ff5a52',
  },
  nuit: {
    sol: '#060a1c',
    solClair: '#101a3c',
    or: '#d9a441',
    turquoise: '#3fd0c9',
    noyau: '#ffd27a',
    mage: '#ff6fa8',
    tank: '#ff9a3d',
    healer: '#7cf2b0',
    badVibe: '#4b4762',
    badVibeRim: '#b8c4ee',
    texte: '#f6ecd2',
    rouge: '#ff5a52',
  },
  aube: {
    sol: '#e9c9b6',
    solClair: '#f8e3d2',
    or: '#b07a1a',
    turquoise: '#1c8a86',
    noyau: '#d68400',
    mage: '#a61d56',
    tank: '#973a0d',
    healer: '#126346',
    badVibe: '#6c6276',
    badVibeRim: '#fff0e4',
    texte: '#2c1e18',
    rouge: '#b3261e',
  },
  jour: {
    sol: '#efe2c2',
    solClair: '#fbf3dc',
    or: '#a8781f',
    turquoise: '#1f8a84',
    noyau: '#c98a12',
    mage: '#b8246a',
    tank: '#a64713',
    healer: '#14724d',
    badVibe: '#66606e',
    badVibeRim: '#fffaf0',
    texte: '#2b2010',
    rouge: '#be281d',
  },
};

export interface SandPalette {
  sable: string;
  sableClair: string;
  ride: string;
}

// The sand of the Dome under the same four moments as SUN_PALETTES: it replaces sol and solClair on its ground only.
export const SAND_PALETTES: Record<SunMoment, SandPalette> = {
  crepuscule: { sable: '#55363c', sableClair: '#74484a', ride: '#7a4a52' },
  nuit: { sable: '#211b2e', sableClair: '#322840', ride: '#463a5a' },
  aube: { sable: '#e2c39c', sableClair: '#efd7b2', ride: '#c9a47a' },
  jour: { sable: '#ebd3a0', sableClair: '#f6e5bf', ride: '#d2b07c' },
};

export const NIGHT_START = 0.25;
export const NIGHT_END = 0.6;
export const DAWN_AT = 0.85;

const ADDITIVE_BELOW_LUMINANCE = 0.18;
const NIGHT_HALO_ALPHA = 1;
const DAY_HALO_ALPHA = 0.5;

const STOPS: readonly (readonly [number, SunMoment])[] = [
  [0, 'crepuscule'],
  [NIGHT_START, 'nuit'],
  [NIGHT_END, 'nuit'],
  [DAWN_AT, 'aube'],
  [1, 'jour'],
];

export function paletteAt(fraction: number): SunPalette {
  return mixAt(SUN_PALETTES, PALETTE_TOKENS, fraction);
}

export function sandAt(fraction: number): SandPalette {
  return mixAt(SAND_PALETTES, ['sable', 'sableClair', 'ride'], fraction);
}

function mixAt<K extends string>(
  palettes: Record<SunMoment, Record<K, string>>,
  tokens: readonly K[],
  fraction: number,
): Record<K, string> {
  const t = clamp01(fraction);
  const next = Math.max(
    1,
    STOPS.findIndex(([at]) => at >= t),
  );
  const [fromAt, fromMoment] = STOPS[next - 1] ?? [0, 'crepuscule'];
  const [toAt, toMoment] = STOPS[next] ?? [1, 'jour'];
  const from = palettes[fromMoment];
  const to = palettes[toMoment];
  const mix = (t - fromAt) / (toAt - fromAt);
  const mixed = {} as Record<K, string>;
  for (const token of tokens) {
    mixed[token] = mixHex(from[token], to[token], mix);
  }
  return mixed;
}

export function lightAt(fraction: number): Light {
  const t = clamp01(fraction);
  const dayMix = clamp01((t - NIGHT_END) / (1 - NIGHT_END));
  return {
    additive: relativeLuminance(paletteAt(t).sol) < ADDITIVE_BELOW_LUMINANCE,
    haloAlpha: NIGHT_HALO_ALPHA + (DAY_HALO_ALPHA - NIGHT_HALO_ALPHA) * dayMix,
  };
}

export function relativeLuminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = channels(hex).map((value) => linearize(value / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function channels(hex: string): number[] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 0xff, value & 0xff];
}

function mixHex(from: string, to: string, mix: number): string {
  const a = channels(from);
  const b = channels(to);
  const rgb = a.map((value, index) => Math.round(value + ((b[index] ?? value) - value) * mix));
  return `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// sRGB to linear light. x^2.4 is x^2 times x^(2/5), the latter from a bisected fifth root:
// Math.pow is not reproducible across engines, so shared does not use it.
function linearize(value: number): number {
  if (value <= 0.04045) {
    return value / 12.92;
  }
  const x = (value + 0.055) / 1.055;
  const root = fifthRoot(x);
  return x * x * root * root;
}

function fifthRoot(x: number): number {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (mid * mid * mid * mid * mid < x) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}
