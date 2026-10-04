import { Container, type Renderer as PixiRenderer } from 'pixi.js';
import type { SetDefinition, SpecialEffect } from '../data/types';
import type { PaletteToken } from '../shared/palette';
import type { SimEvent, SimState, Vec2 } from '../sim/state';
import { TICKS_PER_BEAT } from '../shared/tempo';
import { type Camera, frameCamera, screenToWorld } from './camera';
import { createBystanders } from './bystanders';
import type { Family, RenderContent, RenderContext } from './context';
import { createCore } from './core';
import { createEffects } from './effects';
import { createEnemies } from './enemies';
import { type Frame, advanceFrame, createFrame } from './frame';
import { createGround } from './ground';
import { type Layers, applyLight, createLayers } from './layers';
import { FlashLimiter, beatEnvelope, lerp } from './motion';
import { isPaletteToken } from './palette';
import { createPickups } from './pickups';
import { createPlayers } from './players';
import { createProjectiles } from './projectiles';
import { createSpecials } from './specials';
import { createSpeakers } from './speakers';
import { createTextures, destroyTextures } from './textures';
import { createTraps } from './traps';
import type { RenderOptions, Renderer } from './types';
import { byId, lookup } from './util';
import { createWeapons } from './weapons';

export type { RenderContent } from './context';

const CALM = { glowAlpha: 0.4, pulse: 0.3 };
const SHAKE = { pixels: 7, ticks: TICKS_PER_BEAT / 2 };

function classTokens(content: RenderContent): RenderContext['classTokens'] {
  return new Map(
    content.classes.map(({ id }): [string, PaletteToken] => {
      if (!isPaletteToken(id)) {
        throw new Error(`Class "${id}" has no palette token of the same name`);
      }
      return [id, id];
    }),
  );
}

export class Scene implements Renderer {
  private readonly pixi: PixiRenderer;
  private readonly textures: ReturnType<typeof createTextures>;
  private readonly sets: ReadonlyMap<string, SetDefinition>;
  private readonly options: RenderOptions;
  private camera: Camera;

  private readonly stage = new Container();
  private readonly layers: Layers;
  private readonly frame: Frame = createFrame();
  private readonly families: readonly Family[];

  private lastState: SimState | null = null;
  private lastTick = -1;
  private readonly flashLimiter = new FlashLimiter();
  private beatTick = Number.NEGATIVE_INFINITY;
  private shakeTick = Number.NEGATIVE_INFINITY;
  private readonly focus = { x: 0, y: 0 };

  constructor(
    pixi: PixiRenderer,
    options: RenderOptions,
    content: RenderContent,
    width: number,
    height: number,
  ) {
    this.pixi = pixi;
    this.options = { ...options };
    this.textures = createTextures();
    this.sets = new Map(content.sets.map((set) => [set.id, set]));
    this.camera = frameCamera({ x: 0, y: 0 }, { width: 0, height: 0 }, width, height);
    this.layers = createLayers(this.stage);

    const ctx: RenderContext = {
      textures: this.textures,
      layers: this.layers,
      options: this.options,
      classTokens: classTokens(content),
      behaviours: new Map(content.enemies.map((def) => [def.id, def.behaviour])),
      trapLooks: new Map(content.traps.map((def) => [def.id, def])),
      specials: new Map(
        content.enemies.flatMap((def): [string, SpecialEffect][] =>
          def.special === undefined ? [] : [[def.id, def.special]],
        ),
      ),
      helpTicks: new Map((content.bystanders ?? []).map((def) => [def.id, def.helpTicks])),
      speakerLooks: new Map(
        content.sets.map((set) => [
          set.id,
          new Map((set.speakers ?? []).map((def) => [def.id, def])),
        ]),
      ),
      weaponLooks: new Map((content.weapons ?? []).map((def) => [def.id, def])),
    };
    const traps = createTraps(ctx);
    this.families = [
      createGround(ctx),
      createSpeakers(ctx),
      createCore(ctx),
      traps,
      createPickups(ctx),
      createBystanders(ctx),
      createEnemies(ctx),
      createSpecials(ctx),
      createProjectiles(ctx),
      createWeapons(ctx),
      createPlayers(ctx),
      createEffects(ctx, (id) => traps.reachOf(id)),
    ];
  }

  render(state: SimState, alpha: number): void {
    if (state !== this.lastState) {
      this.lastState = state;
      this.lastTick = -1;
      this.beatTick = this.shakeTick = this.frame.flashTick = Number.NEGATIVE_INFINITY;
      for (const family of this.families) {
        family.reset?.();
      }
    }
    const { frame, layers } = this;
    advanceFrame(frame, lookup(this.sets, state.setId, 'set'), state, alpha);
    frame.calm = this.options.calmMode;
    applyLight(layers, frame);
    layers.glow.alpha = frame.calm ? CALM.glowAlpha : 1;
    this.pixi.background.color = frame.palette.sol;

    if (state.tick !== this.lastTick) {
      this.lastTick = state.tick;
      for (const event of state.events) {
        this.onEvent(event, state);
      }
    }
    frame.pulse = beatEnvelope(frame.now - this.beatTick) * (frame.calm ? CALM.pulse : 1);

    const focusPlayer = byId(state.players, 0);
    const { focus } = this;
    focus.x =
      focusPlayer === undefined ? state.core.x : lerp(focusPlayer.prevX, focusPlayer.x, alpha);
    focus.y =
      focusPlayer === undefined ? state.core.y : lerp(focusPlayer.prevY, focusPlayer.y, alpha);
    this.camera = frameCamera(
      focus,
      state.arena,
      this.camera.screenWidth,
      this.camera.screenHeight,
    );
    this.placeWorld(frame.now);

    for (const family of this.families) {
      family.update(state, alpha, frame);
    }
    this.pixi.render(this.stage);
  }

  setOptions(options: Partial<RenderOptions>): void {
    Object.assign(this.options, options);
  }

  resize(width: number, height: number): void {
    this.pixi.resize(width, height);
    this.camera = { ...this.camera, screenWidth: width, screenHeight: height };
  }

  screenToWorld(point: Vec2): Vec2 {
    return screenToWorld(this.camera, point);
  }

  destroy(): void {
    for (const family of this.families) {
      family.destroy();
    }
    this.stage.destroy({ children: true });
    destroyTextures(this.textures);
    this.pixi.destroy({ removeView: true, releaseGlobalResources: true });
  }

  private onEvent(event: SimEvent, state: SimState): void {
    const { tick } = state;
    if (event.type === 'beat') {
      this.beatTick = tick;
    } else if (event.type === 'coreHit' && this.flashLimiter.tryStart(tick)) {
      this.frame.flashTick = tick;
      this.shakeTick = tick;
    }
    for (const family of this.families) {
      family.onEvent?.(event, state, this.frame);
    }
  }

  private placeWorld(now: number): void {
    const { centerX, centerY, scale, screenWidth, screenHeight } = this.camera;
    let shakeX = 0;
    let shakeY = 0;
    const shake = (now - this.shakeTick) / SHAKE.ticks;
    if (!this.options.calmMode && shake >= 0 && shake < 1) {
      const strength = SHAKE.pixels * (1 - shake) * (1 - shake);
      shakeX = Math.sin(now * 12.9) * strength;
      shakeY = Math.cos(now * 9.7) * strength;
    }
    const { world } = this.layers;
    world.scale.set(scale);
    world.position.set(
      screenWidth / 2 - centerX * scale + shakeX,
      screenHeight / 2 - centerY * scale + shakeY,
    );
  }
}
