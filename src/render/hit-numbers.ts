import { Container, type Sprite } from 'pixi.js';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { Frame } from './frame';
import { easeOutQuad } from './motion';
import type { NameTextures } from './textures-names';
import { NAME_TEXTURE_SCALE } from './textures-names';
import type { Shape } from './paint';
import { add, setTint } from './util';

const NUMBER_TICKS = 1.5 * TICKS_PER_BEAT;
const POP_TICKS = TICKS_PER_BEAT / 4;
const POP = 0.4;
// In screen pixels, like the names: a number keeps its size whatever the camera frames.
const RISE = 26;
const GAP = 6;
const SIZE = 1.15;

interface HitNumber {
  readonly edge: Sprite;
  readonly fill: Sprite;
  live: boolean;
  start: number;
  x: number;
  y: number;
  reach: number;
  tint: number;
}

export class HitNumbers {
  private readonly items: HitNumber[];
  private readonly names: NameTextures;
  private next = 0;

  constructor(parent: Container, names: NameTextures, blank: Shape, capacity: number) {
    this.names = names;
    const container = parent.addChild(new Container());
    this.items = Array.from({ length: capacity }, () => {
      const edge = add(container, blank);
      const fill = add(container, blank);
      edge.visible = fill.visible = false;
      return { edge, fill, live: false, start: 0, x: 0, y: 0, reach: 0, tint: 0 };
    });
  }

  spawn(amount: number, x: number, y: number, reach: number, tint: number, now: number): void {
    const item = this.items[this.next];
    if (item === undefined) {
      return;
    }
    this.next = (this.next + 1) % this.items.length;
    const label = this.names.get(String(amount));
    item.fill.texture = label.fill;
    item.edge.texture = label.edge;
    Object.assign(item, { live: true, start: now, x, y, reach, tint });
  }

  update(frame: Frame): void {
    const { camera, light, palette } = frame;
    for (const item of this.items) {
      if (!item.live) {
        continue;
      }
      const age = frame.now - item.start;
      const progress = age / NUMBER_TICKS;
      item.live = progress >= 0 && progress < 1;
      item.edge.visible = item.fill.visible = item.live;
      if (!item.live) {
        continue;
      }
      const eased = easeOutQuad(progress);
      const pop = age < POP_TICKS ? POP * (1 - age / POP_TICKS) : 0;
      const size = (SIZE * (1 + pop)) / (NAME_TEXTURE_SCALE * camera.scale);
      const y = item.y - item.reach - (GAP + RISE * eased) / camera.scale;
      const fade = 1 - progress * progress;
      item.fill.position.set(item.x, y);
      item.edge.position.set(item.x, y);
      item.fill.scale.set(size);
      item.edge.scale.set(size);
      setTint(item.fill, item.tint);
      setTint(item.edge, light.additive ? palette.sol : palette.texte);
      item.fill.alpha = fade;
      item.edge.alpha = (light.additive ? 0.7 : 0.9) * fade;
    }
  }

  clear(): void {
    for (const item of this.items) {
      item.live = item.edge.visible = item.fill.visible = false;
    }
  }
}
