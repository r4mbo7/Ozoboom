import { type Container, Graphics, type Sprite } from 'pixi.js';
import { DANGER_RATIO, dangerDepth } from '../shared/low-life';
import { clamp01 } from '../shared/scalar';
import type { Tempo } from '../shared/tempo';
import type { PlayerState } from '../sim/state';
import type { RenderContext } from './context';
import { strokeArc } from './arc-stroke';
import type { Frame } from './frame';
import { easeInOutCubic } from './motion';
import { LABEL_FONT_PX, LABEL_PAD, NAME_TEXTURE_SCALE } from './textures-names';
import { add, setTint } from './util';

const NEVER = Number.NEGATIVE_INFINITY;
const REACH = 23 / 14;
const SPAN = 1.9;
const TOP = -Math.PI / 2;
const EDGE_WIDTH = 6.5;
const TRACK_WIDTH = 1.6;
const HIT_WIDTH = 3.6;
const REST_WIDTH = 2.4;
const DANGER_WIDTH = 4.4;
const FULL_ALPHA = 0.6;
const PALE = 1 / 3;
const NUMBER_SIZE = 11 / LABEL_FONT_PX;
const NUMBER_GAP = 2;
const NUMBER_HEIGHT = (LABEL_FONT_PX * 1.4 + 2 * LABEL_PAD) * NUMBER_SIZE;

const ALARM_REACH = 0.3;
const ALARM_STROKE = 0.75;
const ALARM_NUMBER = 0.4;
const ALARM_HEART = 0.18;
const GLOW = [
  { width: 16, alpha: 0.22 },
  { width: 8, alpha: 0.38 },
] as const;
const GLOW_DEEP_WIDTH = 8;

export function lifeAngles(fraction: number): { from: number; to: number } {
  const half = (SPAN / 2) * clamp01(fraction);
  return { from: TOP - half, to: TOP + half };
}

export function fullAlpha(
  sinceFull: number,
  { ticksPerBeat }: Pick<Tempo, 'ticksPerBeat'>,
  calm: boolean,
): number {
  const bar = ticksPerBeat * 4;
  if (sinceFull <= bar) {
    return FULL_ALPHA;
  }
  return Math.max(calm ? PALE : 0, FULL_ALPHA * (1 - (sinceFull - bar) / ticksPerBeat));
}

export function lifeWidth(
  sinceHit: number,
  fraction: number,
  { ticksPerBeat }: Pick<Tempo, 'ticksPerBeat'>,
): number {
  if (fraction <= DANGER_RATIO) {
    return DANGER_WIDTH;
  }
  return sinceHit < ticksPerBeat * 4 ? HIT_WIDTH : REST_WIDTH;
}

export function alarmGrowth(
  sinceChange: number,
  danger: boolean,
  { ticksPerBeat }: Pick<Tempo, 'ticksPerBeat'>,
): number {
  const grown = easeInOutCubic(clamp01(sinceChange / (ticksPerBeat / 4)));
  return danger ? grown : 1 - grown;
}

// The time into the opposite move that starts where this one stands, so that a heal halfway into
// the alarm shrinks the arc from its size of the moment: the easing is symmetric.
export function turnedAlarm(
  sinceChange: number,
  { ticksPerBeat }: Pick<Tempo, 'ticksPerBeat'>,
): number {
  const quarter = ticksPerBeat / 4;
  return quarter * (1 - clamp01(sinceChange / quarter));
}

interface AlarmScale {
  readonly reach: number;
  readonly stroke: number;
  readonly number: number;
}

const AT_REST: AlarmScale = Object.freeze({ reach: 1, stroke: 1, number: 1 });

export interface NumberRoom {
  readonly radius: number;
  readonly edgeWidth: number;
  // The number's growth, and the heart's swell of arc and number alike.
  readonly number: number;
  readonly beat: number;
  // The camera's scale: the number keeps its size on screen.
  readonly scale: number;
}

// How far above the player the life number sits, its centre and its top, clear of the arc's
// outer edge as the heart swells both.
export function numberLift(room: NumberRoom): { centre: number; top: number } {
  const half = (NUMBER_HEIGHT * room.number * room.beat) / 2 / room.scale;
  const centre = (room.radius + room.edgeWidth / 2) * room.beat + half + NUMBER_GAP / room.scale;
  return { centre, top: centre + half };
}

export function alarmScale(growth: number): AlarmScale {
  if (growth === 0) {
    return AT_REST;
  }
  return {
    reach: 1 + ALARM_REACH * growth,
    stroke: 1 + ALARM_STROKE * growth,
    number: 1 + ALARM_NUMBER * growth,
  };
}

export class LifeArc {
  private readonly arc = new Graphics();
  private readonly numberEdge: Sprite;
  private readonly number: Sprite;
  private readonly ctx: RenderContext;
  private fullSince = NEVER;
  private wasFull = true;
  private alarmSince = NEVER;
  private wasDanger = false;
  private growth = 0;
  private beat = 1;

  constructor(ctx: RenderContext, ground: Container, labels: Container) {
    this.ctx = ctx;
    ground.addChild(this.arc);
    this.numberEdge = add(labels, ctx.textures.halo);
    this.number = add(labels, ctx.textures.halo);
  }

  // From the last frame's growth and beat: the tag above is placed before the arc.
  extent(player: PlayerState, frame: Frame): number {
    const grown = alarmScale(this.growth);
    return numberLift({
      radius: player.radius * REACH * grown.reach,
      edgeWidth: EDGE_WIDTH * grown.stroke,
      number: grown.number,
      beat: this.beat,
      scale: frame.camera.scale,
    }).top;
  }

  place(
    player: PlayerState,
    x: number,
    y: number,
    color: number,
    sinceHit: number,
    frame: Frame,
  ): void {
    const { arc, number, numberEdge } = this;
    const { now, tempo, calm, light, palette, camera, heart } = frame;
    const fraction = player.maxHp > 0 ? clamp01(player.hp / player.maxHp) : 0;
    const full = fraction >= 1;
    if (full && !this.wasFull) {
      this.fullSince = now;
    }
    this.wasFull = full;
    const alpha = full ? fullAlpha(now - this.fullSince, tempo, calm) : 1;
    const shown = !player.downed && alpha > 0;
    arc.visible = number.visible = numberEdge.visible = shown;
    if (!shown) {
      return;
    }
    const danger = fraction <= DANGER_RATIO;
    if (danger !== this.wasDanger) {
      this.alarmSince = now - turnedAlarm(now - this.alarmSince, tempo);
      this.wasDanger = danger;
    }
    this.growth = alarmGrowth(now - this.alarmSince, danger, tempo);
    const grown = alarmScale(this.growth);
    const beat = danger ? 1 + ALARM_HEART * heart : 1;
    const radius = player.radius * REACH * grown.reach;
    const edgeWidth = EDGE_WIDTH * grown.stroke;
    const edge = light.additive ? palette.sol : palette.texte;
    const lit = danger ? palette.rouge : color;

    arc.position.set(x, y);
    arc.scale.set(beat);
    arc.alpha = alpha;
    arc.clear();
    const whole = lifeAngles(1);
    if (this.growth > 0) {
      const depth = dangerDepth(fraction);
      for (const glow of GLOW) {
        const width = edgeWidth + glow.width + GLOW_DEEP_WIDTH * depth;
        const strength = glow.alpha * this.growth * (0.6 + 0.4 * depth);
        strokeArc(arc, radius, whole.from, whole.to, width, palette.rouge, strength);
      }
    }
    strokeArc(arc, radius, whole.from, whole.to, edgeWidth, edge, 1);
    strokeArc(arc, radius, whole.from, whole.to, TRACK_WIDTH * grown.stroke, lit, 0.3);
    if (fraction > 0) {
      const live = lifeAngles(fraction);
      const width = lifeWidth(sinceHit, fraction, tempo) * grown.stroke;
      strokeArc(arc, radius, live.from, live.to, width, lit, 1);
    }

    const texts = this.ctx.textures.names.get(String(Math.max(0, Math.round(player.hp))));
    if (number.texture !== texts.fill) {
      number.texture = texts.fill;
      numberEdge.texture = texts.edge;
    }
    const size = (NUMBER_SIZE * grown.number * beat) / (NAME_TEXTURE_SCALE * camera.scale);
    this.beat = beat;
    const above = numberLift({
      radius,
      edgeWidth,
      number: grown.number,
      beat,
      scale: camera.scale,
    });
    number.position.set(x, y - above.centre);
    numberEdge.position.set(x, y - above.centre);
    number.scale.set(size);
    numberEdge.scale.set(size);
    setTint(number, lit);
    setTint(numberEdge, edge);
    number.alpha = alpha;
    numberEdge.alpha = (light.additive ? 0.7 : 0.9) * alpha;
  }

  reset(): void {
    this.arc.clear();
    this.arc.visible = this.number.visible = this.numberEdge.visible = false;
    this.fullSince = NEVER;
    this.wasFull = true;
    this.alarmSince = NEVER;
    this.wasDanger = false;
    this.growth = 0;
    this.beat = 1;
  }
}
