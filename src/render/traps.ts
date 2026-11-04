import type { Sprite } from 'pixi.js';
import { clamp01, frac, lerp } from '../shared/scalar';
import type { BreezeEffect } from '../sim/breeze';
import { trapPointing } from '../sim/pointing';
import type { EntityId, PlayerState, SimEvent, SimState, TrapState } from '../sim/state';
import { trapPower } from '../sim/trap-wear';
import { mixColor } from './palette';
import { BEAM_LENGTH, TRAP_TOKENS } from './textures';
import { CONE_DEGREES, CONE_LENGTH, DROPLET_RADIUS } from './textures-traps';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { trapReach } from './reach';
import { callingTraps, trapKick } from './trap-call';
import { add, byId, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const DROWNED_GRAY = 0x6a6f85;
const DROWNED_MIX = 0.7;

interface TrapView {
  readonly halo: Sprite;
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly beam: Sprite;
  readonly cone: Sprite;
  readonly drops: readonly Sprite[];
  readonly call: Sprite;
  reach: number;
}

const DROPS = 24;
const DROP_BEATS = 2.2;
// Out, a worn trap fades where it stood over this many beats, shrinking by this share.
export const WORN_FADE_BEATS = 2;
const FADE_SHRINK = 0.3;

// Plugged to a Rallonge, its halo swells this much wider and brighter across the plugged beat, then
// falls back; in calm mode it holds a steady part of that.
const RECHARGE_FLARE = 0.8;
const FLARE_FALL_BEATS = 0.5;
const CALM_FLARE = 0.5;

// A trap's body dims with its wear, never below this share, to stay easy to find and move.
const DIMMEST_BODY = 0.5;

export function wornBodyAlpha(power: number): number {
  return DIMMEST_BODY + (1 - DIMMEST_BODY) * power;
}

interface Fading {
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  // The body's alpha when it went out, faded from there.
  readonly alpha: number;
  readonly since: number;
}

export interface TrapsFamily extends Family {
  reachOf(id: EntityId): number | undefined;
}

function ownerOf(players: readonly PlayerState[], trap: TrapState): PlayerState {
  const owner = byId(players, trap.ownerId);
  if (owner === undefined) {
    throw new Error(`Trap ${String(trap.id)} has no owner ${String(trap.ownerId)}`);
  }
  return owner;
}

function drawBreeze(
  view: TrapView,
  effect: BreezeEffect,
  x: number,
  y: number,
  facing: number,
  color: number,
  power: number,
  frame: Frame,
): void {
  const { cone, drops, reach } = view;
  const { calm, now, tempo } = frame;
  const opening = (effect.coneDegrees * Math.PI) / 360;
  setTint(cone, color);
  cone.visible = true;
  cone.position.set(x, y);
  cone.rotation = facing;
  cone.scale.set(
    reach / CONE_LENGTH,
    (reach / CONE_LENGTH) * (Math.tan(opening) / Math.tan((CONE_DEGREES * Math.PI) / 360)),
  );
  cone.alpha = 0.7 * power;

  const shown = calm ? DROPS / 2 : DROPS;
  const flight = DROP_BEATS * tempo.ticksPerBeat * (calm ? 2 : 1);
  for (const [index, drop] of drops.entries()) {
    drop.visible = index < shown;
    if (!drop.visible) {
      continue;
    }
    const flown = now / flight + index * 0.137;
    const travel = frac(flown);
    const lane = (index * 0.618 + Math.floor(flown) * 0.382) % 1;
    const spread = (lane - 0.5) * 1.8;
    const angle = facing + spread * opening;
    const distance = 18 + travel * (reach - 26);
    setTint(drop, color);
    drop.position.set(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
    drop.scale.set((1.6 + (index % 3) * 0.7 + travel * 0.8) / DROPLET_RADIUS);
    drop.alpha = 0.8 * (1 - travel * travel) * power;
  }
}

export function createTraps(ctx: RenderContext): TrapsFamily {
  const { textures: t, layers } = ctx;
  const views = new ViewPool<TrapView>(
    () => ({
      halo: add(layers.glow, t.halo),
      outline: add(layers.traps, t.traps.shockwave),
      body: add(layers.traps, t.traps.shockwave),
      beam: add(layers.fx, t.beam, 0),
      cone: add(layers.glow, t.cone, 0),
      drops: Array.from({ length: DROPS }, () => add(layers.glow, t.droplet)),
      call: add(layers.fx, t.ring),
      reach: 0,
    }),
    (view) => {
      hide(view.halo, view.outline, view.body, view.beam, view.cone, view.call, ...view.drops);
    },
  );

  const fading = new Map<EntityId, Fading>();
  const recharged = new Map<EntityId, number>();
  let beatTick = Number.NEGATIVE_INFINITY;

  // From 0 as the plug lands up to 1 as it lets go, down to 0 half a beat later.
  function flare(id: EntityId, frame: Frame): number {
    const since = recharged.get(id);
    const rules = frame.set.trapWear;
    if (since === undefined || rules === undefined) {
      return 0;
    }
    const { plugInBeats, pluggedBeats } = rules;
    const beats = Math.max(0, frame.now - since) / frame.tempo.ticksPerBeat;
    const left = 1 - (beats - plugInBeats - pluggedBeats) / FLARE_FALL_BEATS;
    if (left <= 0) {
      recharged.delete(id);
      return 0;
    }
    const peak = frame.calm ? CALM_FLARE : 1;
    const rise = frame.calm ? beats / plugInBeats : (beats - plugInBeats) / pluggedBeats;
    return peak * Math.min(clamp01(rise), left);
  }

  function drawFading(frame: Frame): void {
    const duration = WORN_FADE_BEATS * frame.tempo.ticksPerBeat;
    for (const [id, faded] of fading) {
      const progress = Math.max(0, frame.now - faded.since) / duration;
      if (progress >= 1) {
        fading.delete(id);
        continue;
      }
      const look = lookup(ctx.trapLooks, faded.kind, 'trap kind');
      const shape = t.traps[look.effect.kind];
      const view = views.acquire(id);
      const { body, outline } = view;
      body.texture = shape.texture;
      setTint(body, frame.palette[TRAP_TOKENS[look.effect.kind]]);
      body.visible = true;
      body.position.set(faded.x, faded.y);
      body.scale.set(((1 - FADE_SHRINK * progress) * look.radius) / shape.radius);
      body.rotation = faded.rotation;
      body.alpha = faded.alpha * (1 - progress);
      placeOutline(outline, body, shape.texture, shape.radius, frame);
      hide(view.halo, view.beam, view.cone, view.call, ...view.drops);
    }
  }

  return {
    reachOf: (id) => views.peek(id)?.reach,
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (event.type === 'trapWornOut') {
        const { id, kind, x, y } = event;
        const body = views.peek(id)?.body;
        const alpha = body?.alpha ?? wornBodyAlpha(trapPower({ intensity: 0 }, frame.set.trapWear));
        fading.set(id, { kind, x, y, rotation: body?.rotation ?? 0, alpha, since: state.tick });
        recharged.delete(id);
      } else if (event.type === 'trapRecharged') {
        recharged.set(event.id, state.tick);
      } else if (event.type === 'beat') {
        beatTick = state.tick;
      }
    },
    reset(): void {
      fading.clear();
      recharged.clear();
      beatTick = Number.NEGATIVE_INFINITY;
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light, pulse } = frame;
      const tick = state.status === 'running' ? state.tick - 1 + alpha : state.tick;
      const calling = callingTraps(state.traps, ctx.options.trapCallers ?? []);
      const kick = trapKick(frame.now - beatTick, frame.tempo, frame.calm);
      views.begin();
      for (const trap of state.traps) {
        const look = lookup(ctx.trapLooks, trap.kind, 'trap kind');
        const view = views.acquire(trap.id);
        const x = lerp(trap.prevX, trap.x, alpha);
        const y = lerp(trap.prevY, trap.y, alpha);
        const kind = look.effect.kind;
        const shape = t.traps[kind];
        const color = palette[TRAP_TOKENS[kind]];
        const drowned = (trap.shortedTicks ?? 0) > 0;
        const power = trapPower(trap, frame.set.trapWear);
        const pointing = trapPointing(look.effect, trap.direction, tick, frame.tempo);
        const facing = Math.atan2(pointing.y, pointing.x);
        const { body, halo, beam, outline, call } = view;
        const called = calling.has(trap.id);
        body.texture = shape.texture;
        setTint(body, drowned ? mixColor(color, DROWNED_GRAY, DROWNED_MIX) : color);
        body.visible = true;
        body.position.set(x, y);
        body.scale.set(((called ? kick.bounce : 1) * look.radius) / shape.radius);
        body.rotation = kind === 'beam' || kind === 'breeze' ? facing : 0;
        body.alpha = wornBodyAlpha(power);
        placeOutline(outline, body, shape.texture, shape.radius, frame);

        call.visible = called;
        if (called) {
          setTint(call, palette.turquoise);
          call.position.set(x, y);
          call.scale.set((kick.ring * look.radius) / t.ring.radius);
          call.alpha = kick.ringAlpha;
        }

        halo.visible = true;
        setTint(halo, color);
        halo.position.set(x, y);
        const flared = flare(trap.id, frame);
        halo.scale.set((look.radius * 3 * (1 + RECHARGE_FLARE * flared)) / t.halo.radius);
        const kept = (drowned ? 0.2 : 1) * (1 - (frame.drained.traps.get(trap.id) ?? 0)) * power;
        halo.alpha = Math.max(
          (0.6 + 0.4 * pulse) * light.haloAlpha * kept,
          light.haloAlpha * flared,
        );

        view.reach = trapReach(look.effect, ownerOf(state.players, trap), power);
        beam.visible = look.effect.kind === 'beam' && !drowned;
        if (look.effect.kind === 'beam' && !drowned) {
          setTint(beam, color);
          beam.position.set(x, y);
          beam.rotation = facing;
          beam.scale.set(view.reach / BEAM_LENGTH, look.effect.width / 20);
          beam.alpha = (frame.calm ? 0.7 : 0.75 + 0.25 * pulse) * light.haloAlpha * power;
        }
        if (look.effect.kind === 'breeze') {
          drawBreeze(view, look.effect, x, y, facing, color, power, frame);
        } else {
          hide(view.cone, ...view.drops);
        }
      }
      drawFading(frame);
      views.end();
    },
    destroy(): void {
      layers.traps.destroy({ children: true });
    },
  };
}
