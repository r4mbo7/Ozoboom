import { describe, expect, it } from 'vitest';
import { SUN_PALETTES, type SunMoment, relativeLuminance } from '../shared/palette';
import { uiPaletteAt } from './sun';

const MOMENTS = Object.keys(SUN_PALETTES) as SunMoment[];

function contrast(foreground: string, background: string): number {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe.each(MOMENTS)('contrast at %s', (moment) => {
  const palette = SUN_PALETTES[moment];

  it.each(['sol', 'solClair'] as const)('texte on %s reaches 4.5:1', (surface) => {
    expect(contrast(palette.texte, palette[surface])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['mage', 'tank', 'healer'] as const)('%s on sol reaches 4.5:1', (classColor) => {
    expect(contrast(palette[classColor], palette.sol)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['mage', 'tank', 'healer'] as const)(
    'the %s mark and bar on solClair reach 3:1',
    (classColor) => {
      expect(contrast(palette[classColor], palette.solClair)).toBeGreaterThanOrEqual(3);
    },
  );
});

// The ui.css `--ui-muted`: color-mix(in srgb, var(--texte) 82%, var(--sol-clair)).
function muted(texte: string, solClair: string): string {
  const mix = (shift: number) => {
    const a = (Number.parseInt(texte.slice(1), 16) >> shift) & 0xff;
    const b = (Number.parseInt(solClair.slice(1), 16) >> shift) & 0xff;
    return Math.round(a * 0.82 + b * 0.18);
  };
  return `#${[16, 8, 0].map((shift) => mix(shift).toString(16).padStart(2, '0')).join('')}`;
}

describe.each(MOMENTS)('secondary text at %s', (moment) => {
  const palette = SUN_PALETTES[moment];

  it.each(['sol', 'solClair'] as const)('muted text on %s reaches 4.5:1', (surface) => {
    expect(
      contrast(muted(palette.texte, palette.solClair), palette[surface]),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('contrast between two moments', () => {
  const fractions = Array.from({ length: 101 }, (_, index) => index / 100);

  it.each(['sol', 'solClair'] as const)(
    'texte and muted text on %s hold along the whole set',
    (surface) => {
      const worst = Math.min(
        ...fractions.map((fraction) => {
          const palette = uiPaletteAt(fraction);
          return Math.min(
            contrast(palette.texte, palette[surface]),
            contrast(muted(palette.texte, palette.solClair), palette[surface]),
          );
        }),
      );

      expect(worst).toBeGreaterThanOrEqual(4.5);
    },
  );
});
