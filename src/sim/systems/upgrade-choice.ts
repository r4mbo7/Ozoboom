import type { WeaponDefinition } from '../../data/types';
import { lookup } from '../content';
import { drawOffer, drawRelics, isEligible, isWeaponOffered, openFusion } from '../draw';
import type { PlayerState, UpgradeOffer } from '../state';
import { applyModifiers, refreshDerivedStats, upgradeForm } from '../stats';
import { presentNextOffer } from './progression';
import type { StepContext } from './types';

export function upgradeChoice(ctx: StepContext): void {
  const { state, content, set, commands } = ctx;
  for (const player of state.players) {
    for (const action of commands.get(player.id)?.actions ?? []) {
      if (action.type === 'rerollOffer') {
        reroll(ctx, player);
        continue;
      }
      if (action.type !== 'chooseUpgrade') {
        continue;
      }
      const index = state.pendingUpgrades.findIndex((offer) => offer.playerId === player.id);
      const offer = state.pendingUpgrades[index];
      const option = offer?.options.indexOf(action.upgradeId) ?? -1;
      if (offer === undefined || option < 0) {
        continue;
      }
      const weapon = content.weapons.get(action.upgradeId);
      if (weapon?.evolvedFrom !== undefined) {
        const fusion = openFusion(weapon, player, state, content);
        if (fusion === undefined) {
          continue;
        }
        evolve(ctx, player, fusion.weaponId, weapon);
      } else if (weapon !== undefined) {
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
        const rarity = offer.rarities[option] ?? 'common';
        applyModifiers(player, upgradeForm(upgrade, rarity).modifiers);
        refreshDerivedStats(player, lookup(content.classes, player.classId, 'class'));
        (player.upgradeRarities ??= player.upgrades.map(() => 'common')).push(rarity);
        player.upgrades.push(upgrade.id);
        state.events.push({ type: 'upgradeChosen', playerId: player.id, upgradeId: upgrade.id });
      }
      state.pendingUpgrades.splice(index, 1);
      presentNextOffer(ctx, player);
    }
  }
}

// Other cards in a new offer, so that the screen deals them; none left to draw, the reroll is kept.
function reroll(ctx: StepContext, player: PlayerState): void {
  const { state, content, set } = ctx;
  const index = state.pendingUpgrades.findIndex((offer) => offer.playerId === player.id);
  const offer = state.pendingUpgrades[index];
  if (offer === undefined || (player.rerolls ?? 0) < 1) {
    return;
  }
  let next: UpgradeOffer;
  if (offer.kind === 'relic') {
    const options = drawRelics(state.rng, state, content, player, offer.options);
    next = { ...offer, options, rarities: options.map(() => 'common' as const) };
  } else {
    next = { ...offer, ...drawOffer(state.rng, state, content, set, player, offer.options) };
  }
  if (next.options.length === 0) {
    return;
  }
  player.rerolls = (player.rerolls ?? 0) - 1;
  state.pendingUpgrades[index] = next;
  state.events.push({ type: 'offerRerolled', playerId: player.id });
}

function gainWeapon(player: PlayerState, weapon: WeaponDefinition): void {
  const held = player.weapons?.find((slot) => slot.id === weapon.id);
  if (held !== undefined) {
    held.level += 1;
    return;
  }
  player.weapons = [...(player.weapons ?? []), { id: weapon.id, level: 1, phase: 0 }];
}

function evolve(
  { state, content }: StepContext,
  player: PlayerState,
  baseId: string,
  result: WeaponDefinition,
): void {
  const slot = player.weapons?.find((held) => held.id === baseId);
  if (slot === undefined) {
    throw new Error(`fusion to "${result.id}" without "${baseId}" held`);
  }
  const old = lookup(content.weapons, baseId, 'weapon');
  if (slot.trail !== undefined && old.effect.kind === 'trail') {
    applyModifiers(player, [{ stat: 'speedMul', mul: 1 / old.effect.speedMul }]);
    refreshDerivedStats(player, lookup(content.classes, player.classId, 'class'));
  }
  slot.id = result.id;
  slot.level = 1;
  slot.phase = 0;
  delete slot.trail;
  player.fused = [...(player.fused ?? []), result.id];
  state.events.push({
    type: 'weaponEvolved',
    playerId: player.id,
    weaponId: baseId,
    resultId: result.id,
  });
}
