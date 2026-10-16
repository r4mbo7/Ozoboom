import { Container, type Renderer as PixiRenderer, autoDetectRenderer } from 'pixi.js';
import type { ClassDefinition, SkillDefinition } from '../data/types';
import { NIGHT_END, NIGHT_START, lightAt, paletteAt } from '../shared/palette';
import { TICK_MS } from '../shared/tempo';
import type { SimState } from '../sim/state';
import { createClassEffects } from './class-effects';
import { checkDrawings } from './drawings';
import type { Family, RenderContext } from './context';
import { type Frame, createFrame } from './frame';
import { type Layers, applyLight, createLayers } from './layers';
import { emptyState, portraitEvents, standing } from './portrait-state';
import { beatEnvelope } from './motion';
import { classTokens, writePixiPalette } from './palette';
import { createPlayers } from './players';
import { paintedFiner } from './paint';
import { type Textures, createTextures } from './textures';
import { createClassFxTextures } from './textures-class';
import { REFERENCE, playerTextures } from './textures-players';

export type PortraitClass = Pick<ClassDefinition, 'id' | 'radius'> & {
  readonly skill: Pick<SkillDefinition, 'effect'>;
};

export interface Portrait {
  readonly element: HTMLCanvasElement;
  setClass(classId: string): void;
  destroy(): void;
}

// Units of the world across the shorter side of a portrait: a look fills about half of it.
const VIEW_UNITS = 80;
const THUMBNAIL_UNITS = 52;
const THUMBNAIL_PIXELS = 120;
// The looks are painted for a game; a portrait shows them several times larger.
const FINER = 4;
const MAX_PIXELS = 512;
const NIGHT = (NIGHT_START + NIGHT_END) / 2;
const CALM_PULSE = 0.3;
const MAX_CATCH_UP = 8;

interface View {
  readonly canvas: HTMLCanvasElement;
  readonly stage: Container;
  readonly layers: Layers;
  readonly families: readonly Family[];
  readonly state: SimState;
  readonly frame: Frame;
  beatTick: number;
  visible: boolean;
}

// Classes drawn alive outside a game, as in it: one hidden WebGL renderer draws every portrait in
// turn and each copies its picture into its own canvas. Only the portraits on screen are drawn, and
// nothing runs while none is.
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
        view.visible = entry.isIntersecting;
      }
    }
    wake();
  });
  const palette = paletteAt(NIGHT);
  const light = lightAt(NIGHT);
  let textures: Textures | null = null;
  let pixi: PixiRenderer | null = null;
  let loading: Promise<void> | null = null;
  let startedAt = Number.NaN;
  let frameRequest = 0;

  function definitionOf(classId: string): PortraitClass {
    const found = definitions.get(classId);
    if (found === undefined) {
      throw new Error(`No class "${classId}" to portray`);
    }
    return found;
  }

  function load(): void {
    loading ??= autoDetectRenderer({
      preference: 'webgl',
      width: MAX_PIXELS,
      height: MAX_PIXELS,
      resolution: 1,
      antialias: true,
      backgroundAlpha: 0,
      preserveDrawingBuffer: true,
      skipExtensionImports: true,
    }).then((created) => {
      pixi = created;
      wake();
    });
  }

  function wake(): void {
    if (frameRequest === 0 && pixi !== null && [...views.values()].some((view) => view.visible)) {
      frameRequest = requestAnimationFrame(loop);
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
    const ratio = Math.min(window.devicePixelRatio, 2);
    const width = Math.min(MAX_PIXELS, Math.round(canvas.clientWidth * ratio));
    const height = Math.min(MAX_PIXELS, Math.round(canvas.clientHeight * ratio));
    const target = canvas.getContext('2d');
    if (width === 0 || height === 0 || target === null) {
      return;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
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
        : ((textures?.players.drawings.get(player.classId)?.get().middle ?? 0) * player.radius) /
          REFERENCE;
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
    load();
    if (textures === null) {
      textures = {
        ...createTextures(),
        players: paintedFiner(FINER, playerTextures),
        classFx: paintedFiner(FINER, createClassFxTextures),
      };
      checkDrawings(classes, textures.players.drawings);
    }
    const stage = new Container();
    const layers = createLayers(stage);
    const ctx: RenderContext = {
      textures,
      layers,
      options: { calmMode: false },
      classTokens: tokens,
      behaviours: new Map(),
      trapLooks: new Map(),
      specials: new Map(),
      helpTicks: new Map(),
      speakerLooks: new Map(),
      weaponLooks: new Map(),
      skillEffects,
    };
    const first = classes[0];
    if (first === undefined) {
      throw new Error('No class to portray');
    }
    const state = emptyState(standing(first), VIEW_UNITS);
    const frame = createFrame();
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
      visible: false,
    };
    views.set(canvas, view);
    watcher.observe(canvas);
    return portrait;
  };
}
