import type { Sprite } from 'pixi.js';
import type { SkillEffect } from '../data/types';
import type { PaletteToken } from '../shared/palette';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { PlayerState, SimEvent, SimState } from '../sim/state';
import { createCareBursts } from './care-bursts';
import { createChargeBursts } from './charge-bursts';
import { createBurster } from './class-bursts';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { BARRIER_RADIUS } from './textures-class';
import { add, byId, hide, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const BARRIER_FILL = { least: 0.06, most: 0.3, dayMul: 0.55 };
const BARRIER_BREATH = 0.03;

interface BarrierView {
  readonly halo: Sprite;
  readonly fill: Sprite;
  readonly outline: Sprite;
  readonly ring: Sprite;
  radius: number;
  maxHp: number;
  token: PaletteToken;
}

function effectOf(
  ctx: RenderContext,
  player: PlayerState,
  ultimate: boolean,
): SkillEffect | undefined {
  const effects = ctx.skillEffects.get(player.classId);
  return ultimate ? effects?.ultimate : effects?.skill;
}

// What the roadie and the care add to the picture: read from the events and from the kind of the
// skill of the class of the player, never from a class identifier.
export function createClassEffects(
  ctx: RenderContext,
  blinkEnemy: (id: number, untilTick: number) => void,
): Family {
  const { textures: t, layers } = ctx;
  const { classFx } = t;
  const burster = createBurster(ctx);
  const { bursts, tokenOf } = burster;
  const charge = createChargeBursts(ctx, burster, blinkEnemy);
  const care = createCareBursts(ctx, burster);

  const views = new ViewPool<BarrierView>(
    () => ({
      halo: add(layers.glow, t.halo),
      fill: add(layers.traps, classFx.disc),
      outline: add(layers.traps, classFx.barrier),
      ring: add(layers.traps, classFx.barrier),
      radius: BARRIER_RADIUS,
      maxHp: 0,
      token: 'or',
    }),
    (view) => {
      hide(view.halo, view.fill, view.outline, view.ring);
      view.maxHp = 0;
    },
  );

  function used(state: SimState, playerId: number, ultimate: boolean, frame: Frame): void {
    const player = byId(state.players, playerId);
    const effect = player && effectOf(ctx, player, ultimate);
    if (player === undefined || effect === undefined) {
      return;
    }
    if (effect.kind === 'dash') {
      charge.dashTrail(state, player, effect.distance, frame);
    } else if (effect.kind === 'healPulse') {
      care.heal(state, player, effect.radius, ultimate, frame);
    }
  }

  function reset(): void {
    bursts.clear();
  }

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      switch (event.type) {
        case 'skillUsed':
        case 'ultimateUsed':
          used(state, event.playerId, event.type === 'ultimateUsed', frame);
          break;
        case 'taunted':
          charge.pull(state, event, frame);
          break;
        case 'barrierBroken':
          charge.shatter(state, event, views.peek(event.id), frame);
          break;
        case 'playerHealed': {
          const player = byId(state.players, event.playerId);
          if (player !== undefined && event.amount > 0) {
            care.reflect(state, player, frame);
          }
          break;
        }
        case 'coreRepaired':
          if (event.amount > 0) {
            care.repairGlow(state, frame);
          }
          break;
        case 'playerRevived': {
          const player = byId(state.players, event.playerId);
          if (player !== undefined) {
            care.revive(state, player, frame);
          }
          break;
        }
        default:
          break;
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light, pulse, calm } = frame;
      views.begin();
      for (const barrier of state.barriers ?? []) {
        const view = views.acquire(barrier.id);
        const { halo, fill, outline, ring } = view;
        view.radius = barrier.radius;
        view.maxHp = Math.max(view.maxHp, barrier.hp);
        view.token = tokenOf(byId(state.players, barrier.playerId));
        const share = view.maxHp > 0 ? Math.min(1, Math.max(0, barrier.hp / view.maxHp)) : 0;
        const fade = Math.min(1, barrier.ticksLeft / TICKS_PER_BEAT);
        const color = palette[view.token];
        const scale = (barrier.radius / BARRIER_RADIUS) * (1 + BARRIER_BREATH * pulse);

        fill.visible = true;
        setTint(fill, color);
        fill.position.set(barrier.x, barrier.y);
        fill.scale.set(scale);
        const solid = BARRIER_FILL.least + (BARRIER_FILL.most - BARRIER_FILL.least) * share;
        fill.alpha = solid * fade * (light.additive ? 1 : BARRIER_FILL.dayMul);

        ring.visible = true;
        setTint(ring, color);
        ring.position.set(barrier.x, barrier.y);
        ring.scale.set(scale);
        ring.alpha = (calm ? 0.8 : 0.9) * fade;
        placeOutline(outline, ring, classFx.barrier.texture, classFx.barrier.radius, frame);

        halo.visible = true;
        setTint(halo, color);
        halo.position.set(barrier.x, barrier.y);
        halo.scale.set((barrier.radius * 2.6) / t.halo.radius);
        halo.alpha = 0.45 * share * fade * light.haloAlpha;
      }
      views.end();
      bursts.update(state, alpha, frame);
    },
    reset,
    destroy: reset,
  };
}
