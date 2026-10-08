import type { Graphics, Sprite } from 'pixi.js';
import type { PaletteToken } from '../shared/palette';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import type { SimState, SpeakerState } from '../sim/state';
import { setTint } from './util';

const CABLE_BEND = 0.12;
const CABLE_REACH = 1.25;
const WAVES = 3;
const WAVE_SPREAD = 0.62;
const FRONT_TRAVEL = 42;
const AROUND_TRAVEL = 34;
const DRAWN_RADIUS = 40;

export const SPEAKER_TOKENS: Readonly<Record<string, PaletteToken>> = {
  'dome-chill': 'healer',
  foret: 'turquoise',
  sub: 'or',
  'cercle-acid': 'mage',
};

export interface SpeakerWaves {
  readonly front: boolean;
  readonly from: number;
}

// Drawn for a radius of 40: a drawing with a front turns it toward the scène and sends its waves
// from there, the others all around.
export const SPEAKER_WAVES: Readonly<Record<string, SpeakerWaves>> = {
  'dome-chill': { front: true, from: 44 },
  foret: { front: false, from: 54 },
  sub: { front: true, from: 28 },
  'cercle-acid': { front: false, from: 52 },
};

export function ofSpeaker<T>(record: Readonly<Record<string, T>>, id: string, what: string): T {
  const value = record[id];
  if (value === undefined) {
    throw new Error(`Speaker "${id}" has no ${what}`);
  }
  return value;
}

export function speakerToken(id: string): PaletteToken {
  return ofSpeaker(SPEAKER_TOKENS, id, 'palette token');
}

// A drawing with a front turns it, its +y, toward the scène.
export function speakerTurn(
  speaker: { id: string; x: number; y: number },
  core: { x: number; y: number },
): number {
  return ofSpeaker(SPEAKER_WAVES, speaker.id, 'waves').front
    ? Math.atan2(core.y - speaker.y, core.x - speaker.x) - Math.PI / 2
    : 0;
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

// Three waves leave the speaker over each beat, from its front or all around it, at a radius of 40.
export function drawWaves(
  view: { waves: Graphics; wavePhase: number },
  speaker: { id: string; radius: number },
  body: Sprite,
  swell: number,
  color: number,
  frame: { readonly calm: boolean; readonly now: number },
): void {
  const { waves } = view;
  const phase = frame.calm ? 0 : (frame.now / TICKS_PER_BEAT) % 1;
  setTint(waves, color);
  waves.visible = true;
  waves.position.copyFrom(body.position);
  waves.rotation = body.rotation;
  waves.scale.set((speaker.radius / DRAWN_RADIUS) * swell);
  if (view.wavePhase === phase) {
    return;
  }
  view.wavePhase = phase;
  const { front, from } = ofSpeaker(SPEAKER_WAVES, speaker.id, 'waves');
  waves.clear();
  for (let index = 0; index < WAVES; index += 1) {
    const progress = (phase + index / WAVES) % 1;
    if (front) {
      const radius = from + progress * FRONT_TRAVEL;
      const start = Math.PI / 2 - WAVE_SPREAD;
      waves
        .moveTo(Math.cos(start) * radius, Math.sin(start) * radius)
        .arc(0, 0, radius, start, Math.PI / 2 + WAVE_SPREAD);
    } else {
      waves.circle(0, 0, from + progress * AROUND_TRAVEL);
    }
    waves.stroke({ width: 3, color: 0xffffff, alpha: (1 - progress) * 0.75, cap: 'round' });
  }
}
