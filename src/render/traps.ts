import type { Sprite } from 'pixi.js';
import type { EntityId, PlayerState, SimState, TrapState } from '../sim/state';
import { BEAM_LENGTH, TRAP_TOKENS } from './textures';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { trapReach } from './reach';
import { add, byId, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

interface TrapView {
  readonly halo: Sprite;
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly beam: Sprite;
  reach: number;
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

export function createTraps(ctx: RenderContext): TrapsFamily {
  const { textures: t, layers } = ctx;
  const views = new ViewPool<TrapView>(
    () => ({
      halo: add(layers.glow, t.halo),
      outline: add(layers.traps, t.traps.shockwave),
      body: add(layers.traps, t.traps.shockwave),
      beam: add(layers.fx, t.beam, 0),
      reach: 0,
    }),
    (view) => {
      hide(view.halo, view.outline, view.body, view.beam);
    },
  );

  return {
    reachOf: (id) => views.peek(id)?.reach,
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light, pulse } = frame;
      views.begin();
      for (const trap of state.traps) {
        const look = lookup(ctx.trapLooks, trap.kind, 'trap kind');
        const view = views.acquire(trap.id);
        const x = lerp(trap.prevX, trap.x, alpha);
        const y = lerp(trap.prevY, trap.y, alpha);
        const kind = look.effect.kind;
        const shape = t.traps[kind];
        const color = palette[TRAP_TOKENS[kind]];
        const facing = Math.atan2(trap.direction.y, trap.direction.x);
        const { body, halo, beam, outline } = view;
        body.texture = shape.texture;
        setTint(body, color);
        body.visible = true;
        body.position.set(x, y);
        body.scale.set(look.radius / shape.radius);
        body.rotation = kind === 'beam' ? facing : 0;
        placeOutline(outline, body, shape.texture, shape.radius, frame);

        halo.visible = true;
        setTint(halo, color);
        halo.position.set(x, y);
        halo.scale.set((look.radius * 3) / t.halo.radius);
        halo.alpha = (0.6 + 0.4 * pulse) * light.haloAlpha;

        view.reach = trapReach(look.effect, ownerOf(state.players, trap));
        beam.visible = look.effect.kind === 'beam';
        if (look.effect.kind === 'beam') {
          setTint(beam, color);
          beam.position.set(x, y);
          beam.rotation = facing;
          beam.scale.set(view.reach / BEAM_LENGTH, look.effect.width / 20);
          beam.alpha = (frame.calm ? 0.7 : 0.75 + 0.25 * pulse) * light.haloAlpha;
        }
      }
      views.end();
    },
    destroy(): void {
      layers.traps.destroy({ children: true });
    },
  };
}
