import type { Graphics } from 'pixi.js';
import type { PaletteToken } from '../shared/palette';
import { TICKS_PER_BAR } from '../shared/tempo';
import type { SimState, SpeakerState } from '../sim/state';

const TAU = Math.PI * 2;
const RING_START = -Math.PI / 2;
const CABLE_BEND = 0.12;
const CABLE_REACH = 1.25;

export const SPEAKER_TOKENS: Readonly<Record<string, PaletteToken>> = {
  'dome-chill': 'healer',
  foret: 'turquoise',
  sub: 'or',
  'cercle-acid': 'mage',
};

export function speakerToken(id: string): PaletteToken {
  const token = SPEAKER_TOKENS[id];
  if (token === undefined) {
    throw new Error(`Speaker "${id}" has no palette token`);
  }
  return token;
}

export function plugShare(plugTicks: number, plugBars: number): number {
  const needed = plugBars * TICKS_PER_BAR;
  return needed > 0 ? Math.min(1, Math.max(0, plugTicks / needed)) : 0;
}

export function mixColor(from: number, to: number, share: number): number {
  const channel = (shift: number) => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * share);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function strokeCircle(ring: Graphics, radius: number, share: number, width: number): void {
  if (share <= 0) {
    return;
  }
  ring.moveTo(Math.cos(RING_START) * radius, Math.sin(RING_START) * radius);
  if (share >= 1) {
    ring.circle(0, 0, radius);
  } else {
    ring.arc(0, 0, radius, RING_START, RING_START + share * TAU);
  }
  ring.stroke({ width, color: 0xffffff, cap: 'round' });
}

export function drawCable(
  view: { cable: Graphics; cableGlow: Graphics; cableKey: string },
  speaker: SpeakerState,
  state: SimState,
): void {
  const { core } = state;
  const key = `${String(speaker.x)},${String(speaker.y)},${String(core.x)},${String(core.y)},${String(core.radius)}`;
  if (view.cableKey === key) {
    return;
  }
  view.cableKey = key;
  const dx = core.x - speaker.x;
  const dy = core.y - speaker.y;
  const length = Math.hypot(dx, dy);
  const ux = length > 0 ? dx / length : 1;
  const uy = length > 0 ? dy / length : 0;
  const endX = core.x - ux * core.radius * CABLE_REACH;
  const endY = core.y - uy * core.radius * CABLE_REACH;
  const bendX = (speaker.x + endX) / 2 - uy * length * CABLE_BEND;
  const bendY = (speaker.y + endY) / 2 + ux * length * CABLE_BEND;
  for (const [line, width] of [
    [view.cable, 3],
    [view.cableGlow, 9],
  ] as const) {
    line.clear();
    line.moveTo(speaker.x, speaker.y).quadraticCurveTo(bendX, bendY, endX, endY);
    line.stroke({ width, color: 0xffffff, cap: 'round' });
  }
}
