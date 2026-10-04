import type { Sprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import { TICKS_PER_BAR } from '../shared/tempo';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { add, hide, lookup, setTint } from './util';
import { ViewPool } from './views';

const TAU = Math.PI * 2;
const BOSS_TURN_TICKS = TICKS_PER_BAR * 2;

interface EnemyView {
  readonly sprite: Sprite;
  heading: number;
}

export function createEnemies(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const views = new ViewPool<EnemyView>(
    () => ({ sprite: add(layers.enemies, t.enemies.horde), heading: 0 }),
    (view) => {
      hide(view.sprite);
    },
  );

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const bossTurn = frame.calm ? 0 : (frame.now / BOSS_TURN_TICKS) * TAU;
      views.begin();
      for (const enemy of state.enemies) {
        const behaviour = enemy.isBoss ? 'boss' : lookup(ctx.behaviours, enemy.kind, 'enemy kind');
        const shape = t.enemies[behaviour];
        const view = views.acquire(enemy.id);
        const dx = enemy.x - enemy.prevX;
        const dy = enemy.y - enemy.prevY;
        if (dx !== 0 || dy !== 0) {
          view.heading = Math.atan2(dy, dx);
        }
        const { sprite } = view;
        sprite.texture = shape.texture;
        setTint(sprite, frame.palette.badVibe);
        sprite.visible = true;
        sprite.position.set(lerp(enemy.prevX, enemy.x, alpha), lerp(enemy.prevY, enemy.y, alpha));
        sprite.scale.set(enemy.radius / shape.radius);
        sprite.rotation =
          behaviour === 'rusher' ? view.heading : behaviour === 'boss' ? bossTurn : 0;
      }
      views.end();
    },
    destroy(): void {
      layers.enemies.destroy({ children: true });
    },
  };
}
