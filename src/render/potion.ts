import { type Container, Graphics, type Sprite } from 'pixi.js';
import { clamp01, lerp, smoothstep } from '../shared/scalar';
import type { PlayerId, SimEvent, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { drawTakeRing, placeCarrierMarks, placeHalo } from './bonus-marks';
import { WHITE } from './palette';
import {
  ACID,
  type FlaskView,
  GOLD,
  MAGENTA,
  TURQUOISE,
  flaskHueAt,
  hideFlask,
  placeFlask,
} from './potion-flask';
import { add, byId, hide } from './util';
import { ViewPool } from './views';

// A little under the bomb's sizes, beside a player; the bomb's lift.
const LYING_WIDTH = 35;
const CARRIED_WIDTH = 30;
const CARRIED_LIFT = 20;
const CALM_BEATS = 0;
const GROUND = { colours: [MAGENTA, TURQUOISE, ACID], radius: 30, off: 7, turn: 0.8 } as const;
const INTO = { beats: 0.5, leaves: 0.1, to: 16, white: [0.05, 0.35], drop: 26, flash: 46 } as const;
const TAKE_RINGS = { colours: [MAGENTA, TURQUOISE, GOLD], beatsApart: 0.2 } as const;

interface LyingView extends FlaskView {
  readonly ground: readonly Sprite[];
}

interface CarrierView extends FlaskView {
  readonly halo: Sprite;
  readonly ring: Sprite;
}

interface Taken {
  readonly x: number;
  readonly y: number;
  readonly playerId: PlayerId;
  readonly atX: number;
  readonly atY: number;
  readonly start: number;
}

export function createPotion(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const made: Container[] = [];
  const own = <C extends Container>(child: C): C => {
    made.push(child);
    return child;
  };
  const graphics = (layer: Container): Graphics => own(layer.addChild(new Graphics()));
  const flask = (layer: Container): FlaskView => ({
    glow: own(add(layers.glow, t.halo)),
    outline: own(add(layer, t.potion)),
    glass: own(add(layer, t.potion)),
    liquid: graphics(layer),
    shine: own(add(layer, t.potionShine)),
    bubbles: graphics(layer),
  });
  const lying = new ViewPool<LyingView>(
    () => ({
      ground: GROUND.colours.map(() => own(add(layers.glow, t.halo))),
      ...flask(layers.pickups),
    }),
    (view) => {
      hide(...view.ground);
      hideFlask(view);
    },
  );
  const carriers = new ViewPool<CarrierView>(
    () => ({
      halo: own(add(layers.glow, t.halo)),
      ring: own(add(layers.bubbles, t.ring)),
      ...flask(layers.bubbles),
    }),
    (view) => {
      hide(view.halo, view.ring);
      hideFlask(view);
    },
  );
  const flying = flask(layers.bubbles);
  const dropFlash = own(add(layers.glow, t.halo));
  const takerFlash = own(add(layers.glow, t.halo));
  const rings = graphics(layers.fx);
  let taken: Taken | null = null;
  hideFlask(flying);
  hide(dropFlash, takerFlash);

  function clearTaken(): void {
    rings.clear();
    hideFlask(flying);
    hide(dropFlash, takerFlash);
  }

  function placeTaken(state: SimState, alpha: number, beats: number, frame: Frame): void {
    if (taken === null) {
      return;
    }
    clearTaken();
    const since = frame.now - taken.start;
    const apart = TAKE_RINGS.beatsApart * frame.tempo.ticksPerBeat;
    const { atX, atY } = taken;
    let spreading = false;
    for (let index = 0; index < TAKE_RINGS.colours.length; index += 1) {
      const color = TAKE_RINGS.colours[index] ?? MAGENTA;
      spreading = drawTakeRing(rings, atX, atY, since - index * apart, color, frame) || spreading;
    }
    if (!spreading) {
      taken = null;
      return;
    }
    const sinceBeats = since / frame.tempo.ticksPerBeat;
    if (since < 0 || sinceBeats >= INTO.beats) {
      return;
    }
    const player = byId(state.players, taken.playerId);
    const toX = player === undefined ? taken.atX : lerp(player.prevX, player.x, alpha);
    const toY = player === undefined ? taken.atY : lerp(player.prevY, player.y, alpha);
    const flown = smoothstep(clamp01((sinceBeats - INTO.leaves) / (INTO.beats - INTO.leaves)));
    const x = lerp(taken.x, toX, flown);
    const y = lerp(taken.y, toY, flown);
    placeFlask(t, flying, x, y, lerp(LYING_WIDTH, INTO.to, flown), beats, frame, 1 - flown);
    if (frame.calm) {
      return;
    }
    const [whiteFrom, whiteTo] = INTO.white;
    const white = 1 - clamp01((sinceBeats - whiteFrom) / (whiteTo - whiteFrom));
    placeHalo(t, dropFlash, taken.x, taken.y, INTO.drop, WHITE);
    dropFlash.alpha = (1 - flown) * white * frame.light.haloAlpha;
    placeHalo(t, takerFlash, toX, toY, INTO.flash, MAGENTA);
    takerFlash.alpha = (1 - flown) * frame.light.haloAlpha;
  }

  return {
    onEvent(event: SimEvent, state: SimState): void {
      if (event.type === 'potionTaken') {
        const player = byId(state.players, event.playerId);
        taken = {
          x: event.x,
          y: event.y,
          playerId: event.playerId,
          atX: player?.x ?? event.x,
          atY: player?.y ?? event.y,
          start: state.tick,
        };
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { tempo } = frame;
      const beats = frame.calm ? CALM_BEATS : (frame.now - tempo.originTick) / tempo.ticksPerBeat;
      const beat = frame.calm ? 0 : frame.pulse;
      const potion = state.potion;
      lying.begin();
      if (potion?.stage === 'lying') {
        const view = lying.acquire(potion.id);
        placeFlask(t, view, potion.x, potion.y, LYING_WIDTH * (1 + 0.06 * beat), beats, frame);
        for (let index = 0; index < GROUND.colours.length; index += 1) {
          const glow = view.ground[index];
          const angle = beats * GROUND.turn + (index * 2 * Math.PI) / GROUND.colours.length;
          if (glow !== undefined) {
            const x = potion.x + GROUND.off * Math.cos(angle);
            const y = potion.y + GROUND.off * Math.sin(angle);
            placeHalo(t, glow, x, y, GROUND.radius, GROUND.colours[index] ?? MAGENTA);
            glow.alpha = (0.6 + 0.25 * beat) * frame.light.haloAlpha;
          }
        }
      }
      lying.end();

      carriers.begin();
      if (potion !== undefined && potion.stage !== 'over') {
        const hue = flaskHueAt(beats, frame.calm);
        for (const enemy of state.enemies) {
          if (enemy.carriesPotion !== true) {
            continue;
          }
          const view = carriers.acquire(enemy.id);
          const x = lerp(enemy.prevX, enemy.x, alpha);
          const y = lerp(enemy.prevY, enemy.y, alpha);
          const above = placeCarrierMarks(t, view, x, y, enemy.radius, CARRIED_LIFT, hue, frame);
          placeFlask(t, view, x, above, CARRIED_WIDTH, beats, frame);
        }
      }
      carriers.end();

      placeTaken(state, alpha, beats, frame);
    },
    reset(): void {
      taken = null;
      clearTaken();
    },
    destroy(): void {
      for (const child of made) {
        child.destroy();
      }
    },
  };
}
