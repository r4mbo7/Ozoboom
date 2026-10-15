import { type Container, Sprite } from 'pixi.js';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { PixiPalette } from './palette';
import type { Shape } from './paint';
import { setTint } from './util';

interface Transient {
  readonly sprite: Sprite;
  radius: number;
  start: number;
  duration: number;
  x: number;
  y: number;
  angle: number;
  spin: number;
  from: number;
  to: number;
  peak: number;
}

export interface TransientSpec {
  readonly shape: Shape;
  readonly now: number;
  readonly duration: number;
  readonly x: number;
  readonly y: number;
  readonly angle?: number;
  readonly spin?: number;
  readonly fromRadius: number;
  readonly toRadius: number;
  readonly tint: number;
  readonly peak: number;
}

// Arcs, rings and waves that live for a fraction of a beat. Unlike Particles, they are oriented and
// each one wears the texture it is spawned with.
export class Transients {
  private readonly items: Transient[];
  private next = 0;

  constructor(parent: Container, capacity: number, initial: Shape) {
    this.items = Array.from({ length: capacity }, () => {
      const sprite = new Sprite(initial.texture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      parent.addChild(sprite);
      return {
        sprite,
        radius: 1,
        start: 0,
        duration: 1,
        x: 0,
        y: 0,
        angle: 0,
        spin: 0,
        from: 0,
        to: 0,
        peak: 0,
      };
    });
  }

  get active(): number {
    return this.items.filter((item) => item.sprite.visible).length;
  }

  spawn(spec: TransientSpec): void {
    const item = this.items[this.next];
    if (item === undefined) {
      return;
    }
    this.next = (this.next + 1) % this.items.length;
    item.sprite.texture = spec.shape.texture;
    item.radius = spec.shape.radius;
    item.start = spec.now;
    item.duration = spec.duration;
    item.x = spec.x;
    item.y = spec.y;
    item.angle = spec.angle ?? 0;
    item.spin = spec.spin ?? 0;
    item.from = spec.fromRadius;
    item.to = spec.toRadius;
    item.peak = spec.peak;
    setTint(item.sprite, spec.tint);
    item.sprite.visible = true;
  }

  update(now: number): void {
    for (const item of this.items) {
      const { sprite } = item;
      if (!sprite.visible) {
        continue;
      }
      const progress = (now - item.start) / item.duration;
      if (progress >= 1 || progress < 0) {
        sprite.visible = false;
        continue;
      }
      const eased = 1 - (1 - progress) * (1 - progress);
      sprite.position.set(item.x, item.y);
      sprite.scale.set((item.from + (item.to - item.from) * eased) / item.radius);
      sprite.rotation = item.angle + item.spin * eased;
      sprite.alpha = item.peak * (1 - progress);
    }
  }

  clear(): void {
    for (const item of this.items) {
      item.sprite.visible = false;
    }
  }
}

export const RIBBON_TOKENS = ['mage', 'tank', 'healer', 'turquoise'] as const;
const SEGMENTS = 44;
const WAVES = 2.2;
const WAVE_SPEED = 0.55;
const AMPLITUDE = 15;
const THICKNESS = 3.2;
export const RIBBON_TICKS = Math.round(TICKS_PER_BEAT * 0.7);

interface Ribbon {
  readonly segments: readonly Sprite[];
  start: number;
  x: number;
  y: number;
  angle: number;
  length: number;
  live: boolean;
}

function mix(from: number, to: number, amount: number): number {
  const channel = (shift: number) =>
    Math.round(((from >> shift) & 0xff) * (1 - amount) + ((to >> shift) & 0xff) * amount);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function ribbonColor(palette: PixiPalette, along: number): number {
  const position = Math.min(Math.max(along, 0), 1) * (RIBBON_TOKENS.length - 1);
  const index = Math.min(Math.floor(position), RIBBON_TOKENS.length - 2);
  const from = RIBBON_TOKENS[index];
  const to = RIBBON_TOKENS[index + 1];
  if (from === undefined || to === undefined) {
    return palette.or;
  }
  return mix(palette[from], palette[to], position - index);
}

// A long curve that undulates and fades, in a gradient of the four colors of the game.
export class Ribbons {
  private readonly items: Ribbon[];
  private readonly segmentShape: Shape;
  private next = 0;

  constructor(parent: Container, capacity: number, segment: Shape) {
    this.segmentShape = segment;
    this.items = Array.from({ length: capacity }, () => ({
      segments: Array.from({ length: SEGMENTS }, () => {
        const sprite = new Sprite(segment.texture);
        sprite.anchor.set(0.5);
        sprite.visible = false;
        parent.addChild(sprite);
        return sprite;
      }),
      start: 0,
      x: 0,
      y: 0,
      angle: 0,
      length: 0,
      live: false,
    }));
  }

  spawn(now: number, x: number, y: number, angle: number, length: number): void {
    const item = this.items[this.next];
    if (item === undefined) {
      return;
    }
    this.next = (this.next + 1) % this.items.length;
    item.start = now;
    item.x = x;
    item.y = y;
    item.angle = angle;
    item.length = length;
    item.live = true;
  }

  get active(): number {
    return this.items.filter((item) => item.live).length;
  }

  update(now: number, palette: PixiPalette, calm: boolean): void {
    for (const item of this.items) {
      if (!item.live) {
        continue;
      }
      const progress = (now - item.start) / RIBBON_TICKS;
      const live = progress >= 0 && progress < 1;
      item.live = live;
      const reach = item.length * Math.min(1, progress * 3.5);
      const cos = Math.cos(item.angle);
      const sin = Math.sin(item.angle);
      const slice = reach / SEGMENTS;
      item.segments.forEach((sprite, index) => {
        sprite.visible = live;
        if (!live) {
          return;
        }
        const along = (index + 0.5) / SEGMENTS;
        const distance = along * reach;
        const phase = along * WAVES * Math.PI * 2 - now * WAVE_SPEED;
        const taper = calm ? 0 : Math.sin(Math.min(1, along * 1.4) * Math.PI * 0.5) * AMPLITUDE;
        const offset = Math.sin(phase) * taper;
        const slope = Math.atan(
          reach > 0 ? Math.cos(phase) * taper * ((WAVES * Math.PI * 2) / reach) : 0,
        );
        sprite.position.set(
          item.x + cos * distance - sin * offset,
          item.y + sin * distance + cos * offset,
        );
        sprite.rotation = item.angle + slope;
        sprite.scale.set((slice * 2.4) / (this.segmentShape.radius * 2), THICKNESS / 3);
        setTint(sprite, ribbonColor(palette, along));
        sprite.alpha = (1 - progress) * (0.6 + 0.4 * along);
      });
    }
  }

  clear(): void {
    for (const item of this.items) {
      item.live = false;
      for (const sprite of item.segments) {
        sprite.visible = false;
      }
    }
  }
}
