import { clamp01, frac, smoothstep } from '../shared/scalar';
import { TICK_MS, type Tempo } from '../shared/tempo';
import type { EnemyState, PlayerState, SimEvent } from '../sim/state';
import { easeOutCubic } from './motion';

const DIM_PEAK = 0.3;
const FALL_BEATS = 0.6;
const FALL_FROM = 1.6;
const FADE_IN_BEATS = 0.2;
export const WAVE_BEATS = 1;
const STEP_LIFT = 0.06;
const SQUASH_KICK = 0.07;
const SQUASH_MAX = 0.16;
const SQUASH_DECAY = 9;
const FLARE_BEATS = 1 / 6;
const FLARE_PEAK = 0.8;
const CALM_FLARE = { peak: 0.4, beats: 1 };
export const FROZEN_BEATS = 1;
const GLAD_BEATS = 2;
export const BURST_AT = FROZEN_BEATS + GLAD_BEATS;
const TREMBLE = 0.04;
const POP_BEATS = 0.5;
const POP = 0.18;
const GLAD_HOP = 0.1;

const TAU = Math.PI * 2;
const hop = (beats: number) => Math.sin(Math.PI * frac(beats));

export function breakDim(
  ticksToDrop: number | null,
  ticksIntoDrop: number | null,
  tempo: Tempo,
  calm: boolean,
): number {
  if (ticksToDrop !== null) {
    return ticksToDrop >= tempo.ticksPerBar
      ? 0
      : DIM_PEAK * smoothstep(1 - ticksToDrop / tempo.ticksPerBar);
  }
  if (calm && ticksIntoDrop !== null && ticksIntoDrop < tempo.ticksPerBeat) {
    return DIM_PEAK * (1 - ticksIntoDrop / tempo.ticksPerBeat);
  }
  return 0;
}

export interface Landing {
  readonly scale: number;
  readonly alpha: number;
}

export function landing(ticksSinceSpawn: number, tempo: Tempo, calm: boolean): Landing {
  const beats = Math.max(0, ticksSinceSpawn / tempo.ticksPerBeat);
  const alpha = clamp01(beats / FADE_IN_BEATS);
  if (calm) {
    return { scale: 1, alpha };
  }
  return { scale: 1 + (FALL_FROM - 1) * (1 - easeOutCubic(clamp01(beats / FALL_BEATS))), alpha };
}

export function isBossLanding(
  event: SimEvent,
  state: { readonly enemies: readonly Pick<EnemyState, 'id' | 'isBoss'>[] },
): boolean {
  return (
    event.type === 'enemySpawned' &&
    state.enemies.some((enemy) => enemy.id === event.id && enemy.isBoss)
  );
}

export function stepLift(now: number, tempo: Tempo, calm: boolean): number {
  return calm ? 0 : STEP_LIFT * hop((now - tempo.originTick) / tempo.ticksPerBeat);
}

export interface Drawn<T> {
  readonly sprite: { readonly texture: T; readonly rotation: number };
  readonly radius: number;
}

export function lastSeen<T>(
  drawn: Drawn<T> | undefined,
  still: T,
  radius: number,
): { texture: T; tilt: number; radius: number } {
  return drawn === undefined
    ? { texture: still, tilt: 0, radius }
    : { texture: drawn.sprite.texture, tilt: drawn.sprite.rotation, radius: drawn.radius };
}

// A hit without a source, an aura or a beam, comes from the player it is credited to.
export function towardHitter(
  hit: Extract<SimEvent, { type: 'enemyHit' }>,
  state: {
    readonly tick: number;
    readonly players: readonly Pick<PlayerState, 'id' | 'x' | 'y'>[];
  },
): number {
  const hitter = state.players.find((player) => player.id === hit.by);
  return hitter === undefined
    ? (state.tick * 2.4) % TAU
    : Math.atan2(hitter.y - hit.y, hitter.x - hit.x);
}

export function bossCrackStage(hp: number, maxHp: number): 0 | 1 | 2 {
  return hp * 3 < maxHp ? 2 : hp * 3 < maxHp * 2 ? 1 : 0;
}

export class Impact {
  private squash = 0;
  private squashAt = Number.NEGATIVE_INFINITY;
  private flareAt = Number.NEGATIVE_INFINITY;

  hit(now: number, tempo: Tempo): void {
    this.squash = Math.min(SQUASH_MAX, this.squashAmount(now, tempo, false) + SQUASH_KICK);
    this.squashAt = now;
    if (now - this.flareAt >= tempo.ticksPerBeat) {
      this.flareAt = now;
    }
  }

  squashAmount(now: number, tempo: Tempo, calm: boolean): number {
    const beats = (now - this.squashAt) / tempo.ticksPerBeat;
    return calm || beats < 0 ? 0 : this.squash * Math.exp(-SQUASH_DECAY * beats);
  }

  flare(now: number, tempo: Tempo, calm: boolean): number {
    const beats = (now - this.flareAt) / tempo.ticksPerBeat;
    if (beats < 0) {
      return 0;
    }
    return calm
      ? CALM_FLARE.peak * clamp01(1 - beats / CALM_FLARE.beats)
      : FLARE_PEAK * clamp01(1 - beats / FLARE_BEATS);
  }
}

export interface FarewellPose {
  readonly phase: 'frozen' | 'glad' | 'gone';
  readonly light: number;
  readonly tremble: number;
  readonly scale: number;
  readonly lift: number;
}

export function farewellPose(beats: number, calm: boolean): FarewellPose {
  if (beats < FROZEN_BEATS) {
    return {
      phase: 'frozen',
      light: clamp01(beats * 1.5),
      tremble: calm ? 0 : TREMBLE * Math.sin(beats * 80),
      scale: 1,
      lift: 0,
    };
  }
  if (beats < BURST_AT) {
    const glad = beats - FROZEN_BEATS;
    const pop = !calm && glad < POP_BEATS ? POP * Math.sin((glad / POP_BEATS) * Math.PI) : 0;
    return {
      phase: 'glad',
      light: 1,
      tremble: 0,
      scale: 1 + pop,
      lift: calm ? 0 : GLAD_HOP * hop(glad * 2),
    };
  }
  return { phase: 'gone', light: 0, tremble: 0, scale: 1, lift: 0 };
}

// Goes on in real time while the sim waits or has ended: a farewell plays under a frozen game.
export class ShowClock {
  private offset = 0;
  private frozenAt = Number.NaN;
  private frozenWall = 0;
  private last = 0;

  read(now: number, running: boolean, wallMs: number): number {
    if (running) {
      if (!Number.isNaN(this.frozenAt)) {
        this.frozenAt = Number.NaN;
        this.offset = this.last - now;
      }
      this.last = Math.max(this.last, now + this.offset);
      return this.last;
    }
    if (Number.isNaN(this.frozenAt)) {
      this.frozenAt = this.last;
      this.frozenWall = wallMs;
    }
    this.last = Math.max(this.last, this.frozenAt + (wallMs - this.frozenWall) / TICK_MS);
    return this.last;
  }

  reset(): void {
    this.offset = 0;
    this.frozenAt = Number.NaN;
    this.last = 0;
  }
}
