import { type Container, Graphics, type Sprite } from 'pixi.js';
import type { Tempo } from '../shared/tempo';
import type { PlayerState } from '../sim/state';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { LABEL_FONT_PX, LABEL_PAD, NAME_TEXTURE_SCALE } from './textures-names';
import { add, setTint } from './util';

const NEVER = Number.NEGATIVE_INFINITY;
// The arc of the dash, mirrored above the body: same reach, same span, open at the top.
const REACH = 23 / 14;
const SPAN = 1.9;
const TOP = -Math.PI / 2;
const EDGE_WIDTH = 6.5;
const TRACK_WIDTH = 1.6;
const HIT_WIDTH = 3.6;
const REST_WIDTH = 2.4;
const DANGER_WIDTH = 4.4;
const DANGER_BEAT = 0.06;
const FULL_ALPHA = 0.6;
const PALE = 1 / 3;
const NUMBER_SIZE = 11 / LABEL_FONT_PX;
const NUMBER_GAP = 2;
const NUMBER_HEIGHT = (LABEL_FONT_PX * 1.4 + 2 * LABEL_PAD) * NUMBER_SIZE;

export const DANGER_RATIO = 0.25;

// The ends of the living part of the arc: it drains from both ends toward the top.
export function lifeAngles(fraction: number): { from: number; to: number } {
  const half = (SPAN / 2) * Math.min(1, Math.max(0, fraction));
  return { from: TOP - half, to: TOP + half };
}

// How strong a full arc shows: pale for a bar, then gone over a beat, down to a third in calm mode.
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

// The width of the living part: thickest in danger, thick a bar after a hit, thin at rest.
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

// The life a player has left, as an arc above its head with the number at the top.
export class LifeArc {
  private readonly arc = new Graphics();
  private readonly numberEdge: Sprite;
  private readonly number: Sprite;
  private readonly ctx: RenderContext;
  private fullSince = NEVER;
  private wasFull = true;

  constructor(ctx: RenderContext, ground: Container, labels: Container) {
    this.ctx = ctx;
    ground.addChild(this.arc);
    this.numberEdge = add(labels, ctx.textures.halo);
    this.number = add(labels, ctx.textures.halo);
  }

  // How far above the center the arc and its number reach, in world units, for what sits above.
  extent(player: PlayerState, frame: Frame): number {
    return (
      player.radius * REACH + EDGE_WIDTH / 2 + (NUMBER_HEIGHT + NUMBER_GAP) / frame.camera.scale
    );
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
    const { now, tempo, calm, light, palette, camera, pulse } = frame;
    const fraction = player.maxHp > 0 ? Math.min(1, Math.max(0, player.hp / player.maxHp)) : 0;
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
    const beat = danger && !calm ? 1 + DANGER_BEAT * pulse : 1;
    const radius = player.radius * REACH;
    const edge = light.additive ? palette.sol : palette.texte;
    const lit = danger ? palette.rouge : color;

    arc.position.set(x, y);
    arc.scale.set(beat);
    arc.alpha = alpha;
    arc.clear();
    const whole = lifeAngles(1);
    stroke(arc, radius, whole.from, whole.to, EDGE_WIDTH, edge, 1);
    stroke(arc, radius, whole.from, whole.to, TRACK_WIDTH, lit, 0.3);
    if (fraction > 0) {
      const live = lifeAngles(fraction);
      stroke(arc, radius, live.from, live.to, lifeWidth(sinceHit, fraction, tempo), lit, 1);
    }

    const texts = this.ctx.textures.names.get(String(Math.max(0, Math.round(player.hp))));
    if (number.texture !== texts.fill) {
      number.texture = texts.fill;
      numberEdge.texture = texts.edge;
    }
    const size = (NUMBER_SIZE * beat) / (NAME_TEXTURE_SCALE * camera.scale);
    const above = radius + EDGE_WIDTH / 2 + (NUMBER_HEIGHT / 2 + NUMBER_GAP) / camera.scale;
    number.position.set(x, y - above);
    numberEdge.position.set(x, y - above);
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
  }
}

function stroke(
  arc: Graphics,
  radius: number,
  from: number,
  to: number,
  width: number,
  color: number,
  alpha: number,
): void {
  arc.moveTo(Math.cos(from) * radius, Math.sin(from) * radius);
  arc.arc(0, 0, radius, from, to);
  arc.stroke({ width, color, alpha, cap: 'round' });
}
