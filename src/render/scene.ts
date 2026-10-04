import { Container, Graphics, Sprite, type Renderer as PixiRenderer } from 'pixi.js';
import type {
  ClassDefinition,
  EnemyBehaviour,
  EnemyDefinition,
  TrapDefinition,
  TrapEffect,
} from '../data/types';
import type {
  Arena,
  EntityId,
  PlayerState,
  SimEvent,
  SimState,
  TrapState,
  Vec2,
} from '../sim/state';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import { type Camera, frameCamera, screenToWorld } from './camera';
import { Particles } from './effects';
import { FlashLimiter, beatEnvelope, lerp } from './motion';
import { PALETTE, parseHexColor } from './palette';
import { trapReach } from './reach';
import {
  BEAM_LENGTH,
  STREAK_HEAD,
  TRAP_COLORS,
  type Shape,
  type Textures,
  createTextures,
  destroyTextures,
} from './textures';
import type { RenderOptions, Renderer } from './types';
import { ViewPool } from './views';

export interface RenderContent {
  readonly classes: readonly Pick<ClassDefinition, 'id' | 'color'>[];
  readonly enemies: readonly Pick<EnemyDefinition, 'id' | 'behaviour'>[];
  readonly traps: readonly Pick<TrapDefinition, 'id' | 'radius' | 'effect'>[];
}

type TrapLook = Pick<TrapDefinition, 'radius' | 'effect'>;

interface EnemyView {
  readonly sprite: Sprite;
  heading: number;
}

interface PlayerView {
  readonly halo: Sprite;
  readonly body: Sprite;
  readonly aim: Sprite;
}

interface TrapView {
  readonly halo: Sprite;
  readonly body: Sprite;
  readonly beam: Sprite;
  reach: number;
}

const TAU = Math.PI * 2;
const PICKUP_RADIUS = 6;
const BURST_COLORS = [PALETTE.uvMagenta, PALETTE.uvCyan, PALETTE.uvLime, PALETTE.sunOrange];
const CALM = { glowAlpha: 0.4, pulse: 0.3 };
const SHAKE = { pixels: 7, ticks: TICKS_PER_BEAT / 2 };
const FLASH_TICKS = TICKS_PER_BEAT / 2;
const FADE_TICKS = TICKS_PER_BEAT;
const RAY_TURN_TICKS = TICKS_PER_BAR * 4;
const BOSS_TURN_TICKS = TICKS_PER_BAR * 2;

function lookup<V>(map: ReadonlyMap<string, V>, key: string, what: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Unknown ${what} "${key}"`);
  }
  return value;
}

function byId<T extends { readonly id: number }>(items: readonly T[], id: number): T | undefined {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }
  }
  return undefined;
}

function ownerOf(players: readonly PlayerState[], trap: TrapState): PlayerState {
  const owner = byId(players, trap.ownerId);
  if (owner === undefined) {
    throw new Error(`Trap ${String(trap.id)} has no owner ${String(trap.ownerId)}`);
  }
  return owner;
}

function add(parent: Container, shape: Shape, anchorX = 0.5): Sprite {
  const sprite = new Sprite(shape.texture);
  sprite.anchor.set(anchorX, 0.5);
  parent.addChild(sprite);
  return sprite;
}

// Pixi parses the color, allocating, on every tint write, even an unchanged one.
function setTint(sprite: Sprite, color: number): void {
  if (sprite.tint !== color) {
    sprite.tint = color;
  }
}

function layer(parent: Container, blendMode: 'add' | 'normal' = 'normal'): Container {
  const container = new Container();
  container.blendMode = blendMode;
  parent.addChild(container);
  return container;
}

export class Scene implements Renderer {
  private readonly pixi: PixiRenderer;
  private readonly textures: Textures;
  private readonly classColors: ReadonlyMap<string, number>;
  private readonly behaviours: ReadonlyMap<string, EnemyBehaviour>;
  private readonly trapLooks: ReadonlyMap<string, TrapLook>;
  private options: RenderOptions;
  private camera: Camera;

  private readonly stage = new Container();
  private readonly world: Container;
  private readonly floor = new Graphics();
  private readonly glowLayer: Container;
  private readonly enemyLayer: Container;
  private readonly enemyShotLayer: Container;
  private readonly trapLayer: Container;
  private readonly coreLayer: Container;
  private readonly pickupLayer: Container;
  private readonly playerLayer: Container;
  private readonly fxLayer: Container;

  private readonly coreRays: readonly [Sprite, Sprite];
  private readonly coreHalo: Sprite;
  private readonly coreBody: Sprite;
  private readonly coreFlash: Sprite;

  private readonly enemies: ViewPool<EnemyView>;
  private readonly enemyShots: ViewPool<Sprite>;
  private readonly lightShots: ViewPool<Sprite>;
  private readonly pickups: ViewPool<Sprite>;
  private readonly traps: ViewPool<TrapView>;
  private readonly players: ViewPool<PlayerView>;
  private readonly shards: Particles;
  private readonly puffs: Particles;
  private readonly rings: Particles;

  private readonly flashLimiter = new FlashLimiter();
  private lastState: SimState | null = null;
  private lastTick = -1;
  private beatTick = Number.NEGATIVE_INFINITY;
  private flashTick = Number.NEGATIVE_INFINITY;
  private shakeTick = Number.NEGATIVE_INFINITY;
  private floorArena: Arena = { width: 0, height: 0 };
  private readonly focus = { x: 0, y: 0 };
  private readonly playerTints: number[] = [];

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
    this.classColors = new Map(content.classes.map((def) => [def.id, parseHexColor(def.color)]));
    this.behaviours = new Map(content.enemies.map((def) => [def.id, def.behaviour]));
    this.trapLooks = new Map(content.traps.map((def) => [def.id, def]));
    this.camera = frameCamera({ x: 0, y: 0 }, { width: 0, height: 0 }, width, height);

    const t = this.textures;
    this.world = layer(this.stage);
    this.world.addChild(this.floor);
    this.glowLayer = layer(this.world, 'add');
    this.enemyLayer = layer(this.world);
    this.enemyShotLayer = layer(this.world);
    this.trapLayer = layer(this.world);
    this.coreLayer = layer(this.world);
    this.pickupLayer = layer(this.world);
    this.fxLayer = layer(this.world, 'add');
    this.playerLayer = layer(this.world);

    this.coreRays = [add(this.glowLayer, t.coreRay, 0), add(this.glowLayer, t.coreRay, 0)];
    this.coreHalo = add(this.glowLayer, t.halo);
    this.coreBody = add(this.coreLayer, t.core);
    this.coreFlash = add(this.fxLayer, t.ring);
    this.coreFlash.visible = false;
    this.coreFlash.tint = PALETTE.sunOrange;
    for (const sprite of [...this.coreRays, this.coreHalo]) {
      sprite.tint = PALETTE.uvCyan;
    }

    this.traps = new ViewPool(
      () => ({
        halo: add(this.glowLayer, t.halo),
        body: add(this.trapLayer, t.traps.shockwave),
        beam: add(this.fxLayer, t.beam, 0),
        reach: 0,
      }),
      (view) => {
        view.halo.visible = view.body.visible = view.beam.visible = false;
      },
    );
    this.enemies = new ViewPool(
      () => ({ sprite: add(this.enemyLayer, t.enemies.horde), heading: 0 }),
      (view) => {
        view.sprite.visible = false;
      },
    );
    this.enemyShots = new ViewPool(
      () => add(this.enemyShotLayer, t.enemyShot),
      (sprite) => {
        sprite.visible = false;
      },
    );
    this.pickups = new ViewPool(
      () => add(this.pickupLayer, t.vibes),
      (sprite) => {
        sprite.visible = false;
      },
    );
    this.players = new ViewPool(
      () => ({
        halo: add(this.glowLayer, t.halo),
        body: add(this.playerLayer, t.player),
        aim: add(this.playerLayer, t.aim),
      }),
      (view) => {
        view.halo.visible = view.body.visible = view.aim.visible = false;
      },
    );
    this.lightShots = new ViewPool(
      () => add(this.fxLayer, t.streak, STREAK_HEAD),
      (sprite) => {
        sprite.visible = false;
      },
    );
    this.rings = new Particles(this.fxLayer, t.ring, 48);
    this.puffs = new Particles(this.fxLayer, t.halo, 96);
    this.shards = new Particles(this.fxLayer, t.shard, 900);

    this.applyOptions();
  }

  render(state: SimState, alpha: number): void {
    if (state !== this.lastState) {
      this.lastState = state;
      this.lastTick = -1;
      this.beatTick = this.flashTick = this.shakeTick = Number.NEGATIVE_INFINITY;
      for (const particles of [this.shards, this.puffs, this.rings]) {
        particles.clear();
      }
    }
    if (
      state.arena.width !== this.floorArena.width ||
      state.arena.height !== this.floorArena.height
    ) {
      this.drawFloor(state.arena);
    }
    if (state.tick !== this.lastTick) {
      this.lastTick = state.tick;
      for (const event of state.events) {
        this.onEvent(event, state);
      }
    }

    const now = state.tick + alpha;
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
    this.placeWorld(now);

    const pulse = beatEnvelope(now - this.beatTick) * (this.options.calmMode ? CALM.pulse : 1);
    this.drawCore(state, now, pulse);
    this.drawTraps(state, alpha, pulse);
    this.drawPickups(state, alpha, now);
    this.drawEnemies(state, alpha, now);
    this.drawProjectiles(state, alpha);
    this.drawPlayers(state, alpha, pulse);
    this.shards.update(now);
    this.puffs.update(now);
    this.rings.update(now);

    this.pixi.render(this.stage);
  }

  setOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
    this.applyOptions();
  }

  resize(width: number, height: number): void {
    this.pixi.resize(width, height);
    this.camera = { ...this.camera, screenWidth: width, screenHeight: height };
  }

  screenToWorld(point: Vec2): Vec2 {
    return screenToWorld(this.camera, point);
  }

  destroy(): void {
    this.stage.destroy({ children: true });
    destroyTextures(this.textures);
    this.pixi.destroy({ removeView: true, releaseGlobalResources: true });
  }

  private applyOptions(): void {
    this.glowLayer.alpha = this.options.calmMode ? CALM.glowAlpha : 1;
  }

  private onEvent(event: SimEvent, state: SimState): void {
    const tick = state.tick;
    switch (event.type) {
      case 'beat':
        this.beatTick = tick;
        break;
      case 'enemyDied':
        this.burst(
          event.x,
          event.y,
          event.id,
          lookup(this.behaviours, event.kind, 'enemy kind'),
          tick,
        );
        break;
      case 'coreHit':
        if (this.flashLimiter.tryStart(tick)) {
          this.flashTick = tick;
          this.shakeTick = tick;
        }
        break;
      case 'trapFired': {
        const { effect } = lookup(this.trapLooks, event.kind, 'trap kind');
        if (effect.kind === 'shockwave') {
          const reach = this.firedReach(state, event.id, effect);
          this.rings.spawn({
            now: tick,
            duration: TICKS_PER_BEAT / 2,
            x: event.x,
            y: event.y,
            fromRadius: reach * 0.2,
            toRadius: reach,
            tint: TRAP_COLORS.shockwave,
            peak: this.options.calmMode ? 0.5 : 0.9,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  private firedReach(state: SimState, trapId: EntityId, effect: TrapEffect): number {
    const trap = byId(state.traps, trapId);
    if (trap !== undefined) {
      return trapReach(effect, ownerOf(state.players, trap));
    }
    // A trap broken in the tick it fired has already left the state: keep the reach it was drawn with.
    return this.traps.peek(trapId)?.reach ?? trapReach(effect, { modifiers: {} });
  }

  private burst(x: number, y: number, id: number, behaviour: EnemyBehaviour, tick: number): void {
    const boss = behaviour === 'boss';
    const count = boss ? 28 : 10;
    const reach = boss ? 140 : 42;
    const offset = (id * 0.618) % 1;
    for (let index = 0; index < count; index += 1) {
      const angle = ((index + offset) / count) * TAU;
      const distance = reach * (0.6 + 0.4 * ((index * 7) % 5) * 0.25);
      this.shards.spawn({
        now: tick,
        duration: TICKS_PER_BEAT,
        x,
        y,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        fromRadius: boss ? 9 : 5,
        toRadius: boss ? 6 : 3,
        tint: BURST_COLORS[(index + id) % BURST_COLORS.length] ?? PALETTE.glow,
        peak: 1,
        spin: angle + Math.PI,
      });
    }
    if (!this.options.calmMode) {
      this.puffs.spawn({
        now: tick,
        duration: TICKS_PER_BEAT / 2,
        x,
        y,
        fromRadius: boss ? 60 : 16,
        toRadius: boss ? 160 : 40,
        tint: BURST_COLORS[id % BURST_COLORS.length] ?? PALETTE.glow,
        peak: 0.8,
      });
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
    this.world.scale.set(scale);
    this.world.position.set(
      screenWidth / 2 - centerX * scale + shakeX,
      screenHeight / 2 - centerY * scale + shakeY,
    );
  }

  private drawFloor(arena: Arena): void {
    this.floorArena = { width: arena.width, height: arena.height };
    const { width, height } = arena;
    const g = this.floor.clear();
    g.rect(0, 0, width, height).fill({ color: PALETTE.ink, alpha: 0.45 });

    const cell = 80;
    for (let x = cell; x < width; x += cell) {
      g.moveTo(x, 0).lineTo(x, height);
    }
    for (let y = cell; y < height; y += cell) {
      g.moveTo(0, y).lineTo(width, y);
    }
    g.stroke({ width: 1, color: PALETTE.uvMagenta, alpha: 0.06 });

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.34;
    for (let ring = 1; ring <= 4; ring += 1) {
      g.circle(cx, cy, (radius * ring) / 4);
    }
    g.stroke({ width: 2, color: PALETTE.uvCyan, alpha: 0.07 });
    for (let petal = 0; petal < 12; petal += 1) {
      const angle = (petal / 12) * TAU;
      g.circle(
        cx + Math.cos(angle) * radius * 0.5,
        cy + Math.sin(angle) * radius * 0.5,
        radius * 0.5,
      );
    }
    g.stroke({ width: 1.5, color: PALETTE.uvMagenta, alpha: 0.08 });

    g.rect(0, 0, width, height).stroke({ width: 14, color: PALETTE.uvCyan, alpha: 0.08 });
    g.rect(0, 0, width, height).stroke({ width: 3, color: PALETTE.uvCyan, alpha: 0.6 });
  }

  private drawCore(state: SimState, now: number, pulse: number): void {
    const { core } = state;
    const t = this.textures;
    this.coreBody.position.set(core.x, core.y);
    this.coreBody.scale.set((core.radius / t.core.radius) * (1 + 0.05 * pulse));

    this.coreHalo.position.set(core.x, core.y);
    this.coreHalo.scale.set(((core.radius * 3.4) / t.halo.radius) * (1 + 0.3 * pulse));
    this.coreHalo.alpha = 0.55 + 0.45 * pulse;

    let turn = this.options.calmMode ? Math.PI / 4 : (now / RAY_TURN_TICKS) * TAU;
    for (const ray of this.coreRays) {
      ray.position.set(core.x, core.y);
      ray.rotation = turn;
      ray.scale.set((core.radius * 9) / 256, (core.radius * 1.6) / 32);
      ray.alpha = 0.25 + 0.35 * pulse;
      turn += Math.PI;
    }

    const since = now - this.flashTick;
    const calm = this.options.calmMode;
    const span = calm ? FADE_TICKS : FLASH_TICKS;
    const progress = since / span;
    this.coreFlash.visible = progress >= 0 && progress < 1;
    if (this.coreFlash.visible) {
      this.coreFlash.position.set(core.x, core.y);
      const reach = calm ? 1.15 : 1.05 + 0.75 * (1 - (1 - progress) * (1 - progress));
      this.coreFlash.scale.set((core.radius * reach) / t.ring.radius);
      this.coreFlash.alpha = calm
        ? 0.6 * Math.sin(progress * Math.PI)
        : (1 - progress) * (1 - progress);
    }
  }

  private drawTraps(state: SimState, alpha: number, pulse: number): void {
    const t = this.textures;
    this.traps.begin();
    for (const trap of state.traps) {
      const look = lookup(this.trapLooks, trap.kind, 'trap kind');
      const view = this.traps.acquire(trap.id);
      const x = lerp(trap.prevX, trap.x, alpha);
      const y = lerp(trap.prevY, trap.y, alpha);
      const kind = look.effect.kind;
      const shape = t.traps[kind];
      view.body.texture = shape.texture;
      view.body.visible = true;
      view.body.position.set(x, y);
      view.body.scale.set(look.radius / shape.radius);
      const facing = Math.atan2(trap.direction.y, trap.direction.x);
      view.body.rotation = kind === 'beam' ? facing : 0;

      view.halo.visible = true;
      setTint(view.halo, TRAP_COLORS[kind]);
      view.halo.position.set(x, y);
      view.halo.scale.set((look.radius * 3) / t.halo.radius);
      view.halo.alpha = 0.6 + 0.4 * pulse;

      view.reach = trapReach(look.effect, ownerOf(state.players, trap));
      view.beam.visible = look.effect.kind === 'beam';
      if (look.effect.kind === 'beam') {
        view.beam.position.set(x, y);
        view.beam.rotation = facing;
        view.beam.scale.set(
          view.reach / BEAM_LENGTH,
          (look.effect.width * 3) / (t.beam.radius * 2),
        );
        view.beam.alpha = this.options.calmMode ? 0.7 : 0.75 + 0.25 * pulse;
      }
    }
    this.traps.end();
  }

  private drawPickups(state: SimState, alpha: number, now: number): void {
    const t = this.textures;
    const calm = this.options.calmMode;
    this.pickups.begin();
    for (const pickup of state.pickups) {
      const sprite = this.pickups.acquire(pickup.id);
      const x = lerp(pickup.prevX, pickup.x, alpha);
      const y = lerp(pickup.prevY, pickup.y, alpha);
      const shape = pickup.kind === 'vibes' ? t.vibes : t.watts;
      const twinkle = calm ? 1 : 1 + 0.2 * Math.sin(now * 0.45 + pickup.id);
      sprite.texture = shape.texture;
      setTint(sprite, pickup.kind === 'vibes' ? PALETTE.uvLime : PALETTE.uvCyan);
      sprite.visible = true;
      sprite.position.set(x, y);
      sprite.scale.set((PICKUP_RADIUS / shape.radius) * twinkle);
      sprite.rotation = calm || pickup.kind === 'watts' ? 0 : now * 0.03 + pickup.id;
    }
    this.pickups.end();
  }

  private drawEnemies(state: SimState, alpha: number, now: number): void {
    const t = this.textures;
    const bossTurn = this.options.calmMode ? 0 : (now / BOSS_TURN_TICKS) * TAU;
    this.enemies.begin();
    for (const enemy of state.enemies) {
      const behaviour = enemy.isBoss ? 'boss' : lookup(this.behaviours, enemy.kind, 'enemy kind');
      const shape = t.enemies[behaviour];
      const view = this.enemies.acquire(enemy.id);
      const dx = enemy.x - enemy.prevX;
      const dy = enemy.y - enemy.prevY;
      if (dx !== 0 || dy !== 0) {
        view.heading = Math.atan2(dy, dx);
      }
      const { sprite } = view;
      const x = lerp(enemy.prevX, enemy.x, alpha);
      const y = lerp(enemy.prevY, enemy.y, alpha);
      sprite.texture = shape.texture;
      sprite.visible = true;
      sprite.position.set(x, y);
      sprite.scale.set(enemy.radius / shape.radius);
      sprite.rotation = behaviour === 'rusher' ? view.heading : behaviour === 'boss' ? bossTurn : 0;
    }
    this.enemies.end();
  }

  private drawProjectiles(state: SimState, alpha: number): void {
    const t = this.textures;
    const tints = this.playerTints;
    tints.fill(PALETTE.glow);
    for (const player of state.players) {
      tints[player.id] = lookup(this.classColors, player.classId, 'class');
    }
    this.enemyShots.begin();
    this.lightShots.begin();
    for (const projectile of state.projectiles) {
      const { owner } = projectile;
      const dark = owner.kind === 'enemy';
      const sprite = dark
        ? this.enemyShots.acquire(projectile.id)
        : this.lightShots.acquire(projectile.id);
      const shape = dark ? t.enemyShot : t.streak;
      const x = lerp(projectile.prevX, projectile.x, alpha);
      const y = lerp(projectile.prevY, projectile.y, alpha);
      sprite.visible = true;
      sprite.position.set(x, y);
      sprite.rotation = Math.atan2(projectile.vy, projectile.vx);
      const size = projectile.radius / shape.radius;
      sprite.scale.set(size, dark ? size : size * 0.6);
      if (!dark) {
        setTint(
          sprite,
          owner.kind === 'player' ? (tints[owner.playerId] ?? PALETTE.glow) : PALETTE.glow,
        );
      }
    }
    this.enemyShots.end();
    this.lightShots.end();
  }

  private drawPlayers(state: SimState, alpha: number, pulse: number): void {
    const t = this.textures;
    this.players.begin();
    for (const player of state.players) {
      const view = this.players.acquire(player.id);
      const color = lookup(this.classColors, player.classId, 'class');
      const x = lerp(player.prevX, player.x, alpha);
      const y = lerp(player.prevY, player.y, alpha);
      const { body, halo, aim } = view;
      body.visible = true;
      body.texture = player.downed ? t.playerDowned.texture : t.player.texture;
      setTint(body, color);
      body.position.set(x, y);
      body.scale.set(player.radius / t.player.radius);
      body.alpha = player.downed ? 0.6 + 0.4 * pulse : 1;

      halo.visible = !player.downed;
      setTint(halo, color);
      halo.position.set(x, y);
      halo.scale.set(((player.radius * 3.2) / t.halo.radius) * (1 + 0.1 * pulse));

      aim.visible = !player.downed;
      setTint(aim, color);
      const reach = player.radius + 10;
      aim.position.set(x + player.aim.x * reach, y + player.aim.y * reach);
      aim.rotation = Math.atan2(player.aim.y, player.aim.x);
      aim.scale.set(player.radius / 24);
    }
    this.players.end();
  }
}
