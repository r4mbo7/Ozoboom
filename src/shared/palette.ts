import { FULL_TINTS } from './full';

const BASE_TOKENS = [
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

type BaseToken = (typeof BASE_TOKENS)[number];

export type SunMoment = 'crepuscule' | 'nuit' | 'aube' | 'jour';

export type ClassTint = Readonly<Record<SunMoment, string>>;

type FullTintId = keyof typeof FULL_TINTS;

export type SunPalette = (typeof SUN_PALETTES)[SunMoment];

export type PaletteToken = keyof SunPalette;

const FULL_TINT_IDS = Object.keys(FULL_TINTS) as FullTintId[];

export const PALETTE_TOKENS: readonly PaletteToken[] = [...BASE_TOKENS, ...FULL_TINT_IDS];

// The tint of a class is the token of its id: the three classes, then the characters of the full game.
export const CLASS_TOKENS: readonly PaletteToken[] = ['mage', 'tank', 'healer', ...FULL_TINT_IDS];

export function isClassToken(id: string): id is PaletteToken {
  return (CLASS_TOKENS as readonly string[]).includes(id);
}

export interface Light {
  additive: boolean;
  haloAlpha: number;
}

const BASE_PALETTES: Record<SunMoment, Record<BaseToken, string>> = {
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

export const SUN_PALETTES = withClassTints<BaseToken, FullTintId>(BASE_PALETTES, FULL_TINTS);

// Each tint joins the palette of every moment under the id of its class.
export function withClassTints<B extends string, C extends string>(
  palettes: Readonly<Record<SunMoment, Readonly<Record<B, string>>>>,
  tints: Readonly<Record<C, ClassTint>>,
): Record<SunMoment, Record<B | C, string>> {
  const tinted = {} as Record<SunMoment, Record<B | C, string>>;
  for (const moment of Object.keys(palettes) as SunMoment[]) {
    const palette: Record<string, string> = { ...palettes[moment] };
    for (const [id, tint] of Object.entries<ClassTint>(tints)) {
      if (id in palette) {
        throw new Error(`The tint of class "${id}" would replace a token of the palette`);
      }
      palette[id] = tint[moment];
    }
    tinted[moment] = palette;
  }
  return tinted;
}

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
  return momentAt(SUN_PALETTES, fraction);
}

export function spanAt(fraction: number): { from: SunMoment; to: SunMoment; mix: number } {
  const t = clamp01(fraction);
  const next = Math.max(
    1,
    STOPS.findIndex(([at]) => at >= t),
  );
  const [fromAt, from] = STOPS[next - 1] ?? [0, 'crepuscule'];
  const [toAt, to] = STOPS[next] ?? [1, 'jour'];
  return { from, to, mix: (t - fromAt) / (toAt - fromAt) };
}

// A table of the four moments at an hour: its `#rrggbb` colors mixed channel by channel, its numbers linearly.
export function momentAt<T extends Readonly<Record<keyof T, string | number>>>(
  table: Record<SunMoment, T>,
  fraction: number,
): T {
  const { from, to, mix } = spanAt(fraction);
  const mixed: Partial<Record<keyof T, string | number>> = {};
  for (const key of Object.keys(table[from]) as (keyof T)[]) {
    const a = table[from][key];
    const b = table[to][key];
    mixed[key] =
      typeof a === 'number' && typeof b === 'number'
        ? a * (1 - mix) + b * mix
        : mixHex(String(a), String(b), mix);
  }
  return mixed as T;
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
