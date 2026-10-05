import type { Sprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import { STREAK_HEAD } from './textures';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { add, byId, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

interface ShotView {
  readonly trail: Sprite;
  readonly outline: Sprite;
}

export function createProjectiles(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const enemyShots = new ViewPool<Sprite>(
    () => add(layers.enemyShots, t.enemyShot),
    (sprite) => {
      hide(sprite);
    },
  );
  const lightShots = new ViewPool<ShotView>(
    () => ({
      outline: add(layers.fx, t.streak, STREAK_HEAD),
      trail: add(layers.fx, t.streak, STREAK_HEAD),
    }),
    (view) => {
      hide(view.trail, view.outline);
    },
  );

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light } = frame;
      enemyShots.begin();
      lightShots.begin();
      for (const projectile of state.projectiles) {
        const { owner } = projectile;
        if (owner.kind === 'weapon') {
          continue;
        }
        const x = lerp(projectile.prevX, projectile.x, alpha);
        const y = lerp(projectile.prevY, projectile.y, alpha);
        const rotation = Math.atan2(projectile.vy, projectile.vx);
        if (owner.kind === 'enemy') {
          const sprite = enemyShots.acquire(projectile.id);
          setTint(sprite, palette.badVibeRim);
          sprite.visible = true;
          sprite.position.set(x, y);
          sprite.rotation = rotation;
          sprite.scale.set(projectile.radius / t.enemyShot.radius);
          continue;
        }
        const { trail, outline } = lightShots.acquire(projectile.id);
        const token =
          owner.kind === 'player'
            ? lookup(ctx.classTokens, byId(state.players, owner.playerId)?.classId ?? '', 'class')
            : 'texte';
        setTint(trail, palette[token]);
        trail.visible = true;
        trail.alpha = light.haloAlpha;
        trail.position.set(x, y);
        trail.rotation = rotation;
        const size = projectile.radius / t.streak.radius;
        trail.scale.set(size, size * 0.6);
        placeOutline(outline, trail, t.streak.texture, t.streak.radius, frame);
      }
      enemyShots.end();
      lightShots.end();
    },
    destroy(): void {
      layers.enemyShots.destroy({ children: true });
    },
  };
}
