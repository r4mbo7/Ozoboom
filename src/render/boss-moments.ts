import { TICK_MS, type Tempo } from '../shared/tempo';
import type { SimEvent, SimState } from '../sim/state';

// What every boss shares, from its arrival to its farewell, in beats of the scene. Pure timing: the
// boss family turns it into sprites.

export const DIM_PEAK = 0.3;
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
export const GLAD_BEATS = 2;
export const BURST_AT = FROZEN_BEATS + GLAD_BEATS;
const TREMBLE = 0.04;
const POP_BEATS = 0.5;
const POP = 0.18;
const GLAD_HOP = 0.1;

const TAU = Math.PI * 2;
const ease = (p: number) => p * p * (3 - 2 * p);
const easeOut = (p: number) => 1 - (1 - p) ** 3;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const hop = (beats: number) => Math.sin(Math.PI * (((beats % 1) + 1) % 1));

// The floor darkens over the bar before the drop while the boss takes shape, and lights up again
// as it lands: at once, or over a beat in calm mode.
export function breakDim(
  ticksToDrop: number | null,
  ticksIntoDrop: number | null,
  tempo: Tempo,
  calm: boolean,
): number {
  if (ticksToDrop !== null) {
    return ticksToDrop >= tempo.ticksPerBar
      ? 0
      : DIM_PEAK * ease(1 - ticksToDrop / tempo.ticksPerBar);
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

// It falls on the one of the drop: big and transparent, it shrinks to its size as it lands. In calm
// mode it fades in where it stands.
export function landing(ticksSinceSpawn: number, tempo: Tempo, calm: boolean): Landing {
  const beats = Math.max(0, ticksSinceSpawn / tempo.ticksPerBeat);
  const alpha = clamp01(beats / FADE_IN_BEATS);
  if (calm) {
    return { scale: 1, alpha };
  }
  return { scale: 1 + (FALL_FROM - 1) * (1 - easeOut(clamp01(beats / FALL_BEATS))), alpha };
}

// A boss lands on the drop: the screen shakes as for a bomb.
export function isBossLanding(event: SimEvent, state: Pick<SimState, 'enemies'>): boolean {
  return (
    event.type === 'enemySpawned' &&
    state.enemies.some((enemy) => enemy.id === event.id && enemy.isBoss)
  );
}

// One step on every beat: how high the mask is lifted, in boss radii.
export function stepLift(now: number, tempo: Tempo, calm: boolean): number {
  return calm ? 0 : STEP_LIFT * hop((now - tempo.originTick) / tempo.ticksPerBeat);
}

export interface Drawn<T> {
  readonly sprite: { readonly texture: T; readonly rotation: number };
  readonly radius: number;
}

// How a chased boss was last drawn: standing still at its own size if it died before it was drawn.
export function lastSeen<T>(
  drawn: Drawn<T> | undefined,
  still: T,
  radius: number,
): { texture: T; tilt: number; radius: number } {
  return drawn === undefined
    ? { texture: still, tilt: 0, radius }
    : { texture: drawn.sprite.texture, tilt: drawn.sprite.rotation, radius: drawn.radius };
}

// A hit without a source, an aura or a beam: it comes from the player it is credited to.
export function towardHitter(
  hit: Extract<SimEvent, { type: 'enemyHit' }>,
  state: Pick<SimState, 'tick' | 'players'>,
): number {
  const hitter = state.players.find((player) => player.id === hit.by);
  return hitter === undefined
    ? (state.tick * 2.4) % TAU
    : Math.atan2(hitter.y - hit.y, hitter.x - hit.x);
}

// A boss cracks at two thirds of its life, then at one third.
export function bossCrackStage(hp: number, maxHp: number): 0 | 1 | 2 {
  return hp * 3 < maxHp ? 2 : hp * 3 < maxHp * 2 ? 1 : 0;
}

// The hits a boss takes: each squashes it a little more, and whitens its rim for an instant. Calm
// mode does not squash, and its rim whitens softly and stays white while the hits go on.
export class Impact {
  private squash = 0;
  private squashAt = Number.NEGATIVE_INFINITY;
  private flareAt = Number.NEGATIVE_INFINITY;

  // The rim whitens at most once a beat, however fast the hits come.
  hit(now: number, tempo: Tempo): void {
    this.squash = Math.min(SQUASH_MAX, this.squashAmount(now, tempo, false) + SQUASH_KICK);
    this.squashAt = now;
    if (now - this.flareAt >= tempo.ticksPerBeat) {
      this.flareAt = now;
    }
  }

  // Width grows by this share, height shrinks by 0.7 of it.
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
  // Frozen with its cracks lit, then glad in the color of whoever chased it, then gone in colors.
  readonly phase: 'frozen' | 'glad' | 'gone';
  // Gold light through the cracks, from 0 to 1.
  readonly light: number;
  // Sideways shake, in boss radii.
  readonly tremble: number;
  readonly scale: number;
  // How high it hops, in boss radii.
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

// The ticks of what is on screen. They follow the sim while it runs, and go on in real time while it
// waits for a choice or has ended, so that a boss's farewell plays out under a frozen game.
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
