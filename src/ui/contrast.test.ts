import { describe, expect, it } from 'vitest';
import { SUN_PALETTES, type SunMoment, relativeLuminance } from '../shared/palette';

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
});
