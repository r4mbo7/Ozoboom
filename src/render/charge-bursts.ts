import { TICKS_PER_BEAT } from '../shared/tempo';
import type { PlayerState, SimEvent, SimState } from '../sim/state';
import type { Burster } from './class-bursts';
import type { PaletteToken } from '../shared/palette';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { BLINK_TICKS } from './motion';
import { BARRIER_RADIUS, TRAIL_HALF_LENGTH } from './textures-class';
import { byId } from './util';

const TAU = Math.PI * 2;
const TRAIL_BODY = 3;
const BREAK_SHARDS = { shards: 10, calmShards: 5, reach: 64 };

export interface BrokenBarrier {
  readonly radius: number;
  readonly token: PaletteToken;
}

export function createChargeBursts(
  ctx: RenderContext,
  { spawn, tokenOf }: Burster,
  blinkEnemy: (id: number, untilTick: number) => void,
) {
  const { textures: t } = ctx;
  const { classFx } = t;

  function dashTrail(state: SimState, player: PlayerState, distance: number, frame: Frame): void {
    const moved = Math.hypot(player.x - player.prevX, player.y - player.prevY);
    const walked = moved >= distance / 2;
    const length = walked ? moved : distance;
    const dirX = walked ? (player.x - player.prevX) / moved : player.aim.x;
    const dirY = walked ? (player.y - player.prevY) / moved : player.aim.y;
    const color = frame.palette[tokenOf(player)];
    const angle = Math.atan2(dirY, dirX);
    const scale = length / 2 / TRAIL_HALF_LENGTH;
    const centerX = player.x - (dirX * length) / 2;
    const centerY = player.y - (dirY * length) / 2;
    for (const [body, peak, duration, outline] of [
      [TRAIL_BODY, 0.9, TICKS_PER_BEAT, true],
      [TRAIL_BODY * 2.2, 0.35, TICKS_PER_BEAT * 1.4, false],
    ] as const) {
      spawn(frame, {
        shape: classFx.trail,
        now: state.tick,
        duration,
        x: centerX,
        y: centerY,
        angle,
        dx: dirX * length * 0.12,
        dy: dirY * length * 0.12,
        fromRadius: length / 2,
        toRadius: length / 2,
        squash: (player.radius * body) / (32 * scale),
        tint: color,
        peak,
        outline,
      });
    }
    spawn(frame, {
      shape: t.halo,
      now: state.tick,
      duration: TICKS_PER_BEAT / 2,
      x: player.x - dirX * length,
      y: player.y - dirY * length,
      fromRadius: player.radius * 1.5,
      toRadius: player.radius * 3,
      tint: color,
      peak: 0.5,
    });
  }

  function pull(state: SimState, event: SimEvent & { type: 'taunted' }, frame: Frame): void {
    const color = frame.palette[tokenOf(byId(state.players, event.playerId))];
    for (let index = 0; index < (frame.calm ? 1 : 2); index += 1) {
      spawn(frame, {
        shape: t.ring,
        now: state.tick,
        delay: index * 4,
        duration: TICKS_PER_BEAT * 1.5,
        x: event.x,
        y: event.y,
        fromRadius: event.radius,
        toRadius: event.radius * 0.2,
        tint: color,
        peak: 0.85,
        outline: true,
      });
    }
    const until = state.tick + BLINK_TICKS;
    for (const enemy of state.enemies) {
      const reach = event.radius + enemy.radius;
      const dx = enemy.x - event.x;
      const dy = enemy.y - event.y;
      if (dx * dx + dy * dy <= reach * reach) {
        blinkEnemy(enemy.id, until);
      }
    }
  }

  function shatter(
    state: SimState,
    event: SimEvent & { type: 'barrierBroken' },
    barrier: BrokenBarrier | undefined,
    frame: Frame,
  ): void {
    const radius = barrier?.radius ?? BARRIER_RADIUS;
    const color = frame.palette[barrier?.token ?? 'or'];
    spawn(frame, {
      shape: classFx.disc,
      now: state.tick,
      duration: TICKS_PER_BEAT / 2,
      x: event.x,
      y: event.y,
      fromRadius: radius,
      toRadius: radius * 1.25,
      tint: color,
      peak: 0.8,
    });
    spawn(frame, {
      shape: classFx.barrier,
      now: state.tick,
      duration: TICKS_PER_BEAT,
      x: event.x,
      y: event.y,
      fromRadius: radius,
      toRadius: radius * 1.6,
      tint: color,
      peak: 0.9,
      outline: true,
    });
    const at = { x: event.x, y: event.y };
    const shards = frame.calm ? BREAK_SHARDS.calmShards : BREAK_SHARDS.shards;
    for (let index = 0; index < shards; index += 1) {
      const angle = (index / shards) * TAU;
      spawn(frame, {
        shape: t.shard,
        now: state.tick,
        duration: TICKS_PER_BEAT,
        x: at.x + Math.cos(angle) * radius,
        y: at.y + Math.sin(angle) * radius,
        dx: Math.cos(angle) * BREAK_SHARDS.reach,
        dy: Math.sin(angle) * BREAK_SHARDS.reach,
        angle: angle + Math.PI / 2,
        fromRadius: 6,
        toRadius: 3,
        tint: color,
        peak: 1,
        outline: true,
      });
    }
  }

  function nova(state: SimState, player: PlayerState, radius: number, frame: Frame): void {
    const color = frame.palette[tokenOf(player)];
    const base = {
      now: state.tick,
      duration: TICKS_PER_BEAT,
      x: 0,
      y: 0,
      anchor: 'player',
      anchorId: player.id,
      tint: color,
    } as const;
    spawn(frame, {
      ...base,
      shape: t.ring,
      fromRadius: player.radius,
      toRadius: radius,
      peak: 0.95,
      outline: true,
    });
    spawn(frame, {
      ...base,
      shape: t.halo,
      fromRadius: player.radius * 1.5,
      toRadius: radius * 0.9,
      peak: 0.4,
    });
  }

  return { dashTrail, nova, pull, shatter };
}
