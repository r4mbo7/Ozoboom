import { type Container, Sprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import type { Frame } from './frame';
import { lerp } from './motion';
import type { Shape } from './paint';
import { byId, setTint } from './util';

export type Anchor = 'none' | 'player' | 'core';

export interface BurstSpec {
  readonly shape: Shape;
  readonly now: number;
  readonly duration: number;
  readonly x: number;
  readonly y: number;
  readonly fromRadius: number;
  readonly toRadius: number;
  readonly tint: number;
  readonly peak: number;
  // Ticks to wait before showing up.
  readonly delay?: number;
  readonly angle?: number;
  readonly spin?: number;
  // Height over width of the sprite, for the trails.
  readonly squash?: number;
  // The burst follows this entity: x, y are then offsets from it.
  readonly anchor?: Anchor;
  readonly anchorId?: number;
  readonly dx?: number;
  readonly dy?: number;
  // A dark copy underneath by day, for what is thin enough to vanish on the grass.
  readonly outline?: boolean;
}

interface Burst {
  readonly sprite: Sprite;
  readonly outline: Sprite;
  active: boolean;
  radius: number;
  start: number;
  duration: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  from: number;
  to: number;
  peak: number;
  angle: number;
  spin: number;
  squash: number;
  anchor: Anchor;
  anchorId: number;
  outlined: boolean;
}

// Rings, trails and sparks that live for a few beats, in a fixed ring buffer of sprites: a new one
// takes the place of the oldest, and nothing is created after the first frames.
export class Bursts {
  private readonly items: Burst[];
  private next = 0;

  constructor(parent: Container, capacity: number, initial: Shape) {
    this.items = Array.from({ length: capacity }, () => {
      const outline = new Sprite(initial.texture);
      const sprite = new Sprite(initial.texture);
      for (const part of [outline, sprite]) {
        part.anchor.set(0.5);
        part.visible = false;
        parent.addChild(part);
      }
      return {
        sprite,
        outline,
        active: false,
        radius: 1,
        start: 0,
        duration: 1,
        x: 0,
        y: 0,
        dx: 0,
        dy: 0,
        from: 0,
        to: 0,
        peak: 0,
        angle: 0,
        spin: 0,
        squash: 1,
        anchor: 'none',
        anchorId: 0,
        outlined: false,
      };
    });
  }

  get active(): number {
    return this.items.filter((item) => item.active).length;
  }

  spawn(spec: BurstSpec): void {
    const item = this.items[this.next];
    if (item === undefined) {
      return;
    }
    this.next = (this.next + 1) % this.items.length;
    item.active = true;
    item.sprite.texture = item.outline.texture = spec.shape.texture;
    item.radius = spec.shape.radius;
    item.start = spec.now + (spec.delay ?? 0);
    item.duration = spec.duration;
    item.x = spec.x;
    item.y = spec.y;
    item.dx = spec.dx ?? 0;
    item.dy = spec.dy ?? 0;
    item.from = spec.fromRadius;
    item.to = spec.toRadius;
    item.peak = spec.peak;
    item.angle = spec.angle ?? 0;
    item.spin = spec.spin ?? 0;
    item.squash = spec.squash ?? 1;
    item.anchor = spec.anchor ?? 'none';
    item.anchorId = spec.anchorId ?? 0;
    item.outlined = spec.outline ?? false;
    setTint(item.sprite, spec.tint);
  }

  update(state: SimState, alpha: number, frame: Frame): void {
    const byDay = !frame.light.additive;
    for (const item of this.items) {
      if (!item.active) {
        continue;
      }
      const { sprite, outline } = item;
      const progress = (frame.now - item.start) / item.duration;
      if (progress >= 1) {
        item.active = false;
        sprite.visible = outline.visible = false;
        continue;
      }
      if (progress < 0) {
        continue;
      }
      let x = item.x;
      let y = item.y;
      if (item.anchor === 'player') {
        const player = byId(state.players, item.anchorId);
        if (player !== undefined) {
          x += lerp(player.prevX, player.x, alpha);
          y += lerp(player.prevY, player.y, alpha);
        }
      } else if (item.anchor === 'core') {
        x += state.core.x;
        y += state.core.y;
      }
      const eased = 1 - (1 - progress) * (1 - progress);
      const scale = (item.from + (item.to - item.from) * eased) / item.radius;
      sprite.visible = true;
      sprite.position.set(x + item.dx * eased, y + item.dy * eased);
      sprite.scale.set(scale, scale * item.squash);
      sprite.rotation = item.angle + item.spin * eased;
      sprite.alpha = item.peak * (1 - progress);
      outline.visible = byDay && item.outlined;
      if (outline.visible) {
        const grow = 1 / item.radius;
        setTint(outline, frame.palette.texte);
        outline.position.copyFrom(sprite.position);
        outline.rotation = sprite.rotation;
        outline.alpha = sprite.alpha;
        outline.scale.set(scale + grow, scale * item.squash + grow);
      }
    }
  }

  clear(): void {
    for (const item of this.items) {
      item.active = false;
      item.sprite.visible = item.outline.visible = false;
    }
  }
}
