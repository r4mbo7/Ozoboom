import type { Container } from 'pixi.js';
import { frac, lerp } from '../shared/scalar';
import { isPotionBoost } from '../sim/potion-shield';
import type { PlayerState, SimEvent } from '../sim/state';
import { KEEP_PER_TICK, MAX_STEP_TICKS } from './drop-filter';
import type { Frame } from './frame';
import { TAU } from './paint';
import { WHITE, mixColor } from './palette';
import type { LookInput } from './player-look';

export const HUES = [0xff2fa8, 0xff7a1a, 0xffc81f, 0xa8f52a, 0x1fe0cf, 0x9b5cff] as const;
export const OUTLINE = { color: 0x040612, alpha: 0.9 };
// Lengths are in pixels for a player of this radius, and grow with his.
export const DRAWN_RADIUS = 14;
export const STRENGTH = { smallest: 0.45, blink: 0.35, calmFade: 0.7 };
const TRAIL_GONE = 0.02;
// Prints of the trail a radius apart at most, and none across a jump (a revive, a teleport).
const TRAIL_FILL = { spacing: 0.5, max: 8, jump: 10 };
const GLINT_MAX = 16;

export function hueAt(angle: number, turn: number): number {
  const at = frac((angle - turn) / TAU) * HUES.length;
  const index = Math.floor(at);
  return mixColor(
    HUES[index % HUES.length] ?? WHITE,
    HUES[(index + 1) % HUES.length] ?? WHITE,
    at - index,
  );
}

// The beats the flames flicker on: stopped in calm mode, where they hold still.
export function flameClock(frame: Pick<Frame, 'now' | 'tempo' | 'calm'>): number {
  return frame.calm ? 0 : frame.now / frame.tempo.ticksPerBeat;
}

export class PoweredBody {
  readonly body: Container;
  playerId = 0;
  x = 0;
  y = 0;
  facing = 0;
  heading = 0;
  moving = 0;
  radius = DRAWN_RADIUS;
  extent = DRAWN_RADIUS;
  reach = 1;
  alpha = 1;

  constructor(body: Container) {
    this.body = body;
  }

  place(
    player: Pick<PlayerState, 'id' | 'radius'>,
    x: number,
    y: number,
    facing: number,
    heading: number,
    moving: number,
    extent: number,
  ): void {
    this.playerId = player.id;
    this.radius = player.radius;
    this.x = x;
    this.y = y;
    this.facing = facing;
    this.heading = heading;
    this.moving = moving;
    this.extent = extent;
  }

  light(
    player: PlayerState,
    bars: number | undefined,
    frame: Pick<Frame, 'tempo' | 'calm' | 'pulse'>,
  ): boolean {
    const boost = player.boosts?.find(isPotionBoost);
    if (bars === undefined || boost === undefined || player.downed || player.gone === true) {
      return false;
    }
    const { ticksPerBar } = frame.tempo;
    const barsLeft = Math.ceil(boost.ticksLeft / ticksPerBar);
    this.reach = lerp(STRENGTH.smallest, 1, Math.min(1, barsLeft / bars));
    if (barsLeft > 1) {
      this.alpha = 1;
    } else if (frame.calm) {
      this.alpha = 1 - STRENGTH.calmFade * (1 - boost.ticksLeft / ticksPerBar);
    } else {
      this.alpha = lerp(STRENGTH.blink, 1, frame.pulse);
    }
    return true;
  }
}

export class PotionBodies {
  readonly layer: Container;
  readonly powered: PoweredBody[] = [];

  constructor(layer: Container) {
    this.layer = layer;
  }

  expose(body: PoweredBody, look: LookInput, extent: number): void {
    const { player, frame } = look;
    if (body.light(player, frame.set.potion?.bars, frame)) {
      body.place(player, look.x, look.y, look.angle, look.heading, look.moving, extent);
      this.powered.push(body);
    }
  }
}

// The prints of the trail between a player's place last frame and now.
export function trailFill(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  radius: number,
): number {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  if (distance > TRAIL_FILL.jump * radius) {
    return 1;
  }
  return Math.min(TRAIL_FILL.max, Math.max(1, Math.ceil(distance / (TRAIL_FILL.spacing * radius))));
}

// How bright the trail's buffer still is: full on a frame that stamps a player in it, then
// fading as the drop's echoes do, until nothing shows and the buffer can rest.
export class TrailFade {
  left = 0;
  private now = Number.NEGATIVE_INFINITY;

  // The share of last frame's buffer to keep, 0 for none; null when no tick went by, so the
  // buffer stays as it is.
  step(now: number, stamping: boolean, calm: boolean): number | null {
    const ticks = Math.min(now - this.now, MAX_STEP_TICKS);
    this.now = now;
    if (calm) {
      this.left = 0;
      return 0;
    }
    if (ticks <= 0) {
      return null;
    }
    const keep = KEEP_PER_TICK ** ticks;
    this.left = stamping ? 1 : this.left * keep;
    return keep;
  }

  get shows(): boolean {
    return this.left >= TRAIL_GONE;
  }

  clear(): void {
    this.left = 0;
  }
}

interface Glint {
  x: number;
  y: number;
  start: number;
  age: number;
}

export class PotionGlints {
  private readonly glints: Glint[] = [];

  onEvent(event: SimEvent, now: number): void {
    if (event.type === 'potionBounced' && this.glints.length < GLINT_MAX) {
      this.glints.push({ x: event.x, y: event.y, start: now, age: 0 });
    }
  }

  live(now: number, ticks: number): readonly Glint[] {
    let kept = 0;
    for (const glint of this.glints) {
      glint.age = (now - glint.start) / ticks;
      if (glint.age >= 0 && glint.age < 1) {
        this.glints[kept] = glint;
        kept += 1;
      }
    }
    this.glints.length = kept;
    return this.glints;
  }

  clear(): void {
    this.glints.length = 0;
  }
}
