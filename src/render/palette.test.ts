import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { paletteAt } from '../shared/palette';
import { PALETTE, cssColor, parseHexColor } from './palette';

function cssColorTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [, name = '', value = ''] of css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const camel = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    tokens[camel] = value.toLowerCase();
  }
  return tokens;
}

function pick(tokens: Record<string, string>, names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, tokens[name] ?? 'missing']));
}

describe('palette', () => {
  it('keeps the legacy color tokens declared in style.css', () => {
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

    const declared = cssColorTokens(css);
    const rendered = Object.fromEntries(
      Object.entries(PALETTE).map(([token, color]) => [token, cssColor(color)]),
    );

    expect(pick(declared, Object.keys(PALETTE))).toEqual(rendered);
  });

  it('declares the sun cycle tokens in style.css with their night values', () => {
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

    const declared = cssColorTokens(css);
    const { badVibe, ...night } = paletteAt(0.4);

    expect(badVibe).toBe('#4b4762');
    expect(pick(declared, Object.keys(night))).toEqual(night);
  });

  it('round-trips a hex color', () => {
    const hex = '#ff2bd6';

    const color = parseHexColor(hex);

    expect(color).toBe(PALETTE.uvMagenta);
    expect(cssColor(color)).toBe(hex);
  });

  it('formats a translucent color', () => {
    expect(cssColor(PALETTE.night, 0.5)).toBe('rgb(11 6 24 / 0.5)');
  });

  it('rejects a malformed color', () => {
    expect(() => parseHexColor('magenta')).toThrow(/#rrggbb/);
  });
});
