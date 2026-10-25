import {
  PALETTE_TOKENS,
  type PaletteToken,
  type SunPalette,
  isClassToken,
} from '../shared/palette';
import { recordOf } from '../shared/records';

export type PixiPalette = Record<PaletteToken, number>;

export function parseHexColor(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Expected a #rrggbb color, got "${hex}"`);
  }
  return Number.parseInt(hex.slice(1), 16);
}

export function mixColor(from: number, to: number, amount: number): number {
  const channel = (shift: number): number => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * amount);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function createPixiPalette(): PixiPalette {
  return recordOf(PALETTE_TOKENS, () => 0);
}

export function writePixiPalette(into: PixiPalette, palette: SunPalette): void {
  for (const token of PALETTE_TOKENS) {
    into[token] = parseHexColor(palette[token]);
  }
}

export function classTokens(
  classes: readonly { readonly id: string }[],
): Map<string, PaletteToken> {
  return new Map(
    classes.map(({ id }): [string, PaletteToken] => {
      if (!isClassToken(id)) {
        throw new Error(`Class "${id}" has no tint`);
      }
      return [id, id];
    }),
  );
}
