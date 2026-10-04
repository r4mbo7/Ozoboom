export const PALETTE = {
  night: 0x0b0618,
  ink: 0x1a1030,
  uvMagenta: 0xff2bd6,
  uvCyan: 0x2bf0ff,
  uvLime: 0xb6ff2b,
  sunOrange: 0xff8c2b,
  badVibe: 0x5a506b,
  glow: 0xf4f0ff,
} as const;

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
