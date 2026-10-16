import { normalize } from '../../shared/vec';
import { detachCling } from '../specials/cling';
import type { PlayerState, Vec2 } from '../state';
import { dashCharges, dashRechargeBeats } from '../stats';
import type { StepContext } from './types';

// Before `playerMovement`, which carries a dash under way and drops it the tick after its last.
// A beat brings back a spent dash before a dash of the same tick spends one.
export function dashes(ctx: StepContext): void {
  const { state, content, commands } = ctx;
  const definition = content.dash;
  if (definition === null) {
    return;
  }
  const beat = state.events.some((event) => event.type === 'beat');
  for (const player of state.players) {
    if (beat) {
      recharge(ctx, player, dashRechargeBeats(player, definition));
    }
    if (player.downed) {
      delete player.dash;
      continue;
    }
    const command = commands.get(player.id);
    if (
      (player.dash?.ticksLeft ?? 0) > 0 ||
      !command?.actions.some((action) => action.type === 'dash')
    ) {
      continue;
    }
    const spent = player.dashesSpent ?? 0;
    if (spent >= dashCharges(player, definition)) {
      state.events.push({ type: 'dashEmpty', playerId: player.id });
      continue;
    }
    const direction = firstNonZero(
      normalize(command.input.move),
      normalize(command.input.aim),
      player.aim,
    );
    const phase = state.tick % ctx.tempo.ticksPerBeat;
    const onBeat = Math.min(phase, ctx.tempo.ticksPerBeat - phase) <= definition.onBeatTicks;
    const distance = definition.distance * (onBeat ? definition.onBeatDistanceMul : 1);
    const step = distance / definition.ticks;
    player.dash = { dx: direction.x * step, dy: direction.y * step, ticksLeft: definition.ticks };
    if (spent === 0) {
      player.dashBeats = 0;
    }
    player.dashesSpent = spent + 1;
    state.events.push({
      type: 'dashed',
      playerId: player.id,
      dx: direction.x,
      dy: direction.y,
      ...(onBeat ? { onBeat: true } : {}),
    });
    shakeOff(ctx, player);
  }
}

// A dash shakes off the Collant and the sigh of the Méprisant, and no other slow.
function shakeOff({ state, tempo }: StepContext, player: PlayerState): void {
  for (const enemy of state.enemies) {
    if (enemy.clingingTo === player.id) {
      detachCling(enemy, tempo.ticksPerBar);
    }
  }
  delete player.slowFactorExpiresTick;
  delete player.slowFactorValue;
}

function recharge({ state }: StepContext, player: PlayerState, rechargeBeats: number): void {
  if (player.dashesSpent === undefined) {
    return;
  }
  const beats = (player.dashBeats ?? 0) + 1;
  if (beats < rechargeBeats) {
    player.dashBeats = beats;
    return;
  }
  state.events.push({ type: 'dashBack', playerId: player.id });
  if (player.dashesSpent > 1) {
    player.dashesSpent -= 1;
    player.dashBeats = 0;
  } else {
    delete player.dashesSpent;
    delete player.dashBeats;
  }
}

function firstNonZero(...vectors: Vec2[]): Vec2 {
  return vectors.find((vector) => vector.x !== 0 || vector.y !== 0) ?? { x: 1, y: 0 };
}
