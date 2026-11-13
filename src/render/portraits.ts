import { Container, type Renderer as PixiRenderer, type WebGLOptions } from 'pixi.js';
import type { ClassDefinition, SkillDefinition } from '../data/types';
import { NIGHT_END, NIGHT_START, lightAt, paletteAt } from '../shared/palette';
import { TICK_MS } from '../shared/tempo';
import type { SimState } from '../sim/state';
import { createClassEffects } from './class-effects';
import { checkDrawings } from './drawings';
import type { Family } from './context';
import { type Frame, createFrame } from './frame';
import { holdRenderer, rebuildInstructions } from './held-renderer';
import { type Layers, applyLight, createLayers } from './layers';
import { fitPortraitCanvas, paintPortraitDisc } from './portrait-canvas';
import { portraitContext } from './portrait-context';
import { emptyState, portraitEvents, standing } from './portrait-state';
import { beatEnvelope } from './motion';
import { classTokens, writePixiPalette } from './palette';
import { createPlayers } from './players';
import { type Textures, createTextures } from './textures';
import { REFERENCE_RADIUS } from './textures-players';
import { createWebGLRenderer } from './webgl';

export type PortraitClass = Pick<ClassDefinition, 'id' | 'radius'> & {
  readonly skill: Pick<SkillDefinition, 'effect'>;
};

export interface Portrait {
  readonly element: HTMLCanvasElement;
  setClass(classId: string): void;
  destroy(): void;
}

const VIEW_UNITS = 80;
const THUMBNAIL_UNITS = 52;
const THUMBNAIL_PIXELS = 120;
const FINER = 4;
const MAX_PIXELS = 512;
const NIGHT = (NIGHT_START + NIGHT_END) / 2;
const CALM_PULSE = 0.3;
const MAX_CATCH_UP = 8;
// Long enough to go from one menu to the next without making the renderer again.
const RELEASE_MS = 10_000;
const RENDERER: Partial<WebGLOptions> = {
  width: MAX_PIXELS,
  height: MAX_PIXELS,
  resolution: 1,
  antialias: true,
  backgroundAlpha: 0,
  preserveDrawingBuffer: true,
  skipExtensionImports: true,
};

interface View {
  readonly canvas: HTMLCanvasElement;
  readonly stage: Container;
  readonly layers: Layers;
  readonly families: readonly Family[];
  readonly state: SimState;
  readonly frame: Frame;
  beatTick: number;
  visible: boolean;
  // The renderer that last drew the view, by its rank; 0 before any drew it.
  drawnBy: number;
}

// One hidden WebGL renderer draws every portrait in turn; nothing runs while none is on screen.
// The renderer holds a WebGL context, which a phone has few of: it is made when a portrait shows,
// and let go once none has shown for a while, so that a game holds the game's context alone.
// Until it draws, or when the browser refuses it, a portrait shows its class's lit disc.
export function createPortraits(
  classes: readonly PortraitClass[],
  calm: () => boolean,
): () => Portrait {
  const definitions = new Map(classes.map((definition) => [definition.id, definition]));
  const tokens = classTokens(classes);
  const skillEffects = new Map(
    classes.map((definition) => [definition.id, definition.skill.effect]),
  );
  const views = new Map<Element, View>();
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
  const palette = paletteAt(NIGHT);
  const light = lightAt(NIGHT);
  let textures: Textures | null = null;
  let startedAt = Number.NaN;
  let frameRequest = 0;
  let rendererRank = 0;
  // A refused context leaves the discs on, and is asked for again the next time portraits show.
  const held = holdRenderer(() => createWebGLRenderer(RENDERER), {
    releaseAfterMs: RELEASE_MS,
    onReady() {
      rendererRank += 1;
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

  // Only on screen, and while no renderer draws the portraits.
  function paintDisc({ canvas, state, visible }: View): void {
    const token = tokens.get(state.players[0]?.classId ?? '');
    if (visible && held.current === null && token !== undefined) {
      paintPortraitDisc(canvas, MAX_PIXELS, palette[token], calm());
    }
  }

  function advance(view: View, tick: number): void {
    const { state, frame } = view;
    const player = state.players[0];
    if (player === undefined) {
      return;
    }
    const effect = definitionOf(player.classId).skill.effect;
    const from = Math.max(state.tick + 1, tick - MAX_CATCH_UP);
    for (let next = from; next <= tick; next += 1) {
      state.tick = next;
      if (player.invulnerableTicks !== undefined && player.invulnerableTicks > 0) {
        player.invulnerableTicks -= 1;
      }
      state.events = portraitEvents(next, player, effect);
      for (const event of state.events) {
        if (event.type === 'beat') {
          view.beatTick = next;
        }
        for (const family of view.families) {
          family.onEvent?.(event, state, frame);
        }
      }
    }
  }

  function draw(view: View, renderer: PixiRenderer, now: number): void {
    const { canvas, frame, layers, state } = view;
    if (view.drawnBy !== rendererRank) {
      if (view.drawnBy !== 0) {
        rebuildInstructions(view.stage.renderGroup);
      }
      view.drawnBy = rendererRank;
    }
    const fitted = fitPortraitCanvas(canvas, MAX_PIXELS);
    if (fitted === null) {
      return;
    }
    const { target, width, height } = fitted;
    const tick = Math.floor(now);
    advance(view, tick);
    const alpha = now - tick;
    const units = canvas.clientHeight < THUMBNAIL_PIXELS ? THUMBNAIL_UNITS : VIEW_UNITS;
    const scale = Math.min(width, height) / units;
    frame.now = now;
    frame.calm = calm();
    frame.pulse = beatEnvelope(now - view.beatTick, frame.tempo) * (frame.calm ? CALM_PULSE : 1);
    frame.camera = { centerX: 0, centerY: 0, scale, screenWidth: width, screenHeight: height };
    const player = state.players[0];
    const middle =
      player === undefined
        ? 0
        : ((textures?.players.drawings.get(player.classId)?.get().centerAhead ?? 0) *
            player.radius) /
          REFERENCE_RADIUS;
    layers.world.scale.set(scale);
    layers.world.position.set(
      width / 2 - (player?.aim.x ?? 0) * middle * scale,
      height / 2 - (player?.aim.y ?? 0) * middle * scale,
    );
    for (const family of view.families) {
      family.update(state, alpha, frame);
    }
    renderer.render({ container: view.stage, clear: true });
    target.clearRect(0, 0, width, height);
    target.drawImage(renderer.canvas, 0, 0, width, height, 0, 0, width, height);
  }

  function loop(time: number): void {
    frameRequest = 0;
    const pixi = held.current;
    if (pixi === null) {
      return;
    }
    if (Number.isNaN(startedAt)) {
      startedAt = time;
    }
    const now = (time - startedAt) / TICK_MS;
    for (const view of views.values()) {
      if (view.visible) {
        draw(view, pixi, now);
      }
    }
    wake();
  }

  return () => {
    if (textures === null) {
      textures = createTextures(FINER);
      checkDrawings(classes, textures.players.drawings);
    }
    const stage = new Container();
    const layers = createLayers(stage);
    const ctx = portraitContext(textures, layers, tokens, skillEffects);
    const first = classes[0];
    if (first === undefined) {
      throw new Error('No class to portray');
    }
    const state = emptyState(standing(first), VIEW_UNITS);
    const frame = createFrame();
    frame.portrait = true;
    frame.fraction = NIGHT;
    frame.light = light;
    writePixiPalette(frame.palette, palette);
    applyLight(layers, frame);
    const canvas = document.createElement('canvas');
    canvas.className = 'portrait';
    canvas.setAttribute('aria-hidden', 'true');
    const families = [createPlayers(ctx), createClassEffects(ctx, () => undefined)];

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
          for (const family of families) {
            family.destroy();
          }
          stage.destroy({ children: true });
          canvas.remove();
        }
      },
    };
    const view: View = {
      canvas,
      stage,
      layers,
      families,
      state,
      frame,
      beatTick: Number.NEGATIVE_INFINITY,
      drawnBy: 0,
      visible: false,
    };
    views.set(canvas, view);
    watcher.observe(canvas);
    return portrait;
  };
}
