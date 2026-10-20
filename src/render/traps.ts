import type { Sprite } from 'pixi.js';
import type { BreezeEffect } from '../sim/breeze';
import { trapPointing } from '../sim/pointing';
import type { EntityId, PlayerState, SimState, TrapState } from '../sim/state';
import { BEAM_LENGTH, TRAP_TOKENS } from './textures';
import { CONE_DEGREES, CONE_LENGTH, DROPLET_RADIUS } from './textures-traps';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { trapReach } from './reach';
import { add, byId, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';
import { mixColor } from './weapon-kit';

// A trap drowned in a puddle goes out: grayed, its halo down.
const DROWNED_GRAY = 0x6a6f85;
const DROWNED_MIX = 0.7;

interface TrapView {
  readonly halo: Sprite;
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly beam: Sprite;
  readonly cone: Sprite;
  readonly drops: readonly Sprite[];
  reach: number;
}

const DROPS = 24;
// Beats a droplet takes to fly from the fan to the end of the cone.
const DROP_BEATS = 2.2;

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
  cone.alpha = 0.7;

  const shown = calm ? DROPS / 2 : DROPS;
  const flight = DROP_BEATS * tempo.ticksPerBeat * (calm ? 2 : 1);
  for (const [index, drop] of drops.entries()) {
    drop.visible = index < shown;
    if (!drop.visible) {
      continue;
    }
    const flown = now / flight + index * 0.137;
    const travel = flown - Math.floor(flown);
    const lane = (index * 0.618 + Math.floor(flown) * 0.382) % 1;
    const spread = (lane - 0.5) * 1.8;
    const angle = facing + spread * opening;
    const distance = 18 + travel * (reach - 26);
    setTint(drop, color);
    drop.position.set(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
    drop.scale.set((1.6 + (index % 3) * 0.7 + travel * 0.8) / DROPLET_RADIUS);
    drop.alpha = 0.8 * (1 - travel * travel);
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
      reach: 0,
    }),
    (view) => {
      hide(view.halo, view.outline, view.body, view.beam, view.cone, ...view.drops);
    },
  );

  return {
    reachOf: (id) => views.peek(id)?.reach,
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light, pulse } = frame;
      const tick = state.status === 'running' ? state.tick - 1 + alpha : state.tick;
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
        const pointing = trapPointing(look.effect, trap.direction, tick, frame.tempo);
        const facing = Math.atan2(pointing.y, pointing.x);
        const { body, halo, beam, outline } = view;
        body.texture = shape.texture;
        setTint(body, drowned ? mixColor(color, DROWNED_GRAY, DROWNED_MIX) : color);
        body.visible = true;
        body.position.set(x, y);
        body.scale.set(look.radius / shape.radius);
        body.rotation = kind === 'beam' || kind === 'breeze' ? facing : 0;
        placeOutline(outline, body, shape.texture, shape.radius, frame);

        halo.visible = true;
        setTint(halo, color);
        halo.position.set(x, y);
        halo.scale.set((look.radius * 3) / t.halo.radius);
        const kept = (drowned ? 0.2 : 1) * (1 - (frame.drained.traps.get(trap.id) ?? 0));
        halo.alpha = (0.6 + 0.4 * pulse) * light.haloAlpha * kept;

        view.reach = trapReach(look.effect, ownerOf(state.players, trap));
        beam.visible = look.effect.kind === 'beam' && !drowned;
        if (look.effect.kind === 'beam' && !drowned) {
          setTint(beam, color);
          beam.position.set(x, y);
          beam.rotation = facing;
          beam.scale.set(view.reach / BEAM_LENGTH, look.effect.width / 20);
          beam.alpha = (frame.calm ? 0.7 : 0.75 + 0.25 * pulse) * light.haloAlpha;
        }
        if (look.effect.kind === 'breeze') {
          drawBreeze(view, look.effect, x, y, facing, color, frame);
        } else {
          hide(view.cone, ...view.drops);
        }
      }
      views.end();
    },
    destroy(): void {
      layers.traps.destroy({ children: true });
    },
  };
}
