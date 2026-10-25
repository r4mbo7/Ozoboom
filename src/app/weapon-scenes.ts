import type { GameContent } from '../data/types';
import type { Inset, Renderer } from '../render/types';
import { clamp } from '../shared/scalar';
import { TICK_MS } from '../shared/tempo';
import { type WeaponWorld, createWeaponWorld } from '../sim/weapon-world';

export interface WeaponScenes {
  // Until the returned function is called.
  show(canvas: HTMLCanvasElement, weaponId: string, setId: string, classId: string): () => void;
  frame(now: number, calm: boolean): void;
}

interface Scene {
  canvas: HTMLCanvasElement;
  world: WeaponWorld;
  clock: number;
  // In calm mode a scene holds on the moment its weapon acts.
  still: boolean;
}

// A scene shows this much world across, a little more on a short card, so that a weapon's reach fits.
const VIEW_WIDTH = 440;
const MIN_VIEW_HEIGHT = 140;
const MAX_VIEW_HEIGHT = 320;
// A slow frame steps at most this many ticks, so that a late card does not freeze the page.
const MAX_TICKS_PER_FRAME = 8;
// A calm scene holds ACTS_FOR ticks after its weapon first acts, or after HOLDS_BY_BARS bars: a weapon fires at least once every two bars.
const ACTS_FOR = 4;
const HOLDS_BY_BARS = 3;

function viewHeight(canvas: HTMLCanvasElement): number {
  const share = canvas.clientHeight / Math.max(canvas.clientWidth, 1);
  return clamp(VIEW_WIDTH * share, MIN_VIEW_HEIGHT, MAX_VIEW_HEIGHT);
}

function acts(world: WeaponWorld): boolean {
  return world.state.events.some(
    (event) =>
      event.type === 'weaponFired' || event.type === 'placedSpawned' || event.type === 'enemyHit',
  );
}

function hold(scene: Scene): void {
  let after = -1;
  const holdsBy = HOLDS_BY_BARS * scene.world.ticksPerBar;
  while (scene.world.state.tick < holdsBy && after < ACTS_FOR) {
    scene.world.step();
    after = after >= 0 || acts(scene.world) ? after + 1 : after;
  }
  scene.still = true;
}

export function createWeaponScenes(
  content: GameContent,
  renderer: Pick<Renderer, 'setInsets'>,
  start = performance.now(),
): WeaponScenes {
  let scenes: Scene[] = [];
  let painted = true;

  return {
    show(canvas, weaponId, setId, classId) {
      const scene: Scene = {
        canvas,
        world: createWeaponWorld(content, setId, classId, weaponId),
        clock: start,
        still: false,
      };
      scenes.push(scene);
      return () => {
        scenes = scenes.filter((other) => other !== scene);
      };
    },
    frame(now, calm) {
      start = now;
      if (scenes.length === 0 && painted) {
        return;
      }
      for (const scene of scenes) {
        if (calm) {
          if (!scene.still) {
            hold(scene);
          }
          scene.clock = now;
          continue;
        }
        const due = Math.min(Math.floor((now - scene.clock) / TICK_MS), MAX_TICKS_PER_FRAME);
        for (let tick = 0; tick < due; tick += 1) {
          scene.world.step();
        }
        scene.clock = due === MAX_TICKS_PER_FRAME ? now : scene.clock + due * TICK_MS;
      }
      const insets: Inset[] = scenes.map((scene) => ({
        canvas: scene.canvas,
        state: scene.world.state,
        viewHeight: viewHeight(scene.canvas),
      }));
      renderer.setInsets(insets);
      painted = insets.length === 0;
    },
  };
}
