import type { Container, Sprite } from 'pixi.js';
import { nextFloat, seedRng } from '../shared/prng';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import type { Layout } from './ground-layout';
import { MAX_FIREFLIES, firefliesAt, fireflyLevel } from './ground-sun';
import { add, setTint } from './util';

const TAU = Math.PI * 2;

interface Firefly {
  readonly sprite: Sprite;
  readonly homeX: number;
  readonly homeY: number;
  readonly reachX: number;
  readonly reachY: number;
  readonly phase: readonly [number, number, number];
  readonly rate: readonly [number, number, number];
}

// Slow additive sparks in `or`, out by day. The calm mode keeps fewer of them.
export function createFireflies(ctx: RenderContext, parent: Container) {
  let flies: Firefly[] = [];

  return {
    draw(layout: Layout, seed: number): void {
      for (const { sprite } of flies) {
        sprite.destroy();
      }
      const { width, height } = layout.arena;
      const rng = seedRng((seed + 104729) >>> 0);
      const lakeEdge = layout.shoreBase * 0.6;
      flies = Array.from({ length: MAX_FIREFLIES }, () => {
        const sprite = add(parent, ctx.textures.halo);
        sprite.blendMode = 'add';
        sprite.visible = false;
        return {
          sprite,
          homeX: lakeEdge + nextFloat(rng) * (width - lakeEdge),
          homeY: nextFloat(rng) * height,
          reachX: 25 + nextFloat(rng) * 50,
          reachY: 20 + nextFloat(rng) * 40,
          phase: [nextFloat(rng) * TAU, nextFloat(rng) * TAU, nextFloat(rng) * TAU],
          rate: [
            0.004 + nextFloat(rng) * 0.01,
            0.024 + nextFloat(rng) * 0.01,
            0.044 + nextFloat(rng) * 0.01,
          ],
        };
      });
    },
    update(frame: Frame): void {
      const shown = firefliesAt(frame.fraction, frame.calm);
      const level = fireflyLevel(frame.fraction);
      const { now } = frame;
      for (const [index, fly] of flies.entries()) {
        const { sprite } = fly;
        sprite.visible = index < shown;
        if (!sprite.visible) {
          continue;
        }
        setTint(sprite, frame.palette.or);
        sprite.position.set(
          fly.homeX + Math.sin(now * fly.rate[0] + fly.phase[0]) * fly.reachX,
          fly.homeY + Math.cos(now * fly.rate[1] + fly.phase[1]) * fly.reachY,
        );
        const blink = 0.5 + 0.5 * Math.sin(now * fly.rate[2] * 3 + fly.phase[2]);
        sprite.scale.set(0.12 + 0.1 * blink);
        sprite.alpha = level * (0.5 + 0.5 * blink);
      }
    },
  };
}
