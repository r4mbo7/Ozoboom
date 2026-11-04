import type { Tempo } from '../shared/tempo';
import type { EntityId, PlayerId, TrapState } from '../sim/state';

// Until a player moves a trap, the oldest one at their name kicks on every beat to call them: its
// body bounces and a bass ring flies out of it over half a beat, as the Caisson plays its music.
const KICK_BEATS = 0.5;
const BOUNCE = 0.15;
const RING_FROM = 1.2;
const RING_TO = 2.8;
const RING_ALPHA = 0.9;
// Calm mode holds the ring still, halfway out.
const CALM_RING = 2;
const CALM_ALPHA = 0.55;

export function callingTraps(
  traps: readonly Pick<TrapState, 'id' | 'ownerId'>[],
  callers: readonly PlayerId[],
): ReadonlySet<EntityId> {
  const oldest = new Map<PlayerId, EntityId>();
  for (const trap of traps) {
    const found = oldest.get(trap.ownerId);
    if (callers.includes(trap.ownerId) && (found === undefined || trap.id < found)) {
      oldest.set(trap.ownerId, trap.id);
    }
  }
  return new Set(oldest.values());
}

export interface TrapKick {
  // Times the body's size.
  readonly bounce: number;
  // Times the trap's radius.
  readonly ring: number;
  readonly ringAlpha: number;
}

export function trapKick(ticksSinceBeat: number, tempo: Tempo, calm: boolean): TrapKick {
  if (calm) {
    return { bounce: 1, ring: CALM_RING, ringAlpha: CALM_ALPHA };
  }
  const progress = Math.min(1, Math.max(0, ticksSinceBeat / (tempo.ticksPerBeat * KICK_BEATS)));
  const left = 1 - progress;
  const out = 1 - left * left;
  return {
    bounce: 1 + BOUNCE * left * left,
    ring: RING_FROM + (RING_TO - RING_FROM) * out,
    ringAlpha: RING_ALPHA * left,
  };
}
