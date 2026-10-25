import type { Sprite } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { SimState } from '../sim/state';
import { STREAK_HEAD } from './textures';
import type { Family, RenderContext } from './context';
import { enemyShotLook, shotRotation } from './enemy-shots';
import type { Frame } from './frame';
import { add, byId, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

interface ShotView {
  readonly trail: Sprite;
  readonly outline: Sprite;
}

// Read once per shot: the shot keeps its look after the thrower is gone.
interface EnemyShotView {
  readonly sprite: Sprite;
  kind: string | undefined;
}

export function createProjectiles(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const enemyShots = new ViewPool<EnemyShotView>(
    () => ({ sprite: add(layers.enemyShots, t.enemyShot), kind: undefined }),
    (view) => {
      hide(view.sprite);
      view.kind = undefined;
    },
  );
  const lightShots = new ViewPool<ShotView>(
    () => ({
      outline: add(layers.shots, t.streak, STREAK_HEAD),
      trail: add(layers.shots, t.streak, STREAK_HEAD),
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
          const view = enemyShots.acquire(projectile.id);
          view.kind ??= byId(state.enemies, owner.enemyId)?.kind ?? '';
          const look = enemyShotLook(view.kind);
          const shape = t[look.shape];
          const { sprite } = view;
          if (sprite.texture !== shape.texture) {
            sprite.texture = shape.texture;
          }
          setTint(sprite, look.tinted ? palette.badVibeRim : 0xffffff);
          sprite.visible = true;
          sprite.position.set(x, y);
          sprite.rotation = shotRotation(
            projectile.vx,
            projectile.vy,
            frame.now - frame.tempo.originTick,
            frame.tempo.ticksPerBeat,
            look.spins,
            frame.calm,
          );
          sprite.scale.set(projectile.radius / shape.radius);
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
