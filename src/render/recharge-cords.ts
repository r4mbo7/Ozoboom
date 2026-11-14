import { Graphics } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { PlayerState, SimState, TrapState } from '../sim/state';
import type { Family, RenderContext } from './context';
import { type CordBeats, cordBeats, createCordPainter } from './cord';
import type { Frame } from './frame';
import { byId, lookup } from './util';
import { ViewPool } from './views';

// The hand reaches out to the socket, this share of the player's radius from their centre.
const HAND_REACH = 0.9;
// Under the trap's edge, so the pins enter it from below.
const SOCKET_BELOW_EDGE = 13;

// A Rallonge's plug and the Batterie's, drawn from what the sim holds: a cord from the player to a socket under
// the trap.
export function createRechargeCords(ctx: RenderContext): Family {
  // Under the traps, so that the pins enter them.
  const cordPool = () =>
    new ViewPool<Graphics>(
      () => ctx.layers.traps.addChildAt(new Graphics(), 0),
      (view) => {
        view.clear();
        view.visible = false;
      },
    );
  // The Rallonge's by player, the Batterie's by trap: a player may have both at once.
  const views = cordPool();
  const batteryViews = cordPool();
  const drawCord = createCordPainter();

  // From the hand, this side of the player towards the socket, or from a point; to the socket under the trap,
  // plugged `held` beats once landed.
  function drawTo(
    view: Graphics,
    from: { x: number; y: number; radius: number },
    { x: socketX, y: socketY }: { x: number; y: number },
    beats: number,
    held: number,
    times: CordBeats,
    frame: Frame,
  ): void {
    const reach =
      (HAND_REACH * from.radius) / Math.max(1, Math.hypot(socketX - from.x, socketY - from.y));
    view.clear();
    view.visible = true;
    drawCord(
      view,
      lerp(from.x, socketX, reach),
      lerp(from.y, socketY, reach),
      socketX,
      socketY,
      beats,
      held,
      times,
      frame,
    );
  }

  function socketUnder(trap: TrapState, alpha: number): { x: number; y: number } {
    const look = lookup(ctx.trapLooks, trap.kind, 'trap kind');
    return {
      x: lerp(trap.prevX, trap.x, alpha),
      y: lerp(trap.prevY, trap.y, alpha) + look.radius * 0.9 + SOCKET_BELOW_EDGE,
    };
  }

  // A trap lifted under a Batterie cord keeps it: plugged where the stack sits, on top of its carrier's head.
  function socketOf(state: SimState, trapId: number, alpha: number) {
    const placed = byId(state.traps, trapId);
    if (placed !== undefined) {
      return socketUnder(placed, alpha);
    }
    const carrier = state.players.find(
      ({ carriedTrap, carriedUnder }) =>
        carriedTrap?.id === trapId || carriedUnder?.some(({ id }) => id === trapId) === true,
    );
    if (carrier === undefined) {
      return undefined;
    }
    const { x, y, radius } = at(carrier, alpha);
    return { x, y: y - radius };
  }

  function at(player: PlayerState, alpha: number) {
    const x = lerp(player.prevX, player.x, alpha);
    const y = lerp(player.prevY, player.y, alpha);
    return { x, y, radius: player.radius };
  }

  // One cord per trap thrown to, from the taker, downed or not, or from where it was taken once they left; held
  // until the sim lets them all go.
  function drawBattery(state: SimState, alpha: number, frame: Frame, times: CordBeats): void {
    const charging = state.battery;
    if (charging?.stage !== 'charging') {
      return;
    }
    const { ticksPerBeat } = frame.tempo;
    const { letGoTick } = charging;
    const taker = byId(state.players, charging.playerId);
    const from =
      taker === undefined || taker.gone === true
        ? { x: charging.x, y: charging.y, radius: 0 }
        : at(taker, alpha);
    for (const plug of charging.plugs) {
      const socket = socketOf(state, plug.trapId, alpha);
      if (socket === undefined) {
        continue;
      }
      const beats = Math.max(0, frame.now - plug.tick) / ticksPerBeat;
      const held =
        letGoTick === undefined ? Infinity : (letGoTick - plug.tick) / ticksPerBeat - times.land;
      if (beats >= times.land + held + times.unplug) {
        continue;
      }
      drawTo(batteryViews.acquire(plug.trapId), from, socket, beats, held, times, frame);
    }
  }

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const rules = frame.set.trapWear;
      views.begin();
      batteryViews.begin();
      if (rules !== undefined) {
        const times = cordBeats(rules);
        for (const player of state.players) {
          const plug = player.rechargePlug;
          const trap = plug === undefined ? undefined : byId(state.traps, plug.trapId);
          if (plug === undefined || trap === undefined || player.downed) {
            continue;
          }
          const beats = Math.max(0, frame.now - plug.tick) / frame.tempo.ticksPerBeat;
          drawTo(
            views.acquire(player.id),
            at(player, alpha),
            socketUnder(trap, alpha),
            beats,
            rules.pluggedBeats,
            times,
            frame,
          );
        }
        drawBattery(state, alpha, frame, times);
      }
      views.end();
      batteryViews.end();
    },
    destroy(): void {
      views.begin();
      views.end();
      batteryViews.begin();
      batteryViews.end();
    },
  };
}
