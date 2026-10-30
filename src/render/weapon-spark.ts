import type { Sprite } from 'pixi.js';
import type { EntityId, ProjectileState } from '../sim/state';
import type { RenderContext } from './context';
import { SPARK_TRAIL_LENGTH } from './textures-devil-stick';
import { add, hide, setTint } from './util';
import { ViewPool } from './views';

// In spark sizes behind its head.
const TRAIL = 1.7;

interface SparkView {
  readonly trail: Sprite;
  id: EntityId;
  fromX: number;
  fromY: number;
}

export interface Sparks {
  begin(): void;
  draw(
    projectile: ProjectileState,
    spot: { x: number; y: number; rotation: number; size: number },
    color: number,
  ): void;
  end(): void;
}

// The LED of the devil stick in long exposure: a trail fading behind its head, never longer than
// the way already flown so it does not stick out behind the player.
export function createSparks(ctx: RenderContext): Sparks {
  const shapes = ctx.textures.weapons.devilStick;
  const views = new ViewPool<SparkView>(
    () => ({ trail: add(ctx.layers.fx, shapes.sparkTrail), id: -1, fromX: 0, fromY: 0 }),
    (view) => {
      hide(view.trail);
    },
  );

  return {
    begin: () => {
      views.begin();
    },
    end: () => {
      views.end();
    },
    draw(projectile, { x, y, rotation, size }, color) {
      const view = views.acquire(projectile.id);
      if (view.id !== projectile.id) {
        view.id = projectile.id;
        view.fromX = projectile.prevX;
        view.fromY = projectile.prevY;
      }
      const { trail } = view;
      const length = Math.min(size * TRAIL, Math.hypot(x - view.fromX, y - view.fromY));
      trail.visible = true;
      setTint(trail, color);
      trail.position.set(
        x - (Math.cos(rotation) * length) / 2,
        y - (Math.sin(rotation) * length) / 2,
      );
      trail.rotation = rotation;
      trail.scale.set(length / SPARK_TRAIL_LENGTH, size / (shapes.sparkTrail.radius * 2));
    },
  };
}
