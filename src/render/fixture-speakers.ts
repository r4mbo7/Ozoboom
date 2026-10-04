import { SETS } from '../data/sets';
import type { SimState } from '../sim/state';
import { TICKS_PER_BAR } from '../shared/tempo';

export type SpeakerPose = 'off' | 'plugging' | 'plugged';

export function layStacks(state: SimState, poses: readonly SpeakerPose[]): void {
  const set = SETS.find((candidate) => candidate.id === state.setId);
  const definitions = set?.speakers ?? [];
  state.speakers = definitions.map((def, index) => {
    const pose = poses[index] ?? 'off';
    return {
      id: def.id,
      x: def.x,
      y: def.y,
      radius: def.radius,
      plugTicks: pose === 'plugging' ? Math.round(def.plugBars * TICKS_PER_BAR * 0.6) : 0,
      plugged: pose === 'plugged',
    };
  });
  state.traps = [];
  state.volume = poses.filter((pose) => pose === 'plugged').length;
}

// The bench camera follows the first player: stand where the speakers to look at are in view.
export function holdParty(state: SimState, x: number, y: number): void {
  for (const [index, player] of state.players.entries()) {
    player.x = player.prevX = x;
    player.y = player.prevY = y + (index === 0 ? 0 : index === 1 ? -64 : 64);
  }
}
