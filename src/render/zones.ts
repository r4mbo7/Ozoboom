// Alphas of the soft zones of the special bad vibes. They are constants: a zone never pulses or
// blinks, so a Filmeur cannot add to the flashes per second counted by FlashLimiter.
export const ZONE_ALPHA = {
  suppress: { normal: 0.4, calm: 0.26 },
  yawn: { normal: 0.14, calm: 0.08 },
  dazzleVeil: { normal: 0.12, calm: 0.07 },
  dazzleCone: { normal: 0.38, calm: 0.22 },
} as const;

export type ZoneKind = keyof typeof ZONE_ALPHA;

export function zoneAlpha(kind: ZoneKind, calm: boolean): number {
  return calm ? ZONE_ALPHA[kind].calm : ZONE_ALPHA[kind].normal;
}
