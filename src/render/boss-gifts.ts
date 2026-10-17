import type { Container, Sprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import { type BossDecor, place } from './boss-decor';
import type { Frame } from './frame';
import type { Shape, Textures } from './textures';
import { add, hide, setTint } from './util';

const TAU = Math.PI * 2;
// In beats from the burst: the vibes leave one after the other and fly for RAIN.beats.
const RAIN = { normal: 14, calm: 6, from: 0.3, stagger: 0.08, beats: 1.6, trail: 4 };
// The relics rise over the dropped loot, float, and fade under the relic offer.
const RELIC = { count: 3, from: 1.2, rise: 1.5, out: 3, fade: 1, spacing: 1.15 };
export const GIFTS_BEATS = RELIC.out + RELIC.fade;

export interface Giver {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  // Whether it dropped relics: they float above it before the offer.
  readonly relics: boolean;
}

// What a chased boss leaves its team: a rain of vibes that flies to every player standing, and the
// relics it drops, floating in their flowers of life.
export class Gifts {
  private readonly rain: Sprite[];
  private readonly trail: Sprite[];
  private readonly relics: Sprite[];
  private readonly flowers: Sprite[];
  private readonly haloRadius: number;
  private readonly relicRadius: number;
  private readonly flowerRadius: number;

  constructor(textures: Textures, decor: BossDecor, glowing: Container, standing: Container) {
    const sprite = (shape: Shape, parent: Container) => {
      const made = add(parent, shape);
      made.visible = false;
      return made;
    };
    const many = (count: number, make: () => Sprite) => Array.from({ length: count }, make);
    this.rain = many(RAIN.normal, () => sprite(textures.vibes, glowing));
    this.trail = many(RAIN.normal * RAIN.trail, () => sprite(textures.halo, glowing));
    this.flowers = many(RELIC.count, () => sprite(decor.flower, standing));
    this.relics = many(RELIC.count, () => sprite(decor.relic, standing));
    this.haloRadius = textures.halo.radius;
    this.relicRadius = decor.relic.radius;
    this.flowerRadius = decor.flower.radius;
  }

  // `beats` since the burst.
  show(giver: Giver, beats: number, state: SimState, frame: Frame): void {
    this.showRain(giver, beats, state, frame);
    this.showRelics(giver, beats, frame);
  }

  hide(): void {
    hide(...this.rain, ...this.trail, ...this.relics, ...this.flowers);
  }

  private showRain(giver: Giver, beats: number, state: SimState, frame: Frame): void {
    const { calm, palette } = frame;
    const team = state.players.filter((player) => !player.downed);
    const count = team.length === 0 || beats < 0 ? 0 : calm ? RAIN.calm : RAIN.normal;
    this.rain.forEach((head, index) => {
      const target = team[index % Math.max(1, team.length)];
      const p = (beats - RAIN.from - index * RAIN.stagger) / RAIN.beats;
      const flying = index < count && target !== undefined && p > 0 && p < 1;
      head.visible = flying;
      for (let step = 0; step < RAIN.trail; step += 1) {
        const dot = this.trail[index * RAIN.trail + step];
        if (dot !== undefined) {
          dot.visible = flying && !calm;
        }
      }
      if (!flying) {
        return;
      }
      const seed = (giver.id * 31 + index * 17) % 97;
      const midX = giver.x + ((seed % 11) / 10 - 0.5) * 4 * giver.radius;
      const midY = giver.y - (2 + ((seed % 7) / 6) * 1.5) * giver.radius;
      const along = (q: number, axis: 'x' | 'y') => {
        const from = axis === 'x' ? giver.x : giver.y;
        const mid = axis === 'x' ? midX : midY;
        return (1 - q) * (1 - q) * from + 2 * (1 - q) * q * mid + q * q * target[axis];
      };
      const q = (1 - (1 - p) ** 3) * 0.4 + p * 0.6;
      place(head, along(q, 'x'), along(q, 'y'), q * TAU, 0.75);
      setTint(head, palette.or);
      for (let step = 0; step < RAIN.trail && !calm; step += 1) {
        const dot = this.trail[index * RAIN.trail + step];
        if (dot === undefined) {
          continue;
        }
        const back = Math.max(0, q - (step + 1) * 0.035);
        place(dot, along(back, 'x'), along(back, 'y'), 0, ((4 - step * 0.7) / this.haloRadius) * 2);
        setTint(dot, step >= 2 ? palette.turquoise : palette.or);
        dot.alpha = 0.7 - step * 0.15;
      }
    });
  }

  private showRelics(giver: Giver, beats: number, frame: Frame): void {
    const { calm, palette, show, tempo } = frame;
    const rise = Math.min(1, Math.max(0, (beats - RELIC.from) / RELIC.rise));
    const fade = Math.min(1, Math.max(0, 1 - (beats - RELIC.out) / RELIC.fade));
    const alpha = giver.relics ? rise * fade : 0;
    this.relics.forEach((relic, index) => {
      const flower = this.flowers[index];
      if (alpha <= 0 || flower === undefined) {
        relic.visible = false;
        if (flower !== undefined) {
          flower.visible = false;
        }
        return;
      }
      const turns = show / tempo.ticksPerBeat;
      const bob = calm ? 0 : Math.sin(turns * 0.7 + index) * 0.08;
      const x = giver.x + (index - 1) * RELIC.spacing * giver.radius;
      const y = giver.y - (0.75 + 0.35 * (1 - (1 - rise) ** 3) - bob) * giver.radius;
      place(relic, x, y, 0, (0.24 * giver.radius) / this.relicRadius);
      setTint(relic, palette.noyau);
      relic.alpha = alpha;
      place(
        flower,
        x,
        y,
        calm ? index : turns * 0.2 + index,
        (0.36 * giver.radius) / this.flowerRadius,
      );
      setTint(flower, palette.or);
      flower.alpha = 0.5 * alpha;
    });
  }
}
