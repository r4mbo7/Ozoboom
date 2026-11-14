import { PALETTE_TOKENS, type PaletteToken, SUN_PALETTES } from '../shared/palette';
import { cssName } from './sun';

const PANELS = ':is(.ui-card, .ui-end-card, .ui-button)';

function hourName(token: PaletteToken): string {
  return `--ui-heure-${cssName(token).slice(2)}`;
}

function hourValue(token: PaletteToken): string {
  if (token === 'sol') {
    return 'var(--ui-voile)';
  }
  if (token === 'solClair') {
    return 'var(--ui-voile-clair)';
  }
  return `var(${hourName(token)})`;
}

function declare(value: (token: PaletteToken) => string): string {
  return PALETTE_TOKENS.map((token) => `${cssName(token)}: ${value(token)};`).join(' ');
}

// A menu over the game never dazzles: the night's colours at every hour, the hour's on its panels.
export function veilStyle(): string {
  const hour = PALETTE_TOKENS.map((token) => `${hourName(token)}: var(${cssName(token)});`);
  return [
    `.ui { ${hour.join(' ')} }`,
    `.ui .ui-overlay { ${declare((token) => SUN_PALETTES.nuit[token])} }`,
    `.ui .ui-overlay ${PANELS} { ${declare(hourValue)} }`,
  ].join('\n');
}
