import { Container, type Sprite, type Texture } from 'pixi.js';
import { ticksToDrop } from '../sim/lineup';
import type { EnemyState, EntityId, SimEvent, SimState } from '../sim/state';
import { createBossDecor, createDim, destroyBossDecor, place, placeShadow } from './boss-decor';
import { createBossFarewells } from './boss-farewells';
import {
  type Drawn,
  Impact,
  WAVE_BEATS,
  bossCrackStage,
  breakDim,
  landing,
  lastSeen,
  stepLift,
  towardHitter,
} from './boss-moments';
import { FACE_RADIUS } from './face-kit';
import type { RenderContext } from './context';
import { Particles } from './effects';
import type { Frame } from './frame';
import { contactOf } from './hit-marks';
import type { Mask } from './textures-enemies';
import { type BossLook, createBossLook } from './textures-bosses';
import { add, byId, hide, setTint } from './util';
import { ViewPool } from './views';
import { mixColor } from './weapon-kit';

const WHITE = 0xffffff;
const TAU = Math.PI * 2;
const BREATH = 0.85;
const SQUASH_HEIGHT = 0.7;
const HIT_GAP_TICKS = 3;
const SPLINTERS = { normal: 4, calm: 2, crack: 7, calmCrack: 3 };
const SPLINTER_BEATS = 0.7;

type EnemyHit = Extract<SimEvent, { type: 'enemyHit' }>;

interface BossView {
  readonly shadow: Sprite;
  readonly band: Sprite;
  readonly crack: Sprite;
  readonly impact: Impact;
  stage: number;
  lastHit: number;
}

export interface BossStage {
  // Below the masks, and above them.
  readonly under: Container;
  readonly over: Container;
  // Starts a pass over the live bosses, which `update` ends.
  begin(): void;
  // Shadow, step, breath, squash and cracks of a live boss, around the mask the enemies family placed.
  dress(enemy: EnemyState, mask: Mask, sprite: Sprite, frame: Frame): void;
  // `radius` is the hit bad vibe's, as last drawn.
  onEvent(event: SimEvent, state: SimState, frame: Frame, radius: number | undefined): void;
  // A boss was chased: `drawn` is its mask as last drawn, absent if it never was.
  farewell(
    event: Extract<SimEvent, { type: 'enemyDied' }>,
    drawn: Drawn<Texture> | undefined,
    state: SimState,
    frame: Frame,
  ): void;
  update(state: SimState, frame: Frame): void;
  reset(): void;
  destroy(): void;
}

// What every boss shares, from its arrival to its farewell. The look of each boss is drawn from its
// mask the first time it shows up.
export function createBossStage(ctx: RenderContext): BossStage {
  const { textures, layers } = ctx;
  const decor = createBossDecor();
  const looks = new Map<string, BossLook>();
  const spawned = new Map<EntityId, number>();
  const under = new Container();
  const over = new Container();
  const splinters = new Particles(over, decor.splinter, 96);
  const waves = new Particles(layers.fx, decor.ring, 8);
  const farewells = createBossFarewells(ctx, decor);
  const dim = createDim(layers.dim);

  function lookOf(kind: string, mask: Mask): BossLook {
    let look = looks.get(kind);
    if (look === undefined) {
      look = createBossLook(mask.face);
      looks.set(kind, look);
    }
    return look;
  }

  // Drawing a look takes a few frames' time: the break draws them, one per frame, before a boss lands.
  function prepareOne(): void {
    for (const [kind, mask] of textures.masks.masks) {
      if (mask.face.boss && !looks.has(kind)) {
        lookOf(kind, mask);
        return;
      }
    }
  }

  const views = new ViewPool<BossView>(
    () => ({
      shadow: add(under, decor.shadow),
      band: add(under, decor.shadow),
      crack: add(over, decor.shadow),
      impact: new Impact(),
      stage: 0,
      lastHit: Number.NEGATIVE_INFINITY,
    }),
    (view) => {
      hide(view.shadow, view.band, view.crack);
      view.stage = 0;
      view.lastHit = Number.NEGATIVE_INFINITY;
    },
  );

  // Dark splinters with a pale edge, fanning out from `angle` and falling.
  function splinter(
    at: { x: number; y: number },
    angle: number,
    spread: number,
    reach: number,
    count: number,
    frame: Frame,
    seed: number,
  ): void {
    for (let index = 0; index < count; index += 1) {
      const turn = angle + (((seed * 0.618 + index * 0.37) % 1) - 0.5) * spread;
      const far = reach * (0.5 + ((seed + index * 7) % 5) * 0.25);
      splinters.spawn({
        now: frame.now,
        duration: SPLINTER_BEATS * frame.tempo.ticksPerBeat,
        x: at.x,
        y: at.y,
        dx: Math.cos(turn) * far,
        dy: Math.sin(turn) * far + reach * 0.5,
        fromRadius: 5 + (index % 3) * 1.5,
        toRadius: 3.5,
        tint: frame.palette.badVibeRim,
        peak: 1,
        rotation: turn,
        spin: (index % 2 === 0 ? 1 : -1) * 5,
      });
    }
  }

  // The wave of a landing: two rings from where it fell, one slow ring in calm mode.
  function land(x: number, y: number, size: number, frame: Frame, tick: number): void {
    const wave = { now: tick, x, y, tint: frame.palette.badVibeRim };
    const beat = WAVE_BEATS * frame.tempo.ticksPerBeat;
    if (frame.calm) {
      waves.spawn({ ...wave, duration: 2 * beat, fromRadius: size, toRadius: 4 * size, peak: 0.5 });
      return;
    }
    waves.spawn({ ...wave, duration: beat, fromRadius: 0.5 * size, toRadius: 5 * size, peak: 1 });
    waves.spawn({
      ...wave,
      duration: beat,
      fromRadius: 0.25 * size,
      toRadius: 3 * size,
      peak: 0.6,
    });
  }

  function hit(event: EnemyHit, state: SimState, frame: Frame, radius: number): void {
    const view = views.peek(event.id);
    if (view === undefined || state.tick - view.lastHit < HIT_GAP_TICKS) {
      return;
    }
    view.lastHit = state.tick;
    view.impact.hit(frame.now, frame.tempo);
    const angle = contactOf(event, radius)?.angle ?? towardHitter(event, state);
    const at = { x: event.x + Math.cos(angle) * radius, y: event.y + Math.sin(angle) * radius };
    const count = frame.calm ? SPLINTERS.calm : SPLINTERS.normal;
    splinter(at, angle, 2.2, radius * 0.63, count, frame, state.tick);
  }

  return {
    under,
    over,
    begin(): void {
      views.begin();
    },
    dress(enemy, mask, sprite, frame): void {
      const { palette, calm, tempo, now } = frame;
      const look = lookOf(enemy.kind, mask);
      const view = views.acquire(enemy.id);
      const { radius } = enemy;
      const since = now - (spawned.get(enemy.id) ?? Number.NEGATIVE_INFINITY);
      const arrival = landing(since, tempo, calm);
      const squash = view.impact.squashAmount(now, tempo, calm);
      const flare = view.impact.flare(now, tempo, calm);
      const base = (radius / mask.radius) * arrival.scale;
      const scaleX = base * (1 + squash);
      const scaleY = base * (1 - SQUASH_HEIGHT * squash);
      const { x, y: ground } = sprite.position;
      const y = ground - stepLift(now, tempo, calm) * radius;
      sprite.scale.set(scaleX, scaleY);
      sprite.position.set(x, y);
      sprite.alpha = arrival.alpha;
      setTint(sprite, mixColor(sprite.tint, WHITE, flare));
      placeShadow(view.shadow, decor, x, ground, radius, arrival.alpha);

      view.band.texture = look.band.texture;
      place(view.band, x, y, sprite.rotation, scaleX, scaleY);
      setTint(view.band, mixColor(palette.badVibeRim, WHITE, flare));
      view.band.alpha = arrival.alpha * Math.max(calm ? 0 : BREATH * frame.pulse, flare);

      const stage = bossCrackStage(enemy.hp, enemy.maxHp);
      if (stage > view.stage) {
        if (view.lastHit > Number.NEGATIVE_INFINITY) {
          view.impact.hit(now, tempo);
          const count = calm ? SPLINTERS.calmCrack : SPLINTERS.crack;
          splinter({ x, y }, 0, TAU, radius * 0.9, count, frame, enemy.id + stage);
        }
        view.stage = stage;
      }
      const shape = stage === 0 ? undefined : look.cracks[stage - 1];
      view.crack.visible = shape !== undefined;
      if (shape !== undefined) {
        view.crack.texture = shape.texture;
        place(view.crack, x, y, sprite.rotation, scaleX, scaleY);
        setTint(view.crack, palette.badVibeRim);
        view.crack.alpha = arrival.alpha;
      }
    },
    onEvent(event, state, frame, radius): void {
      if (event.type === 'enemySpawned' && ctx.behaviours.get(event.kind) === 'boss') {
        spawned.set(event.id, state.tick);
        land(event.x, event.y, byId(state.enemies, event.id)?.radius ?? 0, frame, state.tick);
      } else if (event.type === 'relicOffered') {
        farewells.dropRelics(state.tick);
      } else if (event.type === 'enemyHit' && radius !== undefined) {
        hit(event, state, frame, radius);
      }
    },
    farewell(event, drawn, state, frame): void {
      spawned.delete(event.id);
      const mask = textures.masks.masks.get(event.kind);
      if (mask === undefined) {
        return;
      }
      const still = mask.awake[0] ?? mask.asleep;
      const last = lastSeen(drawn, still, ctx.enemyRadii?.get(event.kind) ?? FACE_RADIUS);
      const killer = event.byPlayer === null ? undefined : byId(state.players, event.byPlayer);
      farewells.start({
        id: event.id,
        tick: state.tick,
        start: frame.show,
        x: event.x,
        y: event.y,
        radius: last.radius,
        scale: last.radius / mask.radius,
        tilt: last.tilt,
        texture: last.texture,
        look: lookOf(event.kind, mask),
        token: (killer && ctx.classTokens.get(killer.classId)) ?? 'or',
      });
    },
    update(state, frame): void {
      views.end();
      if (state.set.segment === 'break') {
        prepareOne();
      }
      const intoDrop =
        state.set.segment === 'drop' ? state.tick - state.set.segmentStartTick : null;
      const shade = breakDim(ticksToDrop(frame.set, state), intoDrop, frame.tempo, frame.calm);
      dim(shade, state.arena);
      farewells.update(state, frame);
      splinters.update(frame.now);
      waves.update(frame.now);
    },
    reset(): void {
      views.releaseAll();
      spawned.clear();
      splinters.clear();
      waves.clear();
      farewells.clear();
      dim(0, { width: 0, height: 0 });
    },
    destroy(): void {
      for (const look of looks.values()) {
        look.destroy();
      }
      looks.clear();
      destroyBossDecor(decor);
    },
  };
}
