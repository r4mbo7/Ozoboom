import type { UpgradeDefinition, WeaponDefinition } from '../../data/types';
import { lookup } from '../content';
import { drawOffer, drawRelics, isEligible, isWeaponOffered, openFusion } from '../draw';
import type { PlayerState, UpgradeOffer } from '../state';
import { pick } from '../../shared/prng';
import { applyModifiers, refreshDerivedStats, upgradeForm } from '../stats';
import { giveTrap } from '../trap-moves';
import { trailDismount } from '../weapons/trail-ride';
import { presentNextOffer } from './progression';
import type { StepContext } from './types';

export function upgradeChoice(ctx: StepContext): void {
  const { state, commands } = ctx;
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
      if (!takeCard(ctx, player, offer, option, action.upgradeId)) {
        dealAnew(ctx, player);
        continue;
      }
      state.pendingUpgrades.splice(index, 1);
      presentNextOffer(ctx, player);
    }
  }
}

// False for a card the player can no longer take: nothing changes.
function takeCard(
  ctx: StepContext,
  player: PlayerState,
  offer: UpgradeOffer,
  option: number,
  cardId: string,
): boolean {
  const { state, content, set } = ctx;
  const weapon = content.weapons.get(cardId);
  if (weapon?.evolvedFrom !== undefined) {
    const fusion = openFusion(weapon, player, state, content);
    if (fusion === undefined) {
      return false;
    }
    evolve(ctx, player, fusion.weaponId, weapon);
    return true;
  }
  if (weapon !== undefined) {
    if (!isWeaponOffered(weapon, player, state, set, content)) {
      return false;
    }
    gainWeapon(player, weapon);
    state.events.push({ type: 'weaponGained', playerId: player.id, weaponId: weapon.id });
    return true;
  }
  const upgrade = lookup(content.upgrades, cardId, 'upgrade');
  if (!isEligible(upgrade, player, content)) {
    return false;
  }
  if (upgrade.gives !== undefined) {
    const trapKind = giftedTrap(ctx, upgrade, offer);
    giveTrap(ctx, player, trapKind);
    state.events.push({
      type: 'upgradeChosen',
      playerId: player.id,
      upgradeId: upgrade.id,
      trapKind,
    });
    return true;
  }
  const rarity = offer.rarities[option] ?? 'common';
  applyModifiers(player, upgradeForm(upgrade, rarity).modifiers);
  refreshDerivedStats(player, lookup(content.classes, player.classId, 'class'));
  (player.upgradeRarities ??= player.upgrades.map(() => 'common')).push(rarity);
  player.upgrades.push(upgrade.id);
  state.events.push({ type: 'upgradeChosen', playerId: player.id, upgradeId: upgrade.id });
  return true;
}

// The trap shown on the card, or for the surprise, any trap alike.
function giftedTrap(
  { state, content }: StepContext,
  upgrade: UpgradeDefinition,
  offer: UpgradeOffer,
): string {
  if (upgrade.gives?.trap === 'shown') {
    if (offer.trapId === undefined) {
      throw new Error(`"${upgrade.id}" offered without its trap`);
    }
    return offer.trapId;
  }
  return pick(state.rng, [...content.traps.keys()]);
}

// A panel waits for its chosen card: only a new offer reopens it. Nothing left to draw, the offer goes.
function dealAnew(ctx: StepContext, player: PlayerState): void {
  const { state } = ctx;
  const index = state.pendingUpgrades.findIndex((offer) => offer.playerId === player.id);
  const offer = state.pendingUpgrades[index];
  if (offer === undefined) {
    return;
  }
  const next = redrawn(ctx, player, offer, []);
  if (next.options.length > 0) {
    state.pendingUpgrades[index] = next;
    return;
  }
  state.pendingUpgrades.splice(index, 1);
  presentNextOffer(ctx, player);
}

function redrawn(
  { state, content, set }: StepContext,
  player: PlayerState,
  offer: UpgradeOffer,
  replaced: readonly string[],
): UpgradeOffer {
  if (offer.kind === 'relic') {
    const options = drawRelics(state.rng, content, player, replaced);
    return { ...offer, options, rarities: options.map(() => 'common' as const) };
  }
  // Rebuilt rather than spread: the trap of a card no longer shown goes with it.
  return {
    playerId: offer.playerId,
    ...(offer.kind !== undefined && { kind: offer.kind }),
    ...drawOffer(state.rng, state, content, set, player, replaced),
  };
}

// Other cards in a new offer, so that the screen deals them; none left to draw, the reroll is kept.
function reroll(ctx: StepContext, player: PlayerState): void {
  const { state } = ctx;
  const index = state.pendingUpgrades.findIndex((offer) => offer.playerId === player.id);
  const offer = state.pendingUpgrades[index];
  if (offer === undefined || (player.rerolls ?? 0) < 1) {
    return;
  }
  const next = redrawn(ctx, player, offer, offer.options);
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
    applyModifiers(player, trailDismount(old.effect));
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
