import type { Renderer as PixiRenderer, WebGLOptions } from 'pixi.js';
import type { ClassDefinition, SkillDefinition } from '../data/types';
import { paletteAt } from '../shared/palette';
import { TICKS_PER_BEAT, TICK_MS } from '../shared/tempo';
import { checkDrawings } from './drawings';
import { holdRenderer, rebuildInstructions } from './held-renderer';
import { paintPortraitDisc } from './portrait-canvas';
import {
  PORTRAIT_NIGHT,
  PORTRAIT_PIXELS,
  type Scene,
  createScene,
  drawScene,
} from './portrait-scene';
import { standing } from './portrait-state';
import { classTokens } from './palette';
import { type Textures, createTextures } from './textures';
import { createWebGLRenderer } from './webgl';

export type PortraitClass = Pick<ClassDefinition, 'id' | 'radius'> & {
  readonly skill: Pick<SkillDefinition, 'effect'>;
};

export interface Portrait {
  readonly element: HTMLCanvasElement;
  setClass(classId: string): void;
  destroy(): void;
}

export interface Portraits {
  // A class alive, as the class picker shows it.
  readonly create: () => Portrait;
  // A class still, filling a canvas its page sizes: the Programme's portraits.
  readonly paint: (canvas: HTMLCanvasElement, classId: string) => void;
}

const FINER = 4;
// Long enough to go from one menu to the next without making the renderer again.
const RELEASE_MS = 10_000;
// Half a beat after the first beat the scene plays: a look that keys on its beat has had one.
const STILL_TICK = (3 * TICKS_PER_BEAT) / 2;
const RENDERER: Partial<WebGLOptions> = {
  width: PORTRAIT_PIXELS,
  height: PORTRAIT_PIXELS,
  resolution: 1,
  antialias: true,
  backgroundAlpha: 0,
  preserveDrawingBuffer: true,
  skipExtensionImports: true,
};

interface View extends Scene {
  readonly canvas: HTMLCanvasElement;
  visible: boolean;
}

// One hidden WebGL renderer draws every portrait in turn; nothing runs while none is on screen.
// The renderer holds a WebGL context, which a phone has few of: it is made when a portrait shows,
// and let go once none has shown for a while, so that a game holds the game's context alone.
// Until it draws, or when the browser refuses it, a portrait shows its class's lit disc.
export function createPortraits(classes: readonly PortraitClass[], calm: () => boolean): Portraits {
  const definitions = new Map(classes.map((definition) => [definition.id, definition]));
  const tokens = classTokens(classes);
  const skillEffects = new Map(
    classes.map((definition) => [definition.id, definition.skill.effect]),
  );
  const views = new Map<Element, View>();
  // A still scene per class, and the canvases waiting for the renderer to paint them.
  const stills = new Map<string, Scene>();
  const waiting = new Map<HTMLCanvasElement, string>();
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const view = views.get(entry.target);
      if (view !== undefined) {
        const appearing = entry.isIntersecting && !view.visible;
        view.visible = entry.isIntersecting;
        if (appearing) {
          paintDisc(view);
        }
      }
    }
    wake();
  });
  // Painted as soon as it has a size, before that frame shows: until then it has no buffer to paint.
  const sizer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const view = views.get(entry.target);
      if (view === undefined || entry.contentRect.width === 0) {
        continue;
      }
      const pixi = held.current;
      if (pixi === null) {
        paintClassDisc(view.canvas, view.state.players[0]?.classId ?? '');
      } else {
        draw(view, view.canvas, pixi, ticksAt(performance.now()));
      }
    }
  });
  const palette = paletteAt(PORTRAIT_NIGHT);
  let textures: Textures | null = null;
  let startedAt = Number.NaN;
  let frameRequest = 0;
  let rendererRank = 0;
  // A refused context leaves the discs on, and is asked for again the next time portraits show.
  const held = holdRenderer(() => createWebGLRenderer(RENDERER), {
    releaseAfterMs: RELEASE_MS,
    onReady() {
      rendererRank += 1;
      paintWaiting();
      wake();
    },
  });

  function definitionOf(classId: string): PortraitClass {
    const found = definitions.get(classId);
    if (found === undefined) {
      throw new Error(`No class "${classId}" to portray`);
    }
    return found;
  }

  function anyVisible(): boolean {
    for (const view of views.values()) {
      if (view.visible) {
        return true;
      }
    }
    return false;
  }

  function wake(): void {
    if (!anyVisible()) {
      held.idle();
      return;
    }
    held.want();
    if (held.current !== null && frameRequest === 0) {
      frameRequest = requestAnimationFrame(loop);
    }
  }

  function paintClassDisc(canvas: HTMLCanvasElement, classId: string): void {
    const token = tokens.get(classId);
    if (token !== undefined) {
      paintPortraitDisc(canvas, PORTRAIT_PIXELS, palette[token], calm());
    }
  }

  // Only on screen, and while no renderer draws the portraits.
  function paintDisc({ canvas, state, visible }: View): void {
    if (visible && held.current === null) {
      paintClassDisc(canvas, state.players[0]?.classId ?? '');
    }
  }

  // The scene drawn into the canvas at `now`, in ticks; Pixi's instructions made anew for a new renderer.
  function draw(
    scene: Scene,
    canvas: HTMLCanvasElement,
    renderer: PixiRenderer,
    now: number,
    framed = false,
  ): void {
    if (scene.drawnBy !== rendererRank) {
      if (scene.drawnBy !== 0) {
        rebuildInstructions(scene.stage.renderGroup);
      }
      scene.drawnBy = rendererRank;
    }
    const effectOf = (classId: string) => definitionOf(classId).skill.effect;
    drawScene({ scene, canvas, renderer, now, calm: calm(), effectOf, textures, framed });
  }

  function loop(time: number): void {
    frameRequest = 0;
    const pixi = held.current;
    if (pixi === null) {
      return;
    }
    const now = ticksAt(time);
    for (const view of views.values()) {
      if (view.visible) {
        draw(view, view.canvas, pixi, now);
      }
    }
    wake();
  }

  function ticksAt(time: number): number {
    if (Number.isNaN(startedAt)) {
      startedAt = time;
    }
    return (time - startedAt) / TICK_MS;
  }

  function sceneOf(definition: PortraitClass): Scene {
    if (textures === null) {
      textures = createTextures(FINER);
      checkDrawings(classes, textures.players.drawings);
    }
    return createScene({ textures, tokens, skillEffects }, definition);
  }

  function paintStill(canvas: HTMLCanvasElement, classId: string, renderer: PixiRenderer): void {
    let scene = stills.get(classId);
    if (scene === undefined) {
      scene = sceneOf(definitionOf(classId));
      stills.set(classId, scene);
    }
    draw(scene, canvas, renderer, STILL_TICK, true);
  }

  function paintWaiting(): void {
    const renderer = held.current;
    if (renderer === null) {
      return;
    }
    for (const [canvas, classId] of waiting) {
      if (canvas.isConnected) {
        paintStill(canvas, classId, renderer);
      }
    }
    waiting.clear();
  }

  function create(): Portrait {
    const first = classes[0];
    if (first === undefined) {
      throw new Error('No class to portray');
    }
    const scene = sceneOf(first);
    const { stage, state, families } = scene;
    const canvas = document.createElement('canvas');
    canvas.className = 'portrait';
    canvas.setAttribute('aria-hidden', 'true');

    const portrait: Portrait = {
      element: canvas,
      setClass(classId) {
        const definition = definitionOf(classId);
        const player = state.players[0];
        if (player === undefined || player.classId === classId) {
          return;
        }
        state.players[0] = { ...standing(definition), id: player.id };
        for (const family of families) {
          family.reset?.();
        }
        paintDisc(view);
      },
      destroy() {
        if (views.delete(canvas)) {
          watcher.unobserve(canvas);
          sizer.unobserve(canvas);
          for (const family of families) {
            family.destroy();
          }
          stage.destroy({ children: true });
          canvas.remove();
        }
      },
    };
    const view: View = { ...scene, canvas, visible: false };
    views.set(canvas, view);
    watcher.observe(canvas);
    sizer.observe(canvas);
    return portrait;
  }

  return {
    create,
    paint(canvas, classId) {
      held.want();
      const renderer = held.current;
      if (renderer === null) {
        paintClassDisc(canvas, classId);
        waiting.set(canvas, classId);
        return;
      }
      waiting.delete(canvas);
      paintStill(canvas, classId, renderer);
      wake();
    },
  };
}
