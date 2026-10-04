import { Graphics } from 'pixi.js';
import type { Arena, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';

const TAU = Math.PI * 2;
const WHITE = 0xffffff;

// Drawn white once per arena size, then tinted with the hour's palette each image.
export function createGround(ctx: RenderContext): Family {
  const parent = ctx.layers.ground;
  const surface = new Graphics();
  const lines = new Graphics();
  const petals = new Graphics();
  parent.addChild(surface, lines, petals);
  let drawn: Arena = { width: 0, height: 0 };

  function draw({ width, height }: Arena): void {
    drawn = { width, height };
    surface.clear().rect(0, 0, width, height).fill({ color: WHITE, alpha: 0.45 });

    const cell = 80;
    lines.clear();
    for (let x = cell; x < width; x += cell) {
      lines.moveTo(x, 0).lineTo(x, height);
    }
    for (let y = cell; y < height; y += cell) {
      lines.moveTo(0, y).lineTo(width, y);
    }
    lines.stroke({ width: 1, color: WHITE, alpha: 0.06 });

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.34;
    for (let ring = 1; ring <= 4; ring += 1) {
      lines.circle(cx, cy, (radius * ring) / 4);
    }
    lines.stroke({ width: 2, color: WHITE, alpha: 0.07 });
    lines.rect(0, 0, width, height).stroke({ width: 14, color: WHITE, alpha: 0.08 });
    lines.rect(0, 0, width, height).stroke({ width: 3, color: WHITE, alpha: 0.6 });

    petals.clear();
    for (let petal = 0; petal < 12; petal += 1) {
      const angle = (petal / 12) * TAU;
      petals.circle(
        cx + Math.cos(angle) * radius * 0.5,
        cy + Math.sin(angle) * radius * 0.5,
        radius * 0.5,
      );
    }
    petals.stroke({ width: 1.5, color: WHITE, alpha: 0.08 });
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      if (state.arena.width !== drawn.width || state.arena.height !== drawn.height) {
        draw(state.arena);
      }
      surface.tint = frame.palette.solClair;
      lines.tint = frame.palette.turquoise;
      petals.tint = frame.palette.or;
    },
    destroy(): void {
      parent.destroy({ children: true });
    },
  };
}
