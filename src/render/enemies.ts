import { Container, Sprite } from 'pixi.js';
import type { PaletteToken } from '../shared/palette';
import type { SimEvent, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import { Farewells, type FarewellHooks } from './enemy-deaths';
import { createBurst } from './enemy-burst';
import { picker } from './faces';
import { frontGlintOf, glintAlpha, glintStart, placeGlint } from './front-glint';
import { type Frame, createFrame } from './frame';
import { blinkLit, lerp } from './motion';
import type { PixiPalette } from './palette';
import { add, byId, hide, setTint } from './util';
import { ViewPool } from './views';
import { mixColor } from './weapon-kit';

const TAU = Math.PI * 2;
// A mask leans toward its heading, never turns upside down: a face stays readable at 16 pixels.
const LEAN = 0.5;
const POP = 0.18;
const FLAT = 0.6;
const BEAT_SWELL = 0.05;
const DOWN_GRAY = 0xd0d0d8;
const DOWN_MIX = 0.55;
const ZS = 3;
const BLINK_MIX = { normal: 0.65, calm: 0.35 };
const GLINT_SIZE = 1.2;
const GUARD_GRAY = 0.4;

// How a bad vibe was last drawn: what is laid over its mask follows it.
export interface EnemyPose {
  readonly x: number;
  readonly y: number;
  readonly tilt: number;
  readonly radius: number;
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
}

export interface EnemiesFamily extends Family {
  blink(id: number, untilTick: number): void;
  // A mask stays where it was drawn until that tick: the stop of a heavy hit.
  hold(id: number, untilTick: number): void;
  poseOf(id: number): EnemyPose | undefined;
  // The colors a chased bad vibe bursts into, for what leaves the party the same way.
  burst(x: number, y: number, id: number, frame: Frame): void;
}

const warnUnknown = (message: string): void => {
  if (import.meta.env.DEV) {
    console.warn(message);
  }
};

export function createEnemies(ctx: RenderContext): EnemiesFamily {
  const { textures, layers } = ctx;
  const { masks } = textures;
  const maskOf = picker(masks.masks, masks.neutral, warnUnknown);

  const bodies = new Container();
  const guards = new Container();
  const smiles = new Container();
  const sleepers = new Container();
  layers.enemies.addChild(bodies, guards, smiles, sleepers);

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
    }),
    (view) => {
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

  function dreams(view: EnemyView, x: number, y: number, strength: number, frame: Frame): void {
    const zs = (view.zs ??= Array.from({ length: ZS }, () => add(sleepers, textures.masks.drowsy)));
    const size = (view.radius * 0.2) / textures.masks.drowsy.radius;
    zs.forEach((z, index) => {
      const progress = (frame.now / frame.tempo.ticksPerBar + index / ZS) % 1;
      z.visible = true;
      setTint(z, frame.palette.texte);
      z.position.set(
        x + view.radius * (0.55 + 0.4 * progress),
        y - view.radius * (0.8 + 2.2 * progress),
      );
      z.scale.set(size * (0.6 + 0.6 * progress));
      z.alpha = strength * Math.sin(progress * Math.PI);
      z.rotation = 0.25 * Math.sin(progress * TAU);
    });
  }

  function guard(view: EnemyView, x: number, y: number, strength: number, tint: number): void {
    const glint = (view.glint ??= add(guards, textures.guard));
    glint.visible = true;
    setTint(glint, tint);
    placeGlint(glint, x, y, view.heading, view.radius);
    const size = (view.radius * GLINT_SIZE) / textures.guard.radius;
    glint.scale.set(size);
    glint.alpha = strength;
  }

  function lower(view: EnemyView): void {
    for (const z of view.zs ?? []) {
      z.visible = false;
    }
  }

  function tintOf(palette: PixiPalette, tone: { token: PaletteToken; amount: number } | undefined) {
    return tone === undefined
      ? palette.badVibeRim
      : mixColor(palette.badVibeRim, palette[tone.token], tone.amount);
  }

  let latest: Frame = createFrame();
  const hooks: FarewellHooks<Sprite> = {
    show(farewell, smile, fade) {
      const sprite = farewell.view;
      const shape = farewell.boss ? masks.bossSmile : masks.smile;
      sprite.texture = shape.texture;
      sprite.visible = true;
      setTint(sprite, latest.palette[farewell.token]);
      sprite.position.set(farewell.x, farewell.y);
      sprite.scale.set((farewell.radius / shape.radius) * (1 + POP * Math.sin(smile * Math.PI)));
      sprite.rotation = farewell.tilt;
      sprite.alpha = 1 - fade;
    },
    hide(sprite) {
      sprite.visible = false;
    },
    burst(farewell) {
      colors.burst(farewell.x, farewell.y, farewell.id, farewell.boss, latest.now, latest);
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
        const frames = mask.awake.length;
        const index =
          frames === 1 || calm
            ? 0
            : Math.floor(
                (frame.now / (mask.face.loopBeats * frame.tempo.ticksPerBeat)) * frames + enemy.id,
              ) % frames;
        sprite.texture = down
          ? mask.down
          : asleep
            ? mask.asleep
            : (mask.awake[index] ?? mask.asleep);
        const tint = down ? downTint : tintOf(palette, mask.face.tone);
        setTint(
          sprite,
          blinkLit(frame.now, view.blinkUntil, calm)
            ? mixColor(tint, palette.or, calm ? BLINK_MIX.calm : BLINK_MIX.normal)
            : tint,
        );
        sprite.visible = true;
        const held = frame.now < view.holdUntil;
        const x = (view.x = held ? view.x : lerp(enemy.prevX, enemy.x, alpha));
        const y = (view.y = held ? view.y : lerp(enemy.prevY, enemy.y, alpha));
        sprite.position.set(x, y);
        const size = (enemy.radius / mask.radius) * (down ? 1 : 1 + BEAT_SWELL * frame.pulse);
        sprite.scale.set(size, down ? size * FLAT : size);
        sprite.rotation = view.tilt = down ? 0 : LEAN * Math.cos(view.heading);
        view.radius = enemy.radius;
        view.boss = enemy.isBoss;
        const shine = down ? 0 : glintAlpha(frame.now, view.glintStart, calm);
        if (shine > 0) {
          guard(view, x, y, shine, guardTint);
        } else if (view.glint !== null) {
          view.glint.visible = false;
        }
        if (asleep) {
          dreams(view, x, y, 1, frame);
        } else if (mask.face.drowsy === true && !down) {
          dreams(view, x, y, 0.45, frame);
        } else {
          lower(view);
        }
      }
      views.end();

      latest = frame;
      farewells.update(frame.now, calm, hooks);
      colors.update(frame.now);
    },
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      const guarded = frontGlintOf(event);
      if (guarded !== undefined) {
        const view = views.peek(guarded);
        if (view !== undefined) {
          view.glintStart = glintStart(state.tick, view.glintStart, frame.calm);
        }
        return;
      }
      if (event.type === 'recruited') {
        farewells.cancel(event.id, (sprite) => {
          sprite.visible = false;
        });
        return;
      }
      if (event.type !== 'enemyDied') {
        return;
      }
      const view = views.peek(event.id);
      const killer = event.byPlayer === null ? undefined : byId(state.players, event.byPlayer);
      farewells.start({
        id: event.id,
        start: state.tick,
        x: event.x,
        y: event.y,
        radius: view?.radius ?? 10,
        tilt: view === undefined ? 0 : LEAN * Math.cos(view.heading),
        boss: view?.boss ?? false,
        token: (killer && ctx.classTokens.get(killer.classId)) ?? 'or',
      });
    },
    reset(): void {
      const hideSprite = (sprite: Sprite) => {
        sprite.visible = false;
      };
      farewells.clear(hideSprite);
      colors.clear();
    },
    destroy(): void {
      layers.enemies.destroy({ children: true });
    },
  };
}
