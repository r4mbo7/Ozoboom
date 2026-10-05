import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTE_TOKENS, paletteAt } from '../shared/palette';
import {
  cssColor,
  createPixiPalette,
  isPaletteToken,
  parseHexColor,
  writePixiPalette,
} from './palette';

function cssColorTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [, name = '', value = ''] of css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const camel = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    tokens[camel] = value.toLowerCase();
  }
  return tokens;
}

describe('palette', () => {
  it('declares the sun cycle tokens in style.css with their night values', () => {
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

    const declared = cssColorTokens(css);
    const { badVibe, badVibeRim, ...night } = paletteAt(0.4);

    expect(badVibe).toBe('#4b4762');
    expect(badVibeRim).toBe('#b8c4ee');
    expect(
      Object.fromEntries(Object.keys(night).map((name) => [name, declared[name] ?? 'missing'])),
    ).toEqual(night);
  });

  it('converts every token of a moment to its numeric color', () => {
    const palette = createPixiPalette();

    writePixiPalette(palette, paletteAt(0.4));

    expect(palette.sol).toBe(0x060a1c);
    expect(palette.badVibe).toBe(0x4b4762);
    expect(Object.keys(palette)).toEqual([...PALETTE_TOKENS]);
  });

  it('overwrites the previous moment in place', () => {
    const palette = createPixiPalette();
    writePixiPalette(palette, paletteAt(0));

    writePixiPalette(palette, paletteAt(1));

    expect(palette.sol).toBe(0xefe2c2);
  });

  it('recognizes palette tokens and rejects other ids', () => {
    expect(isPaletteToken('mage')).toBe(true);
    expect(isPaletteToken('solClair')).toBe(true);
    expect(isPaletteToken('nova')).toBe(false);
  });

  it('round-trips a hex color', () => {
    const hex = '#ff2bd6';

    const color = parseHexColor(hex);

    expect(color).toBe(0xff2bd6);
    expect(cssColor(color)).toBe(hex);
  });

  it('formats a translucent color', () => {
    expect(cssColor(0x0b0618, 0.5)).toBe('rgb(11 6 24 / 0.5)');
  });

  it('rejects a malformed color', () => {
    expect(() => parseHexColor('magenta')).toThrow(/#rrggbb/);
  });
});
