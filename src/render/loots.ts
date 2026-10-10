import type { Sprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { TRAP_TOKENS } from './textures';
import { add, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const ICON_RADIUS = 9;
const LOOT_RING_RADIUS = 16;
const CARRIER_RING_GAP = 8;

interface LootView {
  readonly ring: Sprite;
  readonly outline: Sprite;
  readonly body: Sprite;
}

// A loot shows the trap it holds inside a turquoise ring; a bad vibe carrying one wears that ring.
export function createLoots(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const loots = new ViewPool<LootView>(
    () => ({
      ring: add(layers.pickups, t.ring),
      outline: add(layers.pickups, t.traps.shockwave),
      body: add(layers.pickups, t.traps.shockwave),
    }),
    (view) => {
      hide(view.ring, view.outline, view.body);
    },
  );
  const carriers = new ViewPool<Sprite>(
    () => add(layers.pickups, t.ring),
    (ring) => {
      hide(ring);
    },
  );

  function ring(sprite: Sprite, x: number, y: number, radius: number, frame: Frame): void {
    sprite.visible = true;
    setTint(sprite, frame.palette.turquoise);
    sprite.position.set(x, y);
    sprite.scale.set((radius * (frame.calm ? 1 : 1 + 0.08 * frame.pulse)) / t.ring.radius);
    sprite.alpha = frame.light.haloAlpha;
  }

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      loots.begin();
      for (const loot of state.loots ?? []) {
        const view = loots.acquire(loot.id);
        const kind = lookup(ctx.trapLooks, loot.trapId, 'trap kind').effect.kind;
        const shape = t.traps[kind];
        view.body.texture = shape.texture;
        setTint(view.body, frame.palette[TRAP_TOKENS[kind]]);
        view.body.visible = true;
        view.body.position.set(loot.x, loot.y);
        view.body.scale.set(ICON_RADIUS / shape.radius);
        placeOutline(view.outline, view.body, shape.texture, shape.radius, frame);
        ring(view.ring, loot.x, loot.y, LOOT_RING_RADIUS, frame);
      }
      loots.end();

      carriers.begin();
      for (const enemy of state.enemies) {
        if (enemy.carriesLoot === true) {
          const x = lerp(enemy.prevX, enemy.x, alpha);
          const y = lerp(enemy.prevY, enemy.y, alpha);
          ring(carriers.acquire(enemy.id), x, y, enemy.radius + CARRIER_RING_GAP, frame);
        }
      }
      carriers.end();
    },
    destroy(): void {
      loots.begin();
      loots.end();
      carriers.begin();
      carriers.end();
    },
  };
}
