import type { WeaponDefinition } from '../../data/types';
import { lookup } from '../content';
import { isEligible, isWeaponOffered } from '../draw';
import type { PlayerState } from '../state';
import { applyModifiers, refreshDerivedStats } from '../stats';
import { presentNextOffer } from './progression';
import type { StepContext } from './types';

export function upgradeChoice({ state, content, set, commands }: StepContext): void {
  for (const player of state.players) {
    for (const action of commands.get(player.id)?.actions ?? []) {
      if (action.type !== 'chooseUpgrade') {
        continue;
      }
      const index = state.pendingUpgrades.findIndex((offer) => offer.playerId === player.id);
      if (!state.pendingUpgrades[index]?.options.includes(action.upgradeId)) {
        continue;
      }
      const weapon = content.weapons.get(action.upgradeId);
      if (weapon !== undefined) {
        if (!isWeaponOffered(weapon, player, state, set)) {
          continue;
        }
        gainWeapon(player, weapon);
        state.events.push({ type: 'weaponGained', playerId: player.id, weaponId: weapon.id });
      } else {
        const upgrade = lookup(content.upgrades, action.upgradeId, 'upgrade');
        if (!isEligible(upgrade, player)) {
          continue;
        }
        applyModifiers(player, upgrade.modifiers);
        refreshDerivedStats(player, lookup(content.classes, player.classId, 'class'));
        player.upgrades.push(upgrade.id);
        state.events.push({ type: 'upgradeChosen', playerId: player.id, upgradeId: upgrade.id });
      }
      state.pendingUpgrades.splice(index, 1);
      presentNextOffer(state, content, set, player);
    }
  }
}

function gainWeapon(player: PlayerState, weapon: WeaponDefinition): void {
  const held = player.weapons?.find((slot) => slot.id === weapon.id);
  if (held !== undefined) {
    held.level += 1;
    return;
  }
  player.weapons = [...(player.weapons ?? []), { id: weapon.id, level: 1, phase: 0 }];
}
