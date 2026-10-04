import type { TrapCadence, TrapEffect } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { markedDamageMul, touches } from '../effects';
import type { SimState, SpeakerState } from '../state';
import { fire } from './traps';
import type { StepContext } from './types';

export function speakers({ state, content, set }: StepContext): void {
  const definitions = set.speakers ?? [];
  const beat = state.events.some((event) => event.type === 'beat');
  const markedMul = markedDamageMul(content);

  for (const speaker of state.speakers ?? []) {
    const definition = definitions.find((candidate) => candidate.id === speaker.id);
    if (definition === undefined) {
      throw new Error(`speaker "${speaker.id}" is not in set "${set.id}"`);
    }
    if (speaker.plugged) {
      if (cadence(definition.aura) === 'continuous' || beat) {
        fire({
          state,
          at: { x: speaker.x, y: speaker.y, direction: { x: 1, y: 0 } },
          effect: definition.aura,
          contact: 0,
          by: null,
          power: 1,
          damageMul: 1,
          radiusMul: 1,
          markedMul,
        });
      }
      continue;
    }
    const needed = definition.plugBars * TICKS_PER_BAR;
    if (!someoneStands(state, speaker)) {
      speaker.plugTicks = 0;
      continue;
    }
    speaker.plugTicks += 1;
    if (speaker.plugTicks >= needed) {
      speaker.plugged = true;
      state.volume = (state.volume ?? 0) + 1;
      state.events.push({ type: 'speakerPlugged', speakerId: speaker.id });
      state.events.push({ type: 'volumeChanged', volume: state.volume });
    } else if (beat) {
      state.events.push({
        type: 'speakerPlugging',
        speakerId: speaker.id,
        progress: speaker.plugTicks / needed,
      });
    }
  }
}

// The aura plays on the kick when it hits, as a trap would; the others last as long as it is lit.
function cadence(aura: TrapEffect): TrapCadence {
  return aura.kind === 'shockwave' ? 'beat' : 'continuous';
}

function someoneStands(state: SimState, speaker: SpeakerState): boolean {
  return state.players.some(
    (player) =>
      !player.downed && touches({ x: player.x, y: player.y, radius: 0 }, speaker, speaker.radius),
  );
}
