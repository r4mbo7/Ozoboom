import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = [
  readFileSync(new URL('../style.css', import.meta.url), 'utf8'),
  readFileSync(new URL('./ui.css', import.meta.url), 'utf8'),
].join('\n');

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css);
  if (match?.[1] === undefined) {
    throw new Error(`token --${name} is not a hex colour`);
  }
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const TEXT_TOKENS = ['glow', 'ui-muted', 'uv-cyan', 'uv-lime', 'uv-magenta', 'sun-orange'];

describe('text contrast', () => {
  it.each(TEXT_TOKENS.flatMap((text) => ['night', 'ink'].map((surface) => [text, surface])))(
    '--%s on --%s reaches 4.5:1',
    (text, surface) => {
      expect(contrast(token(text), token(surface))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('keeps dark text readable on the cyan call to action', () => {
    expect(contrast(token('night'), token('uv-cyan'))).toBeGreaterThanOrEqual(4.5);
  });
});
