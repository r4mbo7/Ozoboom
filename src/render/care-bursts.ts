import { TICKS_PER_BEAT } from '../shared/tempo';
import type { PlayerState, SimState } from '../sim/state';
import type { Burster } from './class-bursts';
import type { RenderContext } from './context';
import type { Frame } from './frame';

const TAU = Math.PI * 2;
const GERBE = { shards: 12, calmShards: 6, reach: 54, lift: 16 };

export function createCareBursts(ctx: RenderContext, { spawn, tokenOf }: Burster) {
  const { textures: t } = ctx;

  function heal(state: SimState, player: PlayerState, radius: number, frame: Frame): void {
    const color = frame.palette[tokenOf(player)];
    spawn(frame, {
      shape: t.ring,
      now: state.tick,
      duration: TICKS_PER_BEAT * 1.5,
      x: 0,
      y: 0,
      anchor: 'player',
      anchorId: player.id,
      fromRadius: radius * 0.1,
      toRadius: radius,
      tint: color,
      peak: 0.9,
      outline: true,
    });
    spawn(frame, {
      shape: t.halo,
      now: state.tick,
      duration: TICKS_PER_BEAT,
      x: 0,
      y: 0,
      anchor: 'player',
      anchorId: player.id,
      fromRadius: radius * 0.2,
      toRadius: radius * 0.8,
      tint: color,
      peak: 0.4,
    });
  }

  function reflect(state: SimState, player: PlayerState, frame: Frame): void {
    const base = { now: state.tick, x: 0, y: 0, anchor: 'player', anchorId: player.id } as const;
    spawn(frame, {
      ...base,
      shape: t.halo,
      duration: TICKS_PER_BEAT,
      fromRadius: player.radius * 1.6,
      toRadius: player.radius * 3.4,
      tint: frame.palette.healer,
      peak: 0.65,
    });
    spawn(frame, {
      ...base,
      shape: t.ring,
      duration: TICKS_PER_BEAT,
      fromRadius: player.radius * 1.1,
      toRadius: player.radius * 2.2,
      tint: frame.palette.healer,
      peak: 0.9,
      outline: true,
    });
    spawn(frame, {
      ...base,
      shape: t.vibes,
      duration: TICKS_PER_BEAT * 1.5,
      dy: -player.radius * 1.8,
      fromRadius: 7,
      toRadius: 5,
      tint: frame.palette.or,
      peak: 1,
      outline: true,
    });
  }

  function repairGlow(state: SimState, frame: Frame): void {
    const { core } = state;
    const base = { now: state.tick, x: 0, y: 0, anchor: 'core' } as const;
    spawn(frame, {
      ...base,
      shape: t.halo,
      duration: TICKS_PER_BEAT * 1.6,
      fromRadius: core.radius * 2,
      toRadius: core.radius * 4.6,
      tint: frame.palette.healer,
      peak: 0.8,
    });
    spawn(frame, {
      ...base,
      shape: t.ring,
      duration: TICKS_PER_BEAT * 1.2,
      fromRadius: core.radius * 1.1,
      toRadius: core.radius * 1.9,
      tint: frame.palette.healer,
      peak: 0.9,
      outline: true,
    });
  }

  function spray(
    state: SimState,
    frame: Frame,
    at: { x: number; y: number },
    shards: number,
    reach: number,
    lift: number,
    tints: readonly number[],
    seed: number,
  ): void {
    for (let index = 0; index < shards; index += 1) {
      const angle = ((index + ((seed * 0.618) % 1)) / shards) * TAU;
      const far = reach * (0.7 + 0.3 * ((index * 7) % 5) * 0.25);
      spawn(frame, {
        shape: t.shard,
        now: state.tick,
        duration: TICKS_PER_BEAT * 1.2,
        x: at.x,
        y: at.y,
        dx: Math.cos(angle) * far,
        dy: Math.sin(angle) * far - lift,
        fromRadius: 7,
        toRadius: 3.5,
        angle: angle + Math.PI,
        tint: tints[index % tints.length] ?? 0xffffff,
        peak: 1,
        outline: true,
      });
    }
  }

  function revive(state: SimState, player: PlayerState, frame: Frame): void {
    const { palette } = frame;
    spray(
      state,
      frame,
      player,
      frame.calm ? GERBE.calmShards : GERBE.shards,
      GERBE.reach,
      GERBE.lift,
      [palette.healer, palette.or],
      player.id,
    );
    spawn(frame, {
      shape: t.ring,
      now: state.tick,
      duration: TICKS_PER_BEAT * 1.2,
      x: player.x,
      y: player.y,
      fromRadius: player.radius,
      toRadius: player.radius * 3.4,
      tint: palette.or,
      peak: 0.9,
      outline: true,
    });
  }

  return { heal, reflect, repairGlow, revive };
}
