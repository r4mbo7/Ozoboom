import type { Sprite } from 'pixi.js';
import type { PlayerState } from '../sim/state';
import { MAIN_TEMPO, type Tempo, ticksIntoBeat } from '../shared/tempo';
import type { Frame } from './frame';
import { TAU } from './paint';
import { CONTOUR_RING } from './textures-players';
import { setTint } from './util';

const CONTOUR_MARGIN = 4;

// Smoothly: never a flash.
export function contourAlpha(now: number, tempo: Tempo = MAIN_TEMPO): number {
  const phase = ticksIntoBeat(now, tempo) / tempo.ticksPerBeat;
  return 0.3 + 0.35 * (1 + Math.sin(phase * TAU));
}

// The ring around a player while hits cannot reach them.
export function placePlayerContour(
  contour: Sprite,
  player: Pick<PlayerState, 'invulnerableTicks'>,
  x: number,
  y: number,
  extent: number,
  scale: number,
  color: number,
  frame: Pick<Frame, 'now' | 'tempo'>,
): void {
  const invulnerable = (player.invulnerableTicks ?? 0) > 0;
  contour.visible = invulnerable;
  if (invulnerable) {
    setTint(contour, color);
    contour.position.set(x, y);
    contour.scale.set(((extent + CONTOUR_MARGIN) / CONTOUR_RING) * scale);
    contour.alpha = contourAlpha(frame.now, frame.tempo);
  }
}
