import { Container, type Sprite } from 'pixi.js';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { EntityId, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { EnemyPose } from './enemies';
import type { Frame } from './frame';
import { crackStage } from './hit-marks';
import { add } from './util';
import { ViewPool } from './views';

const POP_TICKS = TICKS_PER_BEAT / 3;
const POP = 0.5;
const TURN_PER_VIBE = 2.4;

interface Wound {
  readonly sprite: Sprite;
  stage: number;
  since: number;
}

export function createWounds(
  ctx: RenderContext,
  poseOf: (id: EntityId) => EnemyPose | undefined,
): Family {
  const { cracks } = ctx.textures.masks;
  const [first] = cracks;
  if (first === undefined) {
    throw new Error('Mask atlas has no crack');
  }
  const container = new Container();
  ctx.layers.enemies.addChild(container);
  const views = new ViewPool<Wound>(
    () => ({ sprite: add(container, first), stage: 0, since: Number.NEGATIVE_INFINITY }),
    (view) => {
      view.sprite.visible = false;
      view.stage = 0;
    },
  );

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      views.begin();
      for (const enemy of state.enemies) {
        const stage =
          enemy.isBoss || (enemy.downTicks ?? 0) > 0 ? 0 : crackStage(enemy.hp, enemy.maxHp);
        const shape = cracks[stage - 1];
        const pose = poseOf(enemy.id);
        if (shape === undefined || pose === undefined) {
          continue;
        }
        const view = views.acquire(enemy.id);
        const { sprite } = view;
        if (stage !== view.stage) {
          view.since = stage > view.stage ? frame.now : Number.NEGATIVE_INFINITY;
          view.stage = stage;
          sprite.texture = shape.texture;
        }
        const age = (frame.now - view.since) / POP_TICKS;
        const pop = frame.calm || age < 0 || age >= 1 ? 0 : POP * (1 - age) * (1 - age);
        sprite.visible = true;
        sprite.position.set(pose.x, pose.y);
        sprite.rotation = pose.tilt + enemy.id * TURN_PER_VIBE;
        sprite.scale.set((enemy.radius / shape.radius) * (1 + pop));
      }
      views.end();
    },
    reset(): void {
      views.releaseAll();
    },
    destroy(): void {
      views.releaseAll();
    },
  };
}
