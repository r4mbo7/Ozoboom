import type { Container, Sprite } from 'pixi.js';
import type { Emote } from '../sim/commands';
import type { RenderContext } from './context';
import {
  ARROW_FLIES,
  FIREFLY,
  FIREWORKS,
  HAND,
  HEART_FRONT,
  MOCKUP_PIXEL,
  arrowFly,
  arrowHand,
  emoteBeats,
  fireworksBurst,
  fireworksFly,
  heartAt,
  type Fly,
} from './emote-moments';
import type { Frame } from './frame';
import { TAU } from './paint';
import { EMOTE_BURST } from './textures-players-emotes';
import { EmoteSun, show } from './emote-sun';
import { add, hide } from './util';

const NEVER = Number.NEGATIVE_INFINITY;

interface Glowing {
  readonly halo: Sprite;
  readonly core: Sprite;
}

export class PlayerEmote {
  private emote: Emote | null = null;
  private start = NEVER;
  private readonly haloRadius: number;
  private readonly flies: Glowing[] = [];
  private readonly bursts: { readonly gold: Sprite; readonly tinted: Sprite }[] = [];
  private readonly hands: readonly [Sprite, Sprite];
  private readonly heart: {
    readonly halo: Sprite;
    readonly fill: Sprite;
    readonly line: Sprite;
    readonly inner: Sprite;
    readonly stars: readonly [Sprite, Sprite];
  };
  private readonly sun: EmoteSun;
  private readonly all: Sprite[] = [];
  private readonly fly: Fly = { x: 0, y: 0, alpha: 0, size: 0 };

  constructor(ctx: RenderContext, gestures: Container) {
    const { textures, layers } = ctx;
    const e = textures.players.emote;
    const firefly = textures.players.downed.firefly;
    this.haloRadius = textures.halo.radius;
    const sprite = (parent: Container, shape: typeof e.sun) => {
      const made = add(parent, shape);
      made.visible = false;
      this.all.push(made);
      return made;
    };
    for (let index = 0; index < ARROW_FLIES; index += 1) {
      this.flies.push({
        halo: sprite(layers.glow, textures.halo),
        core: sprite(gestures, firefly),
      });
    }
    for (let index = 0; index < FIREWORKS; index += 1) {
      this.bursts.push({ gold: sprite(gestures, e.burst), tinted: sprite(gestures, e.burst) });
    }
    this.hands = [sprite(gestures, firefly), sprite(gestures, firefly)];
    this.heart = {
      halo: sprite(layers.glow, textures.halo),
      fill: sprite(gestures, e.heartFill),
      line: sprite(gestures, e.heartLine),
      inner: sprite(gestures, e.heartInner),
      stars: [sprite(gestures, e.star), sprite(gestures, e.star)],
    };
    this.sun = new EmoteSun(
      ctx,
      (shape) => sprite(gestures, shape),
      (shape) => sprite(layers.glow, shape),
    );
  }

  begin(emote: Emote, now: number): void {
    this.emote = emote;
    this.start = now;
  }

  reset(): void {
    this.emote = null;
    this.start = NEVER;
    hide(...this.all);
  }

  place(
    x: number,
    y: number,
    angle: number,
    scale: number,
    top: number,
    color: number,
    teint: number,
    frame: Frame,
  ): void {
    hide(...this.all);
    const t =
      this.emote === null ? null : emoteBeats(this.start, frame.now, frame.tempo.ticksPerBeat);
    if (t === null) {
      this.emote = null;
      return;
    }
    const view = { x, y, cos: Math.cos(angle), sin: Math.sin(angle), scale };
    switch (this.emote) {
      case 'sunrise':
        this.sun.place(t, x, top, scale, frame);
        break;
      case 'fireworks':
        this.fireworks(t, x, y, scale, color, frame);
        break;
      case 'heart':
        this.heartFrom(t, view, color, teint, frame);
        break;
      case 'arrow':
        this.arrow(t, view, color, teint, frame);
        break;
      default:
        break;
    }
  }

  private fireworks(
    t: number,
    x: number,
    y: number,
    scale: number,
    color: number,
    frame: Frame,
  ): void {
    const { palette, calm } = frame;
    const burst = fireworksBurst(t, calm);
    this.bursts.forEach(({ gold, tinted }, index) => {
      const { x: fx, y: fy, alpha, size } = fireworksFly(index, t, calm, this.fly);
      const px = x + fx * scale;
      const py = y + fy * scale;
      this.glowing(
        index,
        px,
        py,
        size,
        alpha,
        burst === null ? palette.or : palette.texte,
        scale,
        frame,
      );
      if (burst === null) {
        return;
      }
      const reach = (burst.reach / EMOTE_BURST) * scale;
      show(gold, px, py, reach, reach, palette.or, burst.alpha);
      show(tinted, px, py, reach, reach, color, burst.alpha);
      gold.rotation = index;
      tinted.rotation = index + TAU / 8;
    });
  }

  private heartFrom(t: number, view: View, color: number, teint: number, frame: Frame): void {
    const { palette, light } = frame;
    const moment = heartAt(t, frame.calm);
    if (moment.hands > 0.02) {
      this.hand(0, view, moment.hand.x, moment.hand.y, teint);
      this.hand(1, view, moment.hand.x, -moment.hand.y, teint);
    }
    if (moment.alpha <= 0) {
      return;
    }
    const [fx, fy] = toWorld(view, HEART_FRONT, 0);
    const hy = fy - moment.rise * view.scale;
    const size = moment.scale * view.scale;
    const { halo, fill, line, inner, stars } = this.heart;
    show(
      halo,
      fx,
      hy,
      (20 * MOCKUP_PIXEL * size) / this.haloRadius,
      NaN,
      color,
      light.haloAlpha * 0.8 * moment.alpha,
    );
    show(fill, fx, hy, size, size, color, 0.3 * moment.alpha);
    show(line, fx, hy, size, size, color, moment.alpha);
    show(inner, fx, hy, size, size, palette.texte, moment.alpha);
    if (moment.star !== null) {
      const { size: starSize, alpha } = moment.star;
      stars.forEach((star, index) => {
        const side = index === 0 ? -1 : 1;
        show(
          star,
          fx + side * 15 * MOCKUP_PIXEL * size,
          hy - 4 * MOCKUP_PIXEL * view.scale,
          starSize * view.scale,
          starSize * view.scale,
          palette.or,
          alpha * moment.alpha,
        );
      });
    }
  }

  private arrow(t: number, view: View, color: number, teint: number, frame: Frame): void {
    const hand = arrowHand(t);
    if (hand.raised > 0.02) {
      this.hand(1, view, hand.x, hand.y, teint);
    }
    for (let index = 0; index < ARROW_FLIES; index += 1) {
      const { x, y, alpha, size } = arrowFly(index, t, frame.calm, this.fly);
      const [px, py] = toWorld(view, x, y);
      const tip = index === ARROW_FLIES - 1;
      this.glowing(index, px, py, size, alpha, tip ? frame.palette.or : color, view.scale, frame);
    }
  }

  private hand(index: 0 | 1, view: View, lx: number, ly: number, teint: number): void {
    const [px, py] = toWorld(view, lx, ly);
    const size = (HAND / FIREFLY) * view.scale;
    show(this.hands[index], px, py, size, size, teint, 1);
  }

  private glowing(
    index: number,
    x: number,
    y: number,
    size: number,
    alpha: number,
    color: number,
    scale: number,
    frame: Frame,
  ): void {
    const fly = this.flies[index];
    if (fly === undefined || alpha <= 0) {
      return;
    }
    show(
      fly.halo,
      x,
      y,
      (size * 4.2 * scale) / this.haloRadius,
      NaN,
      color,
      alpha * Math.min(1, frame.light.haloAlpha * 1.6),
    );
    show(fly.core, x, y, (size / FIREFLY) * scale, (size / FIREFLY) * scale, color, alpha);
  }
}

interface View {
  readonly x: number;
  readonly y: number;
  readonly cos: number;
  readonly sin: number;
  readonly scale: number;
}

function toWorld(view: View, lx: number, ly: number): [number, number] {
  return [
    view.x + (lx * view.cos - ly * view.sin) * view.scale,
    view.y + (lx * view.sin + ly * view.cos) * view.scale,
  ];
}
