import { lerp } from '../shared/scalar';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { PlayerState, SimEvent, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { type Piece, SIZES, type WeaponKit } from './weapon-kit';
import { byId } from './util';
import { ViewPool } from './views';

// In player radii: how far ahead of the chest the stick is held, and its length.
const REACH = 1.05;
const LENGTH = 1.3;
const SWING = 0.35;
const GLOW_TICKS = TICKS_PER_BEAT / 3;
const NICK_TICKS = 3;
const SPARK_SIZE = SIZES.spark ?? 0;
const WHITE = 0xffffff;

type WeaponHit = Extract<SimEvent, { type: 'weaponHit' }>;

interface Pose {
  readonly x: number;
  readonly y: number;
  readonly aim: number;
  readonly axis: number;
  readonly length: number;
}

// One smooth swing per beat, in time with the music, never a jolt.
function swayAt(now: number): number {
  return SWING * Math.sin(2 * Math.PI * (now / TICKS_PER_BEAT - 0.125));
}

function poseAt(player: PlayerState, x: number, y: number, now: number): Pose {
  const aim = Math.atan2(player.aim.y, player.aim.x);
  return {
    x: x + Math.cos(aim) * player.radius * REACH,
    y: y + Math.sin(aim) * player.radius * REACH,
    aim,
    axis: aim + Math.PI / 2 + swayAt(now),
    length: player.radius * LENGTH,
  };
}

// The stick held against the chest, swaying with the beat; its tip ahead lights up on each strike,
// and each bad vibe its spark hits keeps a white nick across the spark's way.
export function createDevilStick(
  ctx: RenderContext,
  kit: WeaponKit,
): Required<Pick<Family, 'update' | 'onEvent'>> {
  const { textures: t } = ctx;
  const sticks = new ViewPool<Piece>(kit.piece, kit.hidePiece);

  function nick(hit: WeaponHit, state: SimState, frame: Frame): void {
    const player = byId(state.players, hit.playerId);
    const way = player === undefined ? 0 : Math.atan2(hit.y - player.y, hit.x - player.x);
    const size = SPARK_SIZE * kit.style(hit.weaponId).scale;
    kit.transients.spawn({
      shape: t.weapons.devilStick.nick,
      now: frame.now,
      duration: NICK_TICKS,
      x: hit.x,
      y: hit.y,
      angle: way + Math.PI / 2,
      fromRadius: size * 0.6,
      toRadius: size * 0.45,
      tint: WHITE,
      peak: frame.calm ? 0.6 : 1,
    });
  }

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      sticks.begin();
      for (const player of state.players) {
        const slot = player.weapons?.find((candidate) => kit.style(candidate.id).kind === 'spark');
        if (player.downed || slot === undefined) {
          continue;
        }
        const pose = poseAt(
          player,
          lerp(player.prevX, player.x, alpha),
          lerp(player.prevY, player.y, alpha),
          frame.now,
        );
        kit.place(
          sticks.acquire(player.id),
          t.weapons.devilStick.stick,
          { x: pose.x, y: pose.y, size: pose.length, rotation: pose.axis, painted: true },
          frame.palette[kit.style(slot.id).token],
          frame,
        );
      }
      sticks.end();
    },
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (event.type === 'weaponHit' && kit.style(event.weaponId).kind === 'spark') {
        nick(event, state, frame);
        return;
      }
      if (
        frame.calm ||
        event.type !== 'weaponFired' ||
        kit.style(event.weaponId).kind !== 'spark'
      ) {
        return;
      }
      const player = byId(state.players, event.playerId);
      if (player === undefined) {
        return;
      }
      const pose = poseAt(player, event.x, event.y, state.tick);
      const ahead = Math.sign(Math.cos(pose.axis - pose.aim)) * (pose.length / 2);
      kit.transients.spawn({
        shape: t.halo,
        now: state.tick,
        duration: GLOW_TICKS,
        x: pose.x + Math.cos(pose.axis) * ahead,
        y: pose.y + Math.sin(pose.axis) * ahead,
        fromRadius: player.radius * 0.45,
        toRadius: player.radius * 0.25,
        tint: frame.palette[kit.style(event.weaponId).token],
        peak: 0.6,
      });
    },
  };
}
