import { healPlayer, touches } from '../effects';
import type { SkillModule, SkillOf } from './types';

export const healPulse: SkillModule<SkillOf<'healPulse'>> = {
  cast({ state, set }, player, effect, _input, power) {
    for (const ally of state.players) {
      if (!ally.downed && touches(ally, player, effect.radius)) {
        healPlayer(state, ally, effect.amount * power);
      }
    }
    const { core } = state;
    const cap = set.coreRepairPerBar;
    const room = cap === undefined ? Infinity : cap - (core.repairedThisBar ?? 0);
    const repaired = Math.min(core.maxHp - core.hp, effect.coreRepair * power, room);
    if (touches(core, player, effect.radius) && repaired > 0) {
      core.hp += repaired;
      if (cap !== undefined) {
        core.repairedThisBar = (core.repairedThisBar ?? 0) + repaired;
      }
      state.events.push({ type: 'coreRepaired', amount: repaired });
    }
  },
};
