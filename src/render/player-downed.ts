import type { Container, Sprite } from 'pixi.js';
import { MAIN_TEMPO, type Tempo } from '../shared/tempo';
import type { RenderContext } from './context';
import { DownedFireflies } from './downed-fireflies';
import type { Frame } from './frame';
import { TAU } from './paint';
import { add, hide, setTint } from './util';

const QUARTERS = 4;

export function downedFill(share: number): number {
  return Math.floor(share * QUARTERS) / QUARTERS;
}

export function downedBreath(now: number, { ticksPerBeat }: Tempo = MAIN_TEMPO): number {
  const span = ticksPerBeat * 2;
  const phase = (((now % span) + span) % span) / span;
  return 0.8 + 0.2 * Math.cos(phase * TAU);
}

export class Downed {
  private readonly fill: Sprite;
  private readonly line: Sprite;
  private readonly inner: Sprite;
  private readonly fireflies: DownedFireflies;

  constructor(ctx: RenderContext, bodies: Container, marks: Container) {
    const textures = ctx.textures.players.downed;
    this.fill = add(bodies, textures.fill);
    this.line = add(bodies, textures.line);
    this.inner = add(bodies, textures.inner);
    this.fireflies = new DownedFireflies(ctx, marks);
  }

  hide(): void {
    hide(this.fill, this.line, this.inner);
    this.fireflies.hide();
  }

  place(
    downed: boolean,
    x: number,
    y: number,
    angle: number,
    scale: number,
    color: number,
    share: number,
    burst: number,
    frame: Frame,
  ): void {
    const { fill, line, inner, fireflies } = this;
    if (downed || burst < 1) {
      const { now, tempo, calm } = frame;
      const flownAway = downed ? null : burst;
      const moment = { now, ticksPerBeat: tempo.ticksPerBeat, reviveShare: share, flownAway, calm };
      fireflies.place(x, y, angle, scale, color, moment, frame);
    } else {
      fireflies.hide();
    }
    if (!downed) {
      hide(fill, line, inner);
      return;
    }
    for (const sprite of [fill, line, inner]) {
      sprite.visible = true;
      sprite.position.set(x, y);
      sprite.rotation = angle;
      sprite.scale.set(scale);
    }
    setTint(fill, color);
    setTint(line, color);
    setTint(inner, frame.palette.texte);
    fill.alpha = downedFill(share);
    line.alpha = inner.alpha = frame.calm ? 1 : downedBreath(frame.now, frame.tempo);
  }
}
