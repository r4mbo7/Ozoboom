import type { PlayerId, PlayerState, SimEvent, SimState } from '../sim/state';
import type { Spawn } from './player-look';
import type { RenderContext } from './context';
import { dashGauge } from '../sim/dash';
import { notchMiddle } from './dash-arc';
import type { Frame } from './frame';
import { lookup } from './util';

const ECHOES = 3;
const ECHO_TICKS = 8;
const ECHO_PEAK = 0.45;
const SPARKS = 8;
const SPARK_TICKS = 10;

type DashEvent = Extract<SimEvent, { type: 'dashed' | 'dashBack' }>;

export interface DashBursts {
  onEvent(event: DashEvent, state: SimState, frame: Frame): void;
}

// `extentOf`: how far the drawn body of a player reaches from its center, in world units.
export function createDashBursts(
  ctx: RenderContext,
  spawn: Spawn,
  extentOf: (player: PlayerState) => number,
): DashBursts {
  const { textures } = ctx;

  function colorOf(player: PlayerState, frame: Frame): number {
    return frame.palette[lookup(ctx.classTokens, player.classId, 'class')];
  }

  function playerOf(state: SimState, id: PlayerId): PlayerState | undefined {
    return state.players.find((candidate) => candidate.id === id);
  }

  // Dust where the dash leaves, then three echoes of the body along its way, each as it passes;
  // gold sparks around the start of a dash on the beat.
  function dashed(
    event: Extract<DashEvent, { type: 'dashed' }>,
    state: SimState,
    frame: Frame,
  ): void {
    const { dx, dy } = event;
    const player = playerOf(state, event.playerId);
    if (player === undefined || ctx.dash === null) {
      return;
    }
    const { ticks } = ctx.dash;
    const distance = ctx.dash.distance * (event.onBeat === true ? ctx.dash.onBeatDistanceMul : 1);
    if (event.onBeat === true) {
      sparks(player, frame);
    }
    const reach = extentOf(player);
    spawn(frame, {
      shape: textures.halo,
      now: frame.now,
      duration: 8,
      x: player.prevX,
      y: player.prevY + player.radius * 0.6,
      fromRadius: player.radius * 0.4,
      toRadius: player.radius * 1.4,
      tint: frame.palette.texte,
      peak: frame.calm ? 0.1 : 0.22,
    });
    for (let echo = 0; echo < ECHOES; echo += 1) {
      const along = (distance * echo) / ECHOES;
      spawn(frame, {
        shape: textures.players.contour,
        now: frame.now,
        delay: (ticks * echo) / ECHOES,
        duration: ECHO_TICKS,
        x: player.prevX + dx * along,
        y: player.prevY + dy * along,
        fromRadius: reach,
        toRadius: reach,
        tint: colorOf(player, frame),
        peak: frame.calm ? ECHO_PEAK / 4 : ECHO_PEAK,
      });
    }
  }

  function sparks(player: PlayerState, frame: Frame): void {
    const count = frame.calm ? 1 : SPARKS;
    for (let spark = 0; spark < count; spark += 1) {
      const angle = (spark / SPARKS) * Math.PI * 2;
      spawn(frame, {
        shape: textures.halo,
        now: frame.now,
        duration: SPARK_TICKS,
        x: player.prevX,
        y: player.prevY,
        fromRadius: player.radius * 0.15,
        toRadius: player.radius * 0.35,
        tint: frame.palette.or,
        peak: 0.9,
        dx: Math.cos(angle) * player.radius * 2.2,
        dy: Math.sin(angle) * player.radius * 2.2,
      });
    }
  }

  // A small ring opens on the notch that came back.
  function back(id: PlayerId, state: SimState, frame: Frame): void {
    const player = playerOf(state, id);
    if (player === undefined || ctx.dash === null || frame.calm) {
      return;
    }
    const gauge = dashGauge(player, ctx.dash, frame.now, frame.tempo);
    const [x, y] = notchMiddle(player.radius, gauge.charges, gauge.ready - 1);
    spawn(frame, {
      shape: textures.ring,
      now: frame.now,
      duration: frame.tempo.ticksPerBeat / 2,
      x,
      y,
      fromRadius: player.radius * 0.3,
      toRadius: player.radius * 0.9,
      tint: colorOf(player, frame),
      peak: 0.8,
      anchor: 'player',
      anchorId: player.id,
    });
  }

  return {
    onEvent(event, state, frame) {
      if (event.type === 'dashed') {
        dashed(event, state, frame);
      } else {
        back(event.playerId, state, frame);
      }
    },
  };
}
