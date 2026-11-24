import type { Container, Sprite } from 'pixi.js';
import { lerp } from '../shared/scalar';
import { MAIN_TEMPO, type Tempo } from '../shared/tempo';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { TAU } from './paint';
import { seeded } from './seeded';
import { DOWNED_BODY, DOWNED_HEAD } from './textures-players-downed';
import { add, hide, setTint } from './util';

const QUARTERS = 4;
const LOOSE = 42;
const PER_QUARTER = 10;
const MARGIN = 1.6;
const SPACING = { loose: 3.8, joining: 2.6 };
const DRIFT = 1.1;
const SWELL = 0.035;
const CREAM = 0.16;

export interface SwarmDot {
  readonly x: number;
  readonly y: number;
  // 0 for the loose swarm, then the quarter of the relève that adds the dot.
  readonly quarter: number;
  readonly cream: boolean;
  readonly size: number;
  readonly phase: number;
  readonly twinkle: number;
  readonly driftPhase: number;
  readonly drift: number;
}

export interface SwarmMoment {
  readonly now: number;
  readonly ticksPerBeat: number;
  readonly filled: number;
  readonly calm: boolean;
  // downedBreath of now, 1 in calm mode.
  readonly breath: number;
}

export interface Spark {
  x: number;
  y: number;
  alpha: number;
  size: number;
}

export function insideBody(x: number, y: number, margin: number): boolean {
  const { x: bodyX, rx, ry } = DOWNED_BODY;
  const head = DOWNED_HEAD.radius - margin;
  return (
    ((x - bodyX) / (rx - margin)) ** 2 + (y / (ry - margin)) ** 2 < 1 ||
    (x - DOWNED_HEAD.x) ** 2 + y ** 2 < head * head
  );
}

function scatter(): readonly SwarmDot[] {
  const dots: SwarmDot[] = [];
  const left = DOWNED_HEAD.x - DOWNED_HEAD.radius;
  const width = DOWNED_BODY.x + DOWNED_BODY.rx - left;
  let draw = 0;
  const next = () => seeded((draw += 1));
  const throwDots = (count: number, spacing: number, quarter: number) => {
    for (let made = 0, tries = 0; made < count && tries < 4000; tries += 1) {
      const x = left + next() * width;
      const y = (next() * 2 - 1) * DOWNED_BODY.ry;
      const crowded = dots.some((dot) => (dot.x - x) ** 2 + (dot.y - y) ** 2 < spacing ** 2);
      if (!insideBody(x, y, MARGIN) || crowded) {
        continue;
      }
      dots.push({
        x,
        y,
        quarter,
        cream: next() < CREAM,
        size: 0.75 + next() * 0.5,
        phase: next() * TAU,
        twinkle: 0.35 + next() * 0.45,
        driftPhase: next() * TAU,
        drift: 0.08 + next() * 0.1,
      });
      made += 1;
    }
  };
  throwDots(LOOSE, SPACING.loose, 0);
  for (let quarter = 1; quarter < QUARTERS; quarter += 1) {
    throwDots(PER_QUARTER, SPACING.joining, quarter);
  }
  return dots;
}

export const SWARM = scatter();

// From 1 down to 0 and back over two beats.
export function downedBreath(now: number, { ticksPerBeat }: Tempo = MAIN_TEMPO): number {
  const span = ticksPerBeat * 2;
  return 0.5 + 0.5 * Math.cos(((((now % span) + span) % span) / span) * TAU);
}

// A firefly of the lying body: loose and twinkling while nobody helps, packed, still and bright as
// the relève fills its quarters.
export function sparkAt(dot: SwarmDot, moment: SwarmMoment, out: Spark): Spark {
  const { now, ticksPerBeat, filled, calm, breath } = moment;
  const beats = now / ticksPerBeat;
  const loose = calm ? 0 : (1 - filled) * DRIFT;
  const swell = 1 + SWELL * breath;
  const twinkle = calm ? 1 : 0.5 + 0.5 * Math.sin(beats * TAU * dot.twinkle + dot.phase);
  const shown = filled * QUARTERS >= dot.quarter ? 1 : 0;
  out.x = dot.x * swell + Math.cos(beats * TAU * dot.drift + dot.driftPhase) * loose;
  out.y = dot.y * swell + Math.sin(beats * TAU * dot.drift * 1.3 + dot.driftPhase) * loose;
  out.alpha = shown * lerp(0.5 + 0.5 * twinkle, 1, filled) * (0.8 + 0.2 * breath);
  out.size = dot.size * (1 + 0.67 * filled);
  return out;
}

// The faint body the swarm holds, solid once the last quarter has gathered it.
export function hazeAlpha(filled: number, breath: number): number {
  return 0.24 + 0.06 * breath + 0.7 * filled ** 3;
}

export class DownedSwarm {
  private readonly haze: Sprite;
  private readonly sparks: readonly { readonly dot: SwarmDot; readonly sprite: Sprite }[];
  private readonly spark: Spark = { x: 0, y: 0, alpha: 0, size: 0 };

  constructor(ctx: RenderContext, bodies: Container) {
    const textures = ctx.textures.players.downed;
    this.haze = add(bodies, textures.fill);
    this.sparks = SWARM.map((dot) => ({ dot, sprite: add(bodies, textures.dot) }));
  }

  hide(): void {
    hide(this.haze, ...this.sparks.map(({ sprite }) => sprite));
  }

  place(
    x: number,
    y: number,
    angle: number,
    scale: number,
    color: number,
    filled: number,
    frame: Frame,
  ): void {
    const { now, tempo, calm, light, palette } = frame;
    const { haze, spark } = this;
    const breath = calm ? 1 : downedBreath(now, tempo);
    const moment = { now, ticksPerBeat: tempo.ticksPerBeat, filled, calm, breath };
    haze.visible = true;
    haze.position.set(x, y);
    haze.rotation = angle;
    haze.scale.set(scale);
    setTint(haze, color);
    haze.alpha = hazeAlpha(filled, breath);
    const cream = light.additive ? palette.texte : palette.sol;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const { dot, sprite } of this.sparks) {
      sparkAt(dot, moment, spark);
      sprite.visible = spark.alpha > 0;
      sprite.position.set(
        x + (spark.x * cos - spark.y * sin) * scale,
        y + (spark.x * sin + spark.y * cos) * scale,
      );
      sprite.scale.set(spark.size * scale);
      sprite.alpha = spark.alpha;
      setTint(sprite, dot.cream ? cream : color);
    }
  }
}
