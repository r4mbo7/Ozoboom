import type { Sprite } from 'pixi.js';
import type { EntityId, PlayerState, SimState, TrapState } from '../sim/state';
import { trapAt } from '../sim/systems/traps';
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
  readonly pips: readonly Sprite[];
  reach: number;
}

const MAX_PIPS = 5;
const PIP_SPACING = 0.42;
const PIP_LENGTH = 5;
const NEXT_PIP_ALPHA = 0.45;

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
      pips: Array.from({ length: MAX_PIPS }, () => add(layers.traps, t.pip)),
      reach: 0,
    }),
    (view) => {
      hide(view.halo, view.outline, view.body, view.beam, ...view.pips);
    },
  );

  return {
    reachOf: (id) => views.peek(id)?.reach,
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light, pulse } = frame;
      views.begin();
      const underfoot = new Set(
        state.players.flatMap((player) => {
          const under = player.downed ? undefined : trapAt(ctx.trapLooks, state.traps, player);
          return under === undefined ? [] : [under];
        }),
      );
      for (const trap of state.traps) {
        const look = lookup(ctx.trapLooks, trap.kind, 'trap kind');
        const view = views.acquire(trap.id);
        const x = lerp(trap.prevX, trap.x, alpha);
        const y = lerp(trap.prevY, trap.y, alpha);
        const kind = look.effect.kind;
        const shape = t.traps[kind];
        const color = palette[TRAP_TOKENS[kind]];
        const facing = Math.atan2(trap.direction.y, trap.direction.x);
        const { body, halo, beam, outline, pips } = view;
        body.texture = shape.texture;
        setTint(body, color);
        body.visible = true;
        body.position.set(x, y);
        body.scale.set(look.radius / shape.radius);
        body.rotation = kind === 'beam' ? facing : 0;
        placeOutline(outline, body, shape.texture, shape.radius, frame);

        // A trap a player stands on previews, faintly, the pip of its next level.
        const next = underfoot.has(trap) && trap.level < look.maxLevel;
        const shown = Math.min(trap.level + (next ? 1 : 0), MAX_PIPS);
        const ringRadius = look.radius * 1.25;
        for (let index = 0; index < MAX_PIPS; index += 1) {
          const pip = pips[index];
          if (pip === undefined) {
            continue;
          }
          pip.visible = index < shown;
          if (pip.visible) {
            const angle = Math.PI / 2 + (index - (shown - 1) / 2) * PIP_SPACING;
            setTint(pip, color);
            pip.position.set(x + Math.cos(angle) * ringRadius, y + Math.sin(angle) * ringRadius);
            pip.rotation = angle;
            pip.scale.set(PIP_LENGTH / (t.pip.radius * 2));
            pip.alpha =
              next && index === shown - 1
                ? NEXT_PIP_ALPHA * (frame.calm ? 1 : 0.6 + 0.4 * pulse)
                : 1;
          }
        }

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
