import { Graphics, type Container, type Sprite } from 'pixi.js';
import { nextFloat, seedRng } from '../shared/prng';
import type { SimState } from '../sim/state';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { LAKE_SKY_MIX, type Layout, shoreAt } from './ground-layout';
import { mixColor } from './ground-sun';
import { lerp } from './motion';
import { add, lookup, setTint } from './util';

const WHITE = 0xffffff;
const REFLECT_REACH = 240;
const REFLECTED_PLAYERS = 4;

// The lake takes the left edge of the arena: turquoise mixed with the sky of the hour, with the light of
// the core and of the players near the shore laid on it, flipped and faint. Calm mode keeps them still.
export function createWater(ctx: RenderContext, parent: Container) {
  const { textures: t } = ctx;
  const lake = new Graphics();
  const ripples = new Graphics();
  const shore = new Graphics();
  parent.addChild(lake, ripples, shore);
  const coreReflection = add(parent, t.core);
  const playerReflections: Sprite[] = [];
  for (let index = 0; index < REFLECTED_PLAYERS; index += 1) {
    playerReflections.push(add(parent, t.players.shoulders));
  }
  for (const sprite of [coreReflection, ...playerReflections]) {
    sprite.visible = false;
  }
  let layout: Layout | null = null;

  return {
    draw(next: Layout, seed: number): void {
      layout = next;
      const { height } = next.arena;
      const contour: number[] = [];
      for (let y = 0; y <= height; y += 20) {
        contour.push(shoreAt(next, y), y);
      }
      lake
        .clear()
        .poly([0, 0, ...contour, 0, height])
        .fill(WHITE);
      shore.clear().poly(contour, false).stroke({ width: 14, color: WHITE, alpha: 0.18 });
      shore.poly(contour, false).stroke({ width: 3, color: WHITE, alpha: 0.7 });
      ripples.clear();
      const rng = seedRng((seed + 31) >>> 0);
      for (let index = 0; index < 18; index += 1) {
        const y = nextFloat(rng) * height;
        const x = nextFloat(rng) * Math.max(shoreAt(next, y) - 50, 10);
        const span = 20 + nextFloat(rng) * 40;
        ripples
          .moveTo(x, y)
          .bezierCurveTo(x + span * 0.3, y - 5, x + span * 0.7, y + 5, x + span, y);
      }
      ripples.stroke({ width: 1.5, color: WHITE, alpha: 0.35 });
    },
    style(frame: Frame): void {
      const { palette } = frame;
      lake.tint = mixColor(palette.turquoise, palette.solClair, LAKE_SKY_MIX);
      lake.alpha = 0.92;
      shore.tint = palette.turquoise;
      ripples.tint = palette.texte;
      ripples.alpha = 0.3;
    },
    update(state: SimState, frame: Frame): void {
      if (layout === null) {
        return;
      }
      const quiet = frame.calm;
      const shimmer = quiet ? 1 : 0.85 + 0.15 * Math.sin(frame.now * 0.09);
      const { core } = state;
      const heart = core.radius / t.core.radius;
      coreReflection.visible = true;
      setTint(coreReflection, frame.palette.noyau);
      coreReflection.position.set(
        shoreAt(layout, core.y) * 0.5,
        core.y + (quiet ? 0 : Math.sin(frame.now * 0.05) * 3),
      );
      coreReflection.scale.set(heart * 0.9, -heart * 0.9);
      coreReflection.alpha = (0.24 + (quiet ? 0 : 0.12 * frame.pulse)) * shimmer;

      let used = 0;
      for (const player of state.players) {
        const sprite = playerReflections[used];
        const edge = shoreAt(layout, player.y);
        const inside = lerp(player.prevX, player.x, 0.5) - edge;
        if (sprite === undefined || player.downed || inside > REFLECT_REACH) {
          continue;
        }
        used += 1;
        const size = player.radius / t.players.shoulders.radius;
        sprite.visible = true;
        setTint(sprite, frame.palette[lookup(ctx.classTokens, player.classId, 'class')]);
        sprite.position.set(
          edge - Math.max(inside, 0) * 0.8,
          player.y + (quiet ? 0 : Math.sin(frame.now * 0.07 + player.id) * 2),
        );
        sprite.scale.set(-size, -size);
        sprite.alpha = 0.3 * (1 - inside / REFLECT_REACH) * shimmer;
      }
      for (let index = used; index < playerReflections.length; index += 1) {
        const sprite = playerReflections[index];
        if (sprite !== undefined) {
          sprite.visible = false;
        }
      }
    },
  };
}
