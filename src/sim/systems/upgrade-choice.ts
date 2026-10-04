import { lookup } from '../content';
import { applyModifiers, refreshDerivedStats } from '../stats';
import type { StepContext } from './types';

export function upgradeChoice({ state, content, commands }: StepContext): void {
  for (const player of state.players) {
    for (const action of commands.get(player.id)?.actions ?? []) {
      if (action.type !== 'chooseUpgrade') {
        continue;
      }
      const index = state.pendingUpgrades.findIndex((offer) => offer.playerId === player.id);
      if (!state.pendingUpgrades[index]?.options.includes(action.upgradeId)) {
        continue;
      }
      const upgrade = lookup(content.upgrades, action.upgradeId, 'upgrade');
      applyModifiers(player, upgrade.modifiers);
      refreshDerivedStats(player, lookup(content.classes, player.classId, 'class'));
      player.upgrades.push(upgrade.id);
      state.pendingUpgrades.splice(index, 1);
      state.events.push({ type: 'upgradeChosen', playerId: player.id, upgradeId: upgrade.id });
    }
  }
}
