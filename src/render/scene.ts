import { Container, type Renderer as PixiRenderer, type RenderTexture } from 'pixi.js';
import type { SetDefinition } from '../data/types';
import { SUN_PALETTES } from '../shared/palette';
import { lerp } from '../shared/scalar';
import type { Arena, SimEvent, SimState, Vec2 } from '../sim/state';
import { TICKS_PER_BEAT } from '../shared/tempo';
import {
  type Bounds,
  type Camera,
  centerInArena,
  easeCamera,
  frameBounds,
  frameCamera,
  isSettled,
  screenToWorld,
} from './camera';
import { ShowClock, isBossLanding } from './boss-moments';
import { type Family, type RenderContent, createRenderContext } from './context';
import { createFamilies } from './families';
import { createDropTrails } from './drop-trails';
import { type InsetScene, type Insets, createInsets } from './insets';
import { type Frame, advanceFrame, createFrame } from './frame';
import { type Layers, applyLight, createLayers } from './layers';
import { checkDrawings } from './drawings';
import { FlashLimiter, beatEnvelope } from './motion';
import { createTextures, destroyTextures } from './textures';
import type { CameraFocus, Inset, RenderOptions, Renderer } from './types';
import { byId, lookup } from './util';

export type { RenderContent } from './context';

const CALM = { glowAlpha: 0.4, pulse: 0.3 };
const SHAKE = { pixels: 7, ticks: TICKS_PER_BEAT / 2 };
const SOLO_FOCUS: CameraFocus = { kind: 'player', playerId: 0 };
const SNAP_TICKS = 4 * TICKS_PER_BEAT;
const INSET_GROUND = SUN_PALETTES.nuit.sol;

export class Scene implements Renderer, InsetScene {
  private readonly pixi: PixiRenderer;
  private readonly textures: ReturnType<typeof createTextures>;
  private readonly borrowed: boolean;
  private readonly insets: Insets;
  private readonly sets: ReadonlyMap<string, SetDefinition>;
  private readonly options: RenderOptions;
  private camera: Camera;
  private viewHeight: number | undefined;

  private readonly stage = new Container();
  private readonly layers: Layers;
  private readonly frame: Frame = createFrame();
  private readonly families: readonly Family[];
  private readonly dropTrails: ReturnType<typeof createDropTrails>;

  private lastState: SimState | null = null;
  private lastStage = '';
  private lastTick = -1;
  private readonly flashLimiter = new FlashLimiter();
  private readonly showClock = new ShowClock();
  private beatTick = Number.NEGATIVE_INFINITY;
  private shakeTick = Number.NEGATIVE_INFINITY;
  private readonly focus = { x: 0, y: 0 };
  private readonly view = { x: 0, y: 0 };
  private readonly bounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private focusKey = '';
  private settling = false;
  private cameraNow = Number.NaN;

  constructor(
    pixi: PixiRenderer,
    options: RenderOptions,
    content: RenderContent,
    width: number,
    height: number,
    textures?: ReturnType<typeof createTextures>,
  ) {
    this.pixi = pixi;
    this.options = { ...options };
    this.borrowed = textures !== undefined;
    this.textures = textures ?? createTextures();
    this.insets = createInsets(
      pixi,
      (inWidth, inHeight) =>
        new Scene(pixi, this.options, content, inWidth, inHeight, this.textures),
    );
    checkDrawings(content.classes, this.textures.players.drawings);
    this.sets = new Map([...content.sets, ...(content.paths ?? [])].map((set) => [set.id, set]));
    this.camera = frameCamera({ x: 0, y: 0 }, { width: 0, height: 0 }, width, height);
    this.layers = createLayers(this.stage);
    this.frame.resolution = pixi.resolution;
    this.dropTrails = createDropTrails(pixi, this.layers);

    const ctx = createRenderContext(this.textures, this.layers, this.options, content);
    this.families = createFamilies(ctx, this.borrowed);
  }

  render(state: SimState, alpha: number, still = false): void {
    if (!still) {
      this.insets.release();
      this.draw(state, alpha, null);
    } else if (this.insets.painting) {
      this.insets.holdStill((target) => {
        this.draw(state, alpha, target);
      });
    }
  }

  renderInto(state: SimState, alpha: number, target: RenderTexture): void {
    this.draw(state, alpha, target);
  }

  private draw(state: SimState, alpha: number, target: RenderTexture | null): void {
    const stage = `${state.setId}@${String(state.set.startTick ?? 0)}`;
    if (state !== this.lastState || stage !== this.lastStage) {
      this.lastState = state;
      this.lastStage = stage;
      this.lastTick = -1;
      this.beatTick = this.shakeTick = this.frame.flashTick = Number.NEGATIVE_INFINITY;
      this.cameraNow = Number.NaN;
      this.showClock.reset();
      for (const family of this.families) {
        family.reset?.();
      }
    }
    const { frame, layers } = this;
    const toward = state.festival?.taken?.setId;
    advanceFrame(
      frame,
      lookup(this.sets, state.setId, 'set'),
      state,
      alpha,
      toward === undefined ? undefined : lookup(this.sets, toward, 'set'),
    );
    frame.show = this.showClock.read(frame.now, state.status === 'running', performance.now());
    frame.calm = this.options.calmMode;
    applyLight(layers, frame);
    layers.glow.alpha = frame.calm ? CALM.glowAlpha : 1;
    if (target === null) {
      this.pixi.background.color = frame.palette.sol;
    }

    if (state.tick !== this.lastTick) {
      this.lastTick = state.tick;
      for (const event of state.events) {
        this.onEvent(event, state);
      }
    }
    frame.pulse =
      beatEnvelope(frame.now - this.beatTick, frame.tempo) * (frame.calm ? CALM.pulse : 1);

    this.frameWorld(state, alpha);
    frame.camera = this.camera;
    this.placeWorld(frame.now, state.arena);

    for (const family of this.families) {
      family.update(state, alpha, frame);
    }
    this.dropTrails.update(frame, this.camera.screenWidth, this.camera.screenHeight);
    if (target !== null) {
      this.pixi.render({
        container: this.stage,
        target,
        clear: true,
        clearColor: this.borrowed ? INSET_GROUND : frame.palette.sol,
      });
      return;
    }
    if (this.insets.painting) {
      this.insets.paint();
    }
    this.pixi.render(this.stage);
  }

  setInsets(insets: readonly Inset[]): void {
    this.insets.set(insets);
  }

  frameInset(width: number, height: number, viewHeight: number): void {
    this.viewHeight = viewHeight;
    this.camera = { ...this.camera, screenWidth: width, screenHeight: height };
  }

  setOptions(options: Partial<RenderOptions>): void {
    Object.assign(this.options, options);
    this.insets.setOptions(options);
  }

  resize(width: number, height: number): void {
    this.insets.release();
    this.pixi.resize(width, height);
    this.camera = { ...this.camera, screenWidth: width, screenHeight: height };
  }

  screenToWorld(point: Vec2): Vec2 {
    return screenToWorld(this.camera, point);
  }

  destroy(): void {
    this.insets.destroy();
    for (const family of this.families) {
      family.destroy();
    }
    this.dropTrails.destroy();
    this.stage.destroy({ children: true });
    if (!this.borrowed) {
      destroyTextures(this.textures);
      this.pixi.destroy({ removeView: true, releaseGlobalResources: true });
    }
  }

  private frameWorld(state: SimState, alpha: number): void {
    const { now } = this.frame;
    const focus = this.borrowed ? SOLO_FOCUS : (this.options.focus ?? SOLO_FOCUS);
    const key = focus.kind === 'everyone' ? 'everyone' : `player ${String(focus.playerId)}`;
    const target = this.targetCamera(state, alpha, focus);
    const elapsed = now - this.cameraNow;
    this.cameraNow = now;
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > SNAP_TICKS) {
      this.settling = false;
      this.camera = target;
    } else {
      if (key !== this.focusKey && this.focusKey !== '') {
        this.settling = true;
      }
      if (focus.kind === 'everyone' || this.settling) {
        this.camera = easeCamera(this.camera, target, elapsed);
        this.settling = this.settling && !isSettled(this.camera, target);
      } else {
        this.camera = target;
      }
    }
    this.focusKey = key;
  }

  private targetCamera(state: SimState, alpha: number, focus: CameraFocus): Camera {
    const { focus: point, bounds } = this;
    const { screenWidth, screenHeight } = this.camera;
    if (focus.kind === 'everyone' && state.players.length > 0) {
      bounds.minX = bounds.minY = Number.POSITIVE_INFINITY;
      bounds.maxX = bounds.maxY = Number.NEGATIVE_INFINITY;
      for (const player of state.players) {
        const x = lerp(player.prevX, player.x, alpha);
        const y = lerp(player.prevY, player.y, alpha);
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxY = Math.max(bounds.maxY, y);
      }
      return frameBounds(bounds, state.arena, screenWidth, screenHeight);
    }
    const followed = focus.kind === 'player' ? byId(state.players, focus.playerId) : undefined;
    point.x = followed === undefined ? state.core.x : lerp(followed.prevX, followed.x, alpha);
    point.y = followed === undefined ? state.core.y : lerp(followed.prevY, followed.y, alpha);
    return frameCamera(point, state.arena, screenWidth, screenHeight, this.viewHeight);
  }

  private onEvent(event: SimEvent, state: SimState): void {
    const { tick } = state;
    if (event.type === 'beat') {
      this.beatTick = tick;
    } else if (event.type === 'bombExploded' || isBossLanding(event, state)) {
      this.shakeTick = tick;
    } else if (event.type === 'coreHit' && this.flashLimiter.tryStart(tick)) {
      this.frame.flashTick = this.shakeTick = tick;
    }
    for (const family of this.families) {
      family.onEvent?.(event, state, this.frame);
    }
  }

  private placeWorld(now: number, arena: Arena): void {
    const { camera, view } = this;
    const { scale, screenWidth, screenHeight } = camera;
    let shakeX = 0;
    let shakeY = 0;
    const shake = (now - this.shakeTick) / SHAKE.ticks;
    if (!this.options.calmMode && shake >= 0 && shake < 1) {
      const strength = SHAKE.pixels * (1 - shake) * (1 - shake);
      shakeX = Math.sin(now * 12.9) * strength;
      shakeY = Math.cos(now * 9.7) * strength;
    }
    centerInArena(
      camera,
      arena,
      camera.centerX - shakeX / scale,
      camera.centerY - shakeY / scale,
      view,
    );
    const { world } = this.layers;
    world.scale.set(scale);
    world.position.set(screenWidth / 2 - view.x * scale, screenHeight / 2 - view.y * scale);
  }
}
