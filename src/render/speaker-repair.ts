import type { Graphics, Sprite } from 'pixi.js';
import { clamp01, smoothstep } from '../shared/scalar';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { SpeakerState } from '../sim/state';
import type { Frame } from './frame';
import { WHITE, mixColor } from './palette';
import { alongCable, cablePath } from './speaker-kit';
import { REPAIR_ARRIVAL } from './stage-repair';
import type { Shape } from './textures';
import { setTint } from './util';

export const BOLT_TICKS = REPAIR_ARRIVAL;
export const BOLT_TAIL = 3;
const BOLT_REACH = 0.7;
const TAIL_STEP = 0.05;
const CABLE_SURGE_TICKS = TICKS_PER_BEAT;

// Slow out of the speaker, quick into the stage.
function boltAt(share: number): number {
  const clamped = clamp01(share);
  return smoothstep(clamped) * 0.8 + clamped * 0.2;
}

export function drawRepair(
  view: { bolt: Sprite; tail: readonly Sprite[]; cableGlow: Graphics },
  speaker: SpeakerState,
  core: { x: number; y: number; radius: number },
  start: number | undefined,
  color: number,
  frame: Frame,
  halo: Shape,
): void {
  const age = frame.now - (start ?? Number.NEGATIVE_INFINITY);
  const { bolt, tail, cableGlow } = view;
  const running = !frame.calm && age >= 0 && age < BOLT_TICKS;
  bolt.visible = running;
  for (const sprite of tail) {
    sprite.visible = running;
  }
  if (running) {
    const path = cablePath(speaker, core);
    const share = age / BOLT_TICKS;
    const head = mixColor(color, WHITE, 0.5);
    const at = alongCable(path, boltAt(share));
    setTint(bolt, head);
    bolt.position.set(at.x, at.y);
    bolt.scale.set((speaker.radius * BOLT_REACH) / halo.radius);
    bolt.alpha = 1;
    for (const [index, sprite] of tail.entries()) {
      const behind = index + 1;
      const point = alongCable(path, boltAt(share - behind * TAIL_STEP));
      setTint(sprite, head);
      sprite.position.set(point.x, point.y);
      sprite.scale.set((speaker.radius * (12 - 2 * behind)) / 20 / halo.radius);
      sprite.alpha = 0.5 - 0.12 * behind;
    }
  }
  const surge = age >= 0 && age < CABLE_SURGE_TICKS ? 1 - age / CABLE_SURGE_TICKS : 0;
  cableGlow.alpha = Math.max(cableGlow.alpha, surge * frame.light.haloAlpha);
}
