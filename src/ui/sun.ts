import {
  PALETTE_TOKENS,
  type PaletteToken,
  SUN_PALETTES,
  type SunPalette,
  paletteAt,
} from '../shared/palette';

const MIN_FRACTION_STEP = 0.01;

export function cssName(token: PaletteToken): string {
  return `--${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function applyPalette(target: HTMLElement, palette: SunPalette): void {
  for (const token of PALETTE_TOKENS) {
    target.style.setProperty(cssName(token), palette[token]);
  }
}

export interface SunFollower {
  follow(fraction: number): void;
  fix(moment: 'nuit' | 'jour'): void;
  clear(): void;
}

// Writes the palette of the set time as CSS variables, only when it moved by more than a hundredth.
export function createSunFollower(target: HTMLElement): SunFollower {
  let applied: number | null = null;
  return {
    follow(fraction) {
      if (applied !== null && Math.abs(fraction - applied) <= MIN_FRACTION_STEP) {
        return;
      }
      applied = fraction;
      applyPalette(target, paletteAt(fraction));
    },
    clear() {
      applied = null;
      for (const token of PALETTE_TOKENS) {
        target.style.removeProperty(cssName(token));
      }
    },
    fix(moment) {
      applied = null;
      applyPalette(target, SUN_PALETTES[moment]);
    },
  };
}
