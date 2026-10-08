import { TICKS_PER_BEAT } from '../shared/tempo';
import type { EntityId, SimEvent } from '../sim/state';
import { MIN_TICKS_BETWEEN_FLASHES } from './motion';

export const GLINT_TICKS = TICKS_PER_BEAT / 2;
export const CALM_GLINT_TICKS = 2 * TICKS_PER_BEAT;
export const GLINT_PEAK = 0.7;
export const CALM_GLINT_PEAK = GLINT_PEAK / 2;
const REACH = 0.1;

interface Placeable {
  readonly position: { set(x: number, y: number): void };
  rotation: number;
}

export function frontGlintOf(event: SimEvent): EntityId | undefined {
  return event.type === 'enemyHit' && event.front === true ? event.id : undefined;
}

// A burst of hits lights the guard at most three times a second; the calm mode holds it lit instead.
export function glintStart(tick: number, start: number, calm: boolean): number {
  return calm || tick - start >= MIN_TICKS_BETWEEN_FLASHES ? tick : start;
}

export function glintAlpha(now: number, start: number, calm: boolean): number {
  const age = now - start;
  if (age < 0) {
    return 0;
  }
  if (calm) {
    const left = CALM_GLINT_TICKS - age;
    return left <= 0 ? 0 : CALM_GLINT_PEAK * Math.min(1, left / (CALM_GLINT_TICKS / 2));
  }
  return age >= GLINT_TICKS ? 0 : GLINT_PEAK * (1 - age / GLINT_TICKS);
}

export function placeGlint(
  target: Placeable,
  x: number,
  y: number,
  heading: number,
  radius: number,
): void {
  target.position.set(
    x + Math.cos(heading) * radius * REACH,
    y + Math.sin(heading) * radius * REACH,
  );
  target.rotation = heading;
}
