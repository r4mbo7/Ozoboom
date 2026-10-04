import { PALETTE_TOKENS, type PaletteToken, type SunPalette } from '../shared/palette';

export type PixiPalette = Record<PaletteToken, number>;

export function cssColor(color: number, alpha = 1): string {
  if (alpha >= 1) {
    return `#${color.toString(16).padStart(6, '0')}`;
  }
  const channels = [color >> 16, (color >> 8) & 0xff, color & 0xff].map(String).join(' ');
  return `rgb(${channels} / ${String(alpha)})`;
}

export function parseHexColor(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Expected a #rrggbb color, got "${hex}"`);
  }
  return Number.parseInt(hex.slice(1), 16);
}

export function createPixiPalette(): PixiPalette {
  const palette = {} as PixiPalette;
  for (const token of PALETTE_TOKENS) {
    palette[token] = 0;
  }
  return palette;
}

export function writePixiPalette(into: PixiPalette, palette: SunPalette): void {
  for (const token of PALETTE_TOKENS) {
    into[token] = parseHexColor(palette[token]);
  }
}

export function isPaletteToken(id: string): id is PaletteToken {
  return (PALETTE_TOKENS as readonly string[]).includes(id);
}
