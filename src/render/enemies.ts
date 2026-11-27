import { Container, Sprite } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { EntityId, SimEvent, SimState } from '../sim/state';
import { createBossStage } from './bosses';
import type { Family, RenderContext } from './context';
import { Farewells, type FarewellHooks } from './enemy-deaths';
import { createBurst } from './enemy-burst';
import { createDreams } from './enemy-dreams';
import { type Swimmer, createSwim, dryLand, paintWake } from './enemy-swim';
import { type Face, picker, warnUnknown } from './faces';
import { frontGlintOf, glintAlpha, glintStart, placeGlint } from './front-glint';
import { type Frame, createFrame } from './frame';
import { blinkLit } from './motion';
import { type PixiPalette, mixColor } from './palette';
import { Tosses } from './tossed';
import { add, byId, hide, keepIn, setTint } from './util';
import { ViewPool } from './views';

const LEAN = 0.5;
const BOSS_LEAN = 0.12;
const POP = 0.18;
const FLAT = 0.6;
const BEAT_SWELL = 0.05;
const DOWN_GRAY = 0xd0d0d8;
const DOWN_MIX = 0.55;
const BLINK_MIX = { normal: 0.65, calm: 0.35 };
const GLINT_SIZE = 1.2;
const GUARD_GRAY = 0.4;
const UNTINTED = 0xffffff;

export interface EnemyPose {
  readonly x: number;
  readonly y: number;
  readonly tilt: number;
  readonly radius: number;
  readonly boss: boolean;
  readonly sprite: Sprite;
  // Below the centre, where the lake cuts a swimming bad vibe; null on land.
  readonly waterline: number | null;
}

interface EnemyView {
  readonly sprite: Sprite;
  zs: Sprite[] | null;
  heading: number;
  x: number;
  y: number;
  tilt: number;
  radius: number;
  holdUntil: number;
  boss: boolean;
  blinkUntil: number;
  glint: Sprite | null;
  glintStart: number;
  readonly swimmer: Swimmer;
  waterline: number | null;
}

export type PoseOf = (id: EntityId) => EnemyPose | undefined;

export interface EnemiesFamily extends Family {
  blink(id: number, untilTick: number): void;
  hold(id: number, untilTick: number): void;
  poseOf(id: number): EnemyPose | undefined;
  burst(x: number, y: number, id: number, frame: Frame): void;
}

export function createEnemies(ctx: RenderContext): EnemiesFamily {
  const { textures, layers } = ctx;
  const { masks } = textures;
  const maskOf = picker(masks.masks, masks.neutral, warnUnknown);

  const bosses = createBossStage(ctx);
  const bodies = new Container();
  const guards = new Container();
  const smiles = new Container();
  const sleepers = new Container();
  const tosses = new Tosses(layers.enemies, textures.halo);
  const wake = paintWake();
  const swim = createSwim({ ring: textures.ring, wake });
  layers.enemies.addChild(bosses.under, swim.under, bodies, swim.over);
  layers.enemies.addChild(bosses.over, guards, smiles, sleepers);
  const dreams = createDreams(sleepers, masks.drowsy);

  const views = new ViewPool<EnemyView>(
    () => ({
      sprite: add(bodies, masks.smile),
      zs: null,
      heading: Math.PI / 2,
      x: 0,
      y: 0,
      tilt: 0,
      radius: 1,
      holdUntil: Number.NEGATIVE_INFINITY,
      boss: false,
      blinkUntil: Number.NEGATIVE_INFINITY,
      glint: null,
      glintStart: Number.NEGATIVE_INFINITY,
      swimmer: dryLand(),
      waterline: null,
    }),
    (view) => {
      swim.forget(view.swimmer);
      view.blinkUntil = view.glintStart = view.holdUntil = Number.NEGATIVE_INFINITY;
      hide(view.sprite, ...(view.zs ?? []));
      if (view.glint !== null) {
        view.glint.visible = false;
      }
    },
  );
  const farewells = new Farewells<Sprite>(128, () => {
    const sprite = add(smiles, textures.masks.smile);
    sprite.visible = false;
    return sprite;
  });
  const colors = createBurst(layers, textures);

  function guard(view: EnemyView, x: number, y: number, strength: number, tint: number): void {
    const glint = (view.glint ??= add(guards, textures.guard));
    glint.visible = true;
    setTint(glint, tint);
    placeGlint(glint, x, y, view.heading, view.radius);
    const size = (view.radius * GLINT_SIZE) / textures.guard.radius;
    glint.scale.set(size);
    glint.alpha = strength;
  }

  function tintOf(palette: PixiPalette, { lit, tone }: Face): number {
    if (lit === true) {
      return UNTINTED;
    }
    return tone === undefined
      ? palette.badVibeRim
      : mixColor(palette.badVibeRim, palette[tone.token], tone.amount);
  }

  let latest: Frame = createFrame();
  const hooks: FarewellHooks<Sprite> = {
    show(farewell, smile, fade) {
      const sprite = farewell.view;
      sprite.texture = masks.smile.texture;
      sprite.visible = true;
      setTint(sprite, latest.palette[farewell.token]);
      sprite.position.set(farewell.x, farewell.y);
      const pop = 1 + POP * Math.sin(smile * Math.PI);
      sprite.scale.set((farewell.radius / masks.smile.radius) * pop);
      sprite.rotation = farewell.tilt;
      sprite.alpha = 1 - fade;
    },
    hide,
    burst(farewell) {
      colors.burst(farewell.x, farewell.y, farewell.id, false, latest.now, latest);
    },
  };

  return {
    blink(id: number, untilTick: number): void {
      const view = views.peek(id);
      if (view !== undefined) {
        view.blinkUntil = Math.max(view.blinkUntil, untilTick);
      }
    },
    hold(id: number, untilTick: number): void {
      const view = views.peek(id);
      if (view !== undefined) {
        view.holdUntil = untilTick;
      }
    },
    poseOf: (id) => views.peek(id),
    burst(x, y, id, frame): void {
      colors.burst(x, y, id, false, frame.now, frame);
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, calm } = frame;
      const downTint = mixColor(palette.badVibeRim, DOWN_GRAY, DOWN_MIX);
      const guardTint = mixColor(palette.texte, DOWN_GRAY, GUARD_GRAY);
      views.begin();
      tosses.begin();
      bosses.begin();
      swim.begin(state, frame);
      for (const enemy of state.enemies) {
        const mask = maskOf(enemy.kind);
        const view = views.acquire(enemy.id);
        const dx = enemy.x - enemy.prevX;
        const dy = enemy.y - enemy.prevY;
        if (dx !== 0 || dy !== 0) {
          view.heading = Math.atan2(dy, dx);
        }
        const down = (enemy.downTicks ?? 0) > 0;
        const asleep = !down && enemy.stunTicks > 0;
        const { sprite } = view;
        const flight = tosses.at(enemy, frame.now);
        keepIn(mask.face.flies === true || flight !== null ? bosses.flying.masks : bodies, sprite);
        const frames = mask.awake.length;
        const stagger = enemy.isBoss ? 0 : enemy.id;
        const loop = mask.face.loopBeats * frame.tempo.ticksPerBeat;
        const index =
          frames === 1 || calm ? 0 : Math.floor((frame.now / loop) * frames + stagger) % frames;
        const full = down ? mask.down : asleep ? mask.asleep : (mask.awake[index] ?? mask.asleep);
        sprite.texture = full;
        const tint = down ? downTint : tintOf(palette, mask.face);
        setTint(
          sprite,
          blinkLit(frame.now, view.blinkUntil, calm)
            ? mixColor(tint, palette.or, calm ? BLINK_MIX.calm : BLINK_MIX.normal)
            : tint,
        );
        sprite.visible = true;
        const held = flight === null && frame.now < view.holdUntil;
        const x = (view.x = flight?.x ?? (held ? view.x : lerp(enemy.prevX, enemy.x, alpha)));
        const y = (view.y = flight?.y ?? (held ? view.y : lerp(enemy.prevY, enemy.y, alpha)));
        sprite.position.set(x, y);
        const swell = down || enemy.isBoss ? 1 : 1 + BEAT_SWELL * frame.pulse;
        const size = (enemy.radius / mask.radius) * swell;
        sprite.scale.set(size, down ? size * FLAT : size);
        const lean = enemy.isBoss ? BOSS_LEAN : LEAN;
        sprite.rotation = down ? 0 : lean * Math.cos(view.heading);
        view.radius = enemy.radius;
        if (enemy.isBoss || flight !== null || mask.face.flies === true) {
          swim.dry(view, full);
          view.waterline = null;
        } else {
          view.waterline = swim.swim(view, full, Math.hypot(dx, dy), frame);
        }
        view.tilt = sprite.rotation;
        if (flight !== null) {
          tosses.lift(enemy.id, sprite, flight, enemy.radius, calm);
        }
        view.boss = enemy.isBoss;
        if (enemy.isBoss) {
          bosses.dress(enemy, mask, sprite, frame);
        }
        const shine = down ? 0 : glintAlpha(frame.now, view.glintStart, calm);
        if (shine > 0) {
          guard(view, x, sprite.y, shine, guardTint);
        } else if (view.glint !== null) {
          view.glint.visible = false;
        }
        if (asleep) {
          dreams(view, x, sprite.y, 1, frame);
        } else if (mask.face.drowsy === true && !down) {
          dreams(view, x, sprite.y, 0.45, frame);
        } else {
          hide(...(view.zs ?? []));
        }
      }
      views.end();
      tosses.end();
      bosses.update(state, frame);
      latest = frame;
      farewells.update(frame.now, calm, hooks);
      colors.update(frame.now);
    },
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      const hitRadius = event.type === 'enemyHit' ? views.peek(event.id)?.radius : undefined;
      bosses.onEvent(event, state, frame, hitRadius);
      const guarded = frontGlintOf(event);
      if (guarded !== undefined) {
        const view = views.peek(guarded);
        if (view !== undefined) {
          view.glintStart = glintStart(state.tick, view.glintStart, frame.calm);
        }
        return;
      }
      if (event.type === 'recruited' || event.type === 'dancerUnmasked') {
        farewells.cancel(event.type === 'recruited' ? event.id : event.enemyId, hide);
        return;
      }
      if (event.type !== 'enemyDied') {
        return;
      }
      const view = views.peek(event.id);
      if (ctx.behaviours.get(event.kind) === 'boss') {
        bosses.farewell(event, view, state, frame);
        return;
      }
      const killer = event.byPlayer === null ? undefined : byId(state.players, event.byPlayer);
      farewells.start({
        id: event.id,
        start: state.tick,
        x: event.x,
        y: event.y,
        radius: view?.radius ?? 10,
        tilt: view === undefined ? 0 : LEAN * Math.cos(view.heading),
        token: (killer && ctx.classTokens.get(killer.classId)) ?? 'or',
      });
    },
    reset(): void {
      farewells.clear(hide);
      colors.clear();
      bosses.reset();
    },
    destroy(): void {
      bosses.destroy();
      wake.texture.destroy(true);
    },
  };
}
