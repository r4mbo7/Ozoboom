import { Graphics, type Sprite } from 'pixi.js';
import { clamp01, lerp, smoothstep } from '../shared/scalar';
import type { PlayerId, SimEvent, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { drawTakeRing, placeCarrierMarks, placeHalo } from './bonus-marks';
import { BATTERY_BOLT_AT } from './textures-traps';
import { add, byId, hide, placeOutline, setTint } from './util';
import { ViewPool } from './views';

// The bomb's sizes, lift and halo: the Batterie is its turquoise sister.
const LYING_WIDTH = 42;
const CARRIED_WIDTH = 34;
const CARRIED_LIFT = 20;
const HALO_RADIUS = 40;
// The bolt in the core, a little bigger and whiter on each beat; half lit, and still, in calm mode.
const BOLT = { rest: 0.9, beat: 0.25, white: 0.55, calm: 0.5 };
const WHITE = 0xffffff;
// Taken, the cell flies into the player, white at first and shrinking, in this many beats.
const INTO = { beats: 0.5, leaves: 0.1, white: [0.05, 0.35], to: 16, flash: 46 } as const;

interface CellView {
  readonly halo: Sprite;
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly bolt: Sprite;
  readonly lit: Sprite;
}

interface CarrierView extends CellView {
  readonly ring: Sprite;
}

interface Taken {
  readonly x: number;
  readonly y: number;
  readonly playerId: PlayerId;
  // Where the player stood as they took it: the ring stays there.
  readonly atX: number;
  readonly atY: number;
  readonly start: number;
}

export function createBattery(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const cell = (layer: typeof layers.pickups): CellView => ({
    halo: add(layers.glow, t.halo),
    outline: add(layer, t.battery),
    body: add(layer, t.battery),
    bolt: add(layer, t.batteryBolt),
    lit: add(layer, t.batteryBolt),
  });
  const hideCell = (view: CellView): void => {
    hide(view.halo, view.outline, view.body, view.bolt, view.lit);
  };
  const lying = new ViewPool<CellView>(() => cell(layers.pickups), hideCell);
  const carriers = new ViewPool<CarrierView>(
    () => ({ ring: add(layers.bubbles, t.ring), ...cell(layers.bubbles) }),
    (view) => {
      hide(view.ring);
      hideCell(view);
    },
  );
  const flying = { body: add(layers.bubbles, t.battery), white: add(layers.bubbles, t.battery) };
  const flash = add(layers.glow, t.halo);
  const rings = new Graphics();
  layers.fx.addChild(rings);
  let taken: Taken | null = null;
  hide(flying.body, flying.white, flash);

  function placeCell(
    view: Omit<CellView, 'halo'>,
    x: number,
    y: number,
    width: number,
    frame: Frame,
  ): void {
    const { body, outline, bolt, lit } = view;
    const scale = width / (2 * t.battery.radius);
    body.visible = true;
    setTint(body, frame.palette.turquoise);
    body.position.set(x, y);
    body.scale.set(scale);
    placeOutline(outline, body, t.battery.texture, t.battery.radius, frame);
    const beat = frame.calm ? BOLT.calm : frame.pulse;
    const boltScale = scale * (BOLT.rest + BOLT.beat * beat);
    for (const sprite of [bolt, lit]) {
      sprite.visible = true;
      sprite.position.set(x + BATTERY_BOLT_AT.x * scale, y + BATTERY_BOLT_AT.y * scale);
      sprite.scale.set(boltScale);
    }
    setTint(bolt, frame.palette.turquoise);
    setTint(lit, WHITE);
    lit.alpha = BOLT.white * beat;
  }

  function clearTaken(): void {
    rings.clear();
    hide(flying.body, flying.white, flash);
  }

  // A turquoise ring at the taker, and the cell flying into them, white at first.
  function placeTaken(state: SimState, alpha: number, frame: Frame): void {
    if (taken === null) {
      return;
    }
    clearTaken();
    const since = frame.now - taken.start;
    const { turquoise } = frame.palette;
    if (!drawTakeRing(rings, taken.atX, taken.atY, since, turquoise, frame)) {
      taken = null;
      return;
    }
    const beats = since / frame.tempo.ticksPerBeat;
    if (since < 0 || beats >= INTO.beats) {
      return;
    }
    const player = byId(state.players, taken.playerId);
    const toX = player === undefined ? taken.atX : lerp(player.prevX, player.x, alpha);
    const toY = player === undefined ? taken.atY : lerp(player.prevY, player.y, alpha);
    const flown = smoothstep(clamp01((beats - INTO.leaves) / (INTO.beats - INTO.leaves)));
    const x = lerp(taken.x, toX, flown);
    const y = lerp(taken.y, toY, flown);
    const scale = lerp(LYING_WIDTH, INTO.to, flown) / (2 * t.battery.radius);
    const [whiteFrom, whiteTo] = INTO.white;
    const white = 1 - clamp01((beats - whiteFrom) / (whiteTo - whiteFrom));
    for (const sprite of [flying.body, flying.white]) {
      sprite.visible = true;
      sprite.position.set(x, y);
      sprite.scale.set(scale);
    }
    setTint(flying.body, turquoise);
    flying.body.alpha = 1 - flown;
    setTint(flying.white, WHITE);
    flying.white.alpha = (1 - flown) * white;
    if (!frame.calm) {
      placeHalo(t, flash, toX, toY, INTO.flash, turquoise);
      flash.alpha = (1 - flown) * frame.light.haloAlpha;
    }
  }

  return {
    onEvent(event: SimEvent, state: SimState): void {
      if (event.type === 'batteryTaken') {
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
      const beat = frame.calm ? 0 : frame.pulse;
      const { turquoise } = frame.palette;
      const cell = state.battery;
      lying.begin();
      if (cell?.stage === 'lying') {
        const view = lying.acquire(cell.id);
        placeCell(view, cell.x, cell.y, LYING_WIDTH * (1 + 0.06 * beat), frame);
        placeHalo(t, view.halo, cell.x, cell.y, HALO_RADIUS, turquoise);
        view.halo.alpha = (0.7 + 0.3 * beat) * frame.light.haloAlpha;
      }
      lying.end();

      carriers.begin();
      // No bad vibe carries a Batterie before it falls due or once it is spent for the stage.
      if (cell !== undefined && cell.stage !== 'over') {
        for (const enemy of state.enemies) {
          if (enemy.carriesBattery !== true) {
            continue;
          }
          const view = carriers.acquire(enemy.id);
          const x = lerp(enemy.prevX, enemy.x, alpha);
          const y = lerp(enemy.prevY, enemy.y, alpha);
          const above = placeCarrierMarks(
            t,
            view,
            x,
            y,
            enemy.radius,
            CARRIED_LIFT,
            turquoise,
            frame,
          );
          placeCell(view, x, above, CARRIED_WIDTH, frame);
        }
      }
      carriers.end();

      placeTaken(state, alpha, frame);
    },
    reset(): void {
      taken = null;
      clearTaken();
    },
    destroy(): void {
      lying.begin();
      lying.end();
      carriers.begin();
      carriers.end();
      rings.destroy();
      for (const sprite of [flying.body, flying.white, flash]) {
        sprite.destroy();
      }
    },
  };
}
