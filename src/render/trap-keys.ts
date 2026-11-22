import { Container } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { PlayerId, SimEvent, SimState } from '../sim/state';
import { worldToScreen } from './camera';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { KeyCap } from './key-cap';
import { trapKick } from './trap-call';
import { byId, lookup } from './util';

// Past the trap's edge on the player's side, in world units: the key leans on its upper corner.
const KEY_ASIDE = 0.7;
const KEY_ABOVE = 10;

// The key to press, against the trap a player's key has pointed at for two bars, on their side.
// Only the player the trap answers gets it; on touch, where the key is empty, none shows.
export function createTrapKeys(ctx: RenderContext): Family {
  const root = ctx.layers.screen.addChild(new Container());
  const caps = new Map<PlayerId, KeyCap>();
  let beatTick = Number.NEGATIVE_INFINITY;

  function capOf(playerId: PlayerId): KeyCap {
    let cap = caps.get(playerId);
    if (cap === undefined) {
      cap = new KeyCap(root, ctx.textures);
      caps.set(playerId, cap);
    }
    return cap;
  }

  return {
    onEvent(event: SimEvent, state: SimState): void {
      if (event.type === 'beat') {
        beatTick = state.tick;
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { keyTraps } = ctx.options;
      const kick = trapKick(frame.now - beatTick, frame.tempo, frame.calm);
      for (const [playerId, cap] of caps) {
        if (!state.players.some((player) => player.id === playerId)) {
          cap.hide();
        }
      }
      for (const player of state.players) {
        const held = ctx.answers.heldOf(player.id, frame, keyTraps);
        const trap = held && byId(state.traps, held.trapId);
        const answer = trap && ctx.answers.answerOf(trap.id, frame, keyTraps);
        if (
          held === undefined ||
          trap === undefined ||
          held.key === '' ||
          answer?.playerId !== player.id
        ) {
          caps.get(player.id)?.hide();
          continue;
        }
        const { radius } = lookup(ctx.trapLooks, trap.kind, 'trap kind');
        const x = lerp(trap.prevX, trap.x, alpha);
        const y = lerp(trap.prevY, trap.y, alpha);
        const side = Math.sign(lerp(player.prevX, player.x, alpha) - x) || 1;
        const at = worldToScreen(frame.camera, {
          x: x + side * radius * KEY_ASIDE,
          y: y - radius - KEY_ABOVE,
        });
        capOf(player.id).place(held.key, at.x, at.y, frame, kick.bounce, held.level);
      }
    },
    reset(): void {
      beatTick = Number.NEGATIVE_INFINITY;
      for (const cap of caps.values()) {
        cap.hide();
      }
    },
    destroy(): void {
      root.destroy({ children: true });
      caps.clear();
    },
  };
}
