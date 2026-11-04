import { nextFloat } from '../../shared/prng';
import { touches } from '../effects';
import type { SpeakerState, Vec2 } from '../state';
import type { StepContext } from './types';

export function dropDie(
  { state, set, tempo }: StepContext,
  x: number,
  y: number,
  from: Vec2,
): void {
  const rules = set.dice;
  if (rules === undefined) {
    return;
  }
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  const ticksLeft = rules.lifetimeBars * tempo.ticksPerBar;
  (state.dice ??= []).push({ id, ticksLeft, x, y, prevX: x, prevY: y });
  state.events.push({ type: 'dieDropped', id, x, y, fromX: from.x, fromY: from.y });
}

// Thrown toward the core, past the players who plugged it.
export function dropSpeakerDie(ctx: StepContext, speaker: SpeakerState): void {
  const { state, set } = ctx;
  const rules = set.dice;
  if (rules === undefined || nextFloat(state.rng) >= rules.speakerChance) {
    return;
  }
  const dx = state.core.x - speaker.x;
  const dy = state.core.y - speaker.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const reach = speaker.radius + rules.speakerThrow;
  if (length === 0) {
    dropDie(ctx, speaker.x, speaker.y, speaker);
    return;
  }
  dropDie(ctx, speaker.x + (dx / length) * reach, speaker.y + (dy / length) * reach, speaker);
}

export function dice({ state, set }: StepContext): void {
  const rules = set.dice;
  const lying = state.dice;
  if (rules === undefined || lying === undefined) {
    return;
  }
  let kept = 0;
  for (const die of lying) {
    const taker = state.players.find(
      (player) => !player.downed && player.gone !== true && touches(player, die, rules.radius),
    );
    if (taker !== undefined) {
      taker.rerolls = (taker.rerolls ?? 0) + 1;
      const { id, x, y } = die;
      state.events.push({ type: 'dieCollected', id, playerId: taker.id, x, y });
      continue;
    }
    die.ticksLeft -= 1;
    if (die.ticksLeft > 0) {
      lying[kept] = die;
      kept += 1;
    }
  }
  lying.length = kept;
}
