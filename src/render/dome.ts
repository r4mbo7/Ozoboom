import { Container, Graphics } from 'pixi.js';
import type { SetDefinition } from '../data/types';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import {
  PANELS,
  RIBS,
  RIB_FROM,
  RING,
  SCALE,
  TWINKLE_GROUPS,
  crownPosts,
  garlands,
} from './dome-layout';
import type { Frame } from './frame';
import { mixColor } from './ground-sun';
import { setTint } from './util';

const WHITE = 0xffffff;
const TAU = Math.PI * 2;
const DARK_WOOD = 0x2a1a0c;
const PANEL_TOKENS = ['mage', 'turquoise', 'or', 'healer'] as const;
const POST_SIZE = 30;

// The decor of a stage with `decor: 'dome'`: a see-through dome of ribs, garlands and UV panels laid
// under the fight, a ring of posts where the stage's obstacles are. Drawn once white, then tinted.
export function createDome(ctx: RenderContext, sets: ReadonlyMap<string, SetDefinition>): Family {
  const root = new Container();
  ctx.layers.dome.addChild(root);
  const panels = PANEL_TOKENS.map(() => new Graphics());
  const garland = [0, ...Array.from({ length: TWINKLE_GROUPS }, (_, i) => i + 1)].map(
    () => new Graphics(),
  );
  const outline = new Graphics();
  const ribs = new Graphics();
  const posts = new Graphics();
  root.addChild(...panels, outline, ribs, ...garland, posts);

  let drawnKey = '';
  let styledAt = Number.NaN;
  let styledAdditive: boolean | null = null;

  function draw(set: SetDefinition, seed: number): void {
    const center = { x: set.arena.width / 2, y: set.arena.height / 2 };
    const step = TAU / RIBS;
    const at = (radius: number, angle: number): [number, number] => [
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius,
    ];

    for (const [index, panel] of panels.entries()) {
      panel.clear();
      for (let rib = index; rib < RIBS; rib += PANEL_TOKENS.length) {
        const a0 = rib * step + 0.02;
        const a1 = (rib + 1) * step - 0.02;
        panel.moveTo(...at(PANELS.from, a0));
        panel.lineTo(...at(PANELS.to, a0));
        panel.arc(center.x, center.y, PANELS.to, a0, a1);
        panel.lineTo(...at(PANELS.from, a1));
        panel.arc(center.x, center.y, PANELS.from, a1, a0, true);
        panel.closePath();
      }
      panel.fill({ color: WHITE, alpha: 0.18 });
      for (let rib = index; rib < RIBS; rib += PANEL_TOKENS.length) {
        const [x, y] = at((PANELS.from + PANELS.to) / 2, (rib + 0.5) * step);
        panel.circle(x, y, 8 * SCALE);
      }
      panel.stroke({ width: 1.4 * SCALE, color: WHITE, alpha: 0.8 });
    }

    for (const [shape, grow, alpha] of [
      [outline, 2, 0.5],
      [ribs, 0, 0.7],
    ] as const) {
      shape.clear();
      for (let rib = 0; rib < RIBS; rib += 1) {
        shape.moveTo(...at(RIB_FROM, rib * step)).lineTo(...at(RING, rib * step));
      }
      shape.stroke({ width: (3 + grow) * SCALE, color: WHITE, alpha, cap: 'round' });
      shape.circle(center.x, center.y, RING);
      shape.stroke({ width: (7 + grow) * SCALE, color: WHITE, alpha });
    }

    for (const shape of garland) {
      shape.clear();
    }
    for (const light of garlands(seed, center)) {
      garland[light.group]?.circle(light.x, light.y, light.radius * SCALE).fill(WHITE);
    }

    posts.clear();
    const half = POST_SIZE / 2;
    for (const post of crownPosts(set.obstacles ?? [], center)) {
      const angle = Math.atan2(post.y - center.y, post.x - center.x);
      const corners = [
        [-half, -half],
        [half, -half],
        [half, half],
        [-half, half],
      ].flatMap(([dx = 0, dy = 0]) => [
        post.x + dx * Math.cos(angle) - dy * Math.sin(angle),
        post.y + dx * Math.sin(angle) + dy * Math.cos(angle),
      ]);
      posts.poly(corners).fill(WHITE).poly(corners).stroke({ width: 1.5, color: DARK_WOOD });
    }
  }

  function style(frame: Frame): void {
    const { palette, light } = frame;
    styledAt = frame.fraction;
    styledAdditive = light.additive;
    const wood = mixColor(palette.or, DARK_WOOD, 0.45);
    const mode = light.additive ? 'add' : 'normal';
    for (const [index, panel] of panels.entries()) {
      setTint(panel, palette[PANEL_TOKENS[index] ?? 'or']);
      panel.blendMode = mode;
      panel.alpha = light.additive ? 1 : 0.85;
    }
    ribs.tint = wood;
    outline.tint = palette.texte;
    outline.visible = !light.additive;
    posts.tint = wood;
    for (const shape of garland) {
      shape.tint = palette.noyau;
      shape.blendMode = mode;
    }
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      const set = sets.get(state.setId);
      root.visible = set?.decor === 'dome';
      if (!root.visible || set === undefined) {
        return;
      }
      const key = `${set.id} ${String(state.seed)}`;
      if (key !== drawnKey) {
        drawnKey = key;
        draw(set, state.seed);
      }
      if (frame.fraction !== styledAt || frame.light.additive !== styledAdditive) {
        style(frame);
      }
      for (const [index, shape] of garland.entries()) {
        shape.alpha =
          index === 0 || frame.calm
            ? 1
            : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame.now * 0.05 + index * 2.1));
      }
    },
    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
