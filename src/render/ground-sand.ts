import { Container, Graphics, TilingSprite, type Texture } from 'pixi.js';
import { sandAt } from '../shared/palette';
import { nextFloat, seedRng } from '../shared/prng';
import type { Frame } from './frame';
import type { Layout } from './ground-layout';
import { sandTile } from './ground-paint';
import { parseHexColor } from './palette';

const TAU = Math.PI * 2;
const WHITE = 0xffffff;
const DUNE_STEP = 0.09;
const SEGMENTS = 120;

// The sand of the Dome: dune ridges in rings around the dance floor, grain, and the lighter floor under
// the dome. Drawn white once per arena and seed, tinted with the hour.
export function createSand(parent: Container) {
  const root = new Container();
  const surface = new Graphics();
  const dunes = new Graphics();
  const grain = new TilingSprite();
  const floor = new Graphics();
  const rim = new Graphics();
  const steps = new Graphics();
  root.addChild(surface, dunes, grain, floor, rim, steps);
  parent.addChild(root);
  let tile: Texture | null = null;

  function release(): void {
    tile?.destroy(true);
    tile = null;
  }

  return {
    root,
    draw(layout: Layout, seed: number): void {
      const { width, height } = layout.arena;
      const cx = width / 2;
      const cy = height / 2;
      const radius = layout.floorRadius;
      const rng = seedRng((seed + 4001) >>> 0);

      surface.clear().rect(0, 0, width, height).fill(WHITE);
      dunes.clear();
      const reach = Math.hypot(cx, cy) * 1.05;
      for (let ring = radius * 1.12; ring < reach; ring += radius * DUNE_STEP) {
        const phases = [nextFloat(rng) * TAU, nextFloat(rng) * TAU, nextFloat(rng) * TAU] as const;
        for (let step = 0; step <= SEGMENTS; step += 1) {
          const angle = (step / SEGMENTS) * TAU;
          const wobble =
            Math.sin(angle * 3 + phases[0]) * 0.012 +
            Math.sin(angle * 7 + phases[1]) * 0.007 +
            Math.sin(angle * 13 + phases[2]) * 0.004;
          const r = ring * (1 + wobble);
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (step === 0) {
            dunes.moveTo(x, y);
          } else {
            dunes.lineTo(x, y);
          }
        }
      }
      dunes.stroke({ width: 2, color: WHITE });

      release();
      tile = sandTile(seed);
      grain.texture = tile;
      grain.width = width;
      grain.height = height;

      floor.clear().circle(cx, cy, radius).fill(WHITE);
      rim
        .clear()
        .circle(cx, cy, radius - 7)
        .stroke({ width: 14, color: WHITE });
      rim.circle(cx, cy, radius - 14).stroke({ width: 28, color: WHITE, alpha: 0.5 });
      steps.clear();
      for (let ring = radius * 0.24; ring < radius - 8; ring += 22) {
        let angle = nextFloat(rng) * TAU;
        const end = angle + TAU;
        while (angle < end) {
          const dash = (2 + nextFloat(rng) * 6) / ring;
          steps
            .arc(cx, cy, ring, angle, Math.min(angle + dash, end))
            .stroke({ width: 1.2, color: WHITE });
          angle += dash + (6 + nextFloat(rng) * 10) / ring;
        }
      }
    },
    style(frame: Frame): void {
      const sand = sandAt(frame.fraction);
      const sable = parseHexColor(sand.sable);
      const clair = parseHexColor(sand.sableClair);
      const ride = parseHexColor(sand.ride);
      surface.tint = sable;
      dunes.tint = ride;
      dunes.alpha = 0.5;
      grain.tint = ride;
      grain.alpha = 0.55;
      floor.tint = clair;
      rim.tint = sable;
      rim.alpha = 0.5;
      steps.tint = ride;
      steps.alpha = 0.6;
    },
    destroy(): void {
      release();
    },
  };
}
