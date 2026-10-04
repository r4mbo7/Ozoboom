import type { GameContent, Rarity, UpgradeFamily, WeaponDefinition } from '../data/types';
import type { PlayerState, UpgradeOffer } from '../sim/state';

export const SIXTEENTHS_PER_BAR = 16;

const FAMILY_LABEL: Record<UpgradeFamily, string> = {
  class: 'Classe',
  generic: 'Générique',
  defense: 'Défense',
  relic: 'Relique',
};

const RARITY_LABEL: Record<Rarity, string | null> = {
  common: null,
  rare: 'Rare',
  legendary: 'Légendaire',
};

export type CardTint = 'common' | 'rare' | 'legendary' | 'relic' | 'fusion';

interface CardBase {
  id: string;
  name: string;
  description: string;
  tint: CardTint;
  rarityLabel: string | null;
}

export interface UpgradeCard extends CardBase {
  kind: 'upgrade';
  family: UpgradeFamily;
  label: string;
  rank: string;
}

export interface WeaponCard extends CardBase {
  kind: 'weapon';
  weapon: WeaponDefinition;
  label: string;
  rank: string;
  // One entry per sixteenth note of the bar, or `continuous`.
  steps: readonly boolean[] | 'continuous';
  // Above one, the weapon fires on one bar out of that many.
  everyBars: number;
}

export interface FusionCard extends CardBase {
  kind: 'fusion';
  weapon: WeaponDefinition;
  label: string;
  recipe: string;
  replaces: string;
}

export type Card = UpgradeCard | WeaponCard | FusionCard;

export function offerHeading(offer: UpgradeOffer): string {
  return offer.kind === 'relic' ? 'Le boss lâche une relique' : 'Choisis ton amélioration';
}

export function offerKicker(offer: UpgradeOffer, player: PlayerState | undefined): string {
  if (offer.kind === 'relic') {
    return 'Boss vaincu';
  }
  return player === undefined ? 'Niveau supérieur' : `Niveau ${String(player.level)}`;
}

export function stepsOf(weapon: WeaponDefinition): readonly boolean[] | 'continuous' {
  if (weapon.rhythm === 'continuous') {
    return 'continuous';
  }
  const { steps } = weapon.rhythm;
  return Array.from({ length: SIXTEENTHS_PER_BAR }, (_, step) => steps.includes(step));
}

// A relic comes once, from a boss: it has no rank to tell.
function rankOf(family: UpgradeFamily, stacks: number, maxStacks: number): string {
  if (family === 'relic') {
    return '';
  }
  return stacks === 0 ? 'Nouveau' : `Rang ${String(stacks + 1)} sur ${String(maxStacks)}`;
}

export function cardFor(
  id: string,
  offer: UpgradeOffer,
  player: PlayerState | undefined,
  content: GameContent,
): Card {
  const upgrade = content.upgrades.find((entry) => entry.id === id);
  if (upgrade !== undefined) {
    const rarity = upgrade.rarity ?? 'common';
    const className =
      upgrade.family === 'class'
        ? content.classes.find((entry) => entry.id === upgrade.classId)?.name
        : undefined;
    const label = FAMILY_LABEL[upgrade.family];
    const stacks = player?.upgrades.filter((held) => held === id).length ?? 0;
    return {
      kind: 'upgrade',
      id,
      name: upgrade.name,
      description: upgrade.description,
      family: upgrade.family,
      label: className === undefined ? label : `${label} · ${className}`,
      rank: rankOf(upgrade.family, stacks, upgrade.maxStacks),
      tint: upgrade.family === 'relic' || offer.kind === 'relic' ? 'relic' : rarity,
      rarityLabel: upgrade.family === 'relic' ? null : RARITY_LABEL[rarity],
    };
  }
  const weapon = content.weapons?.find((entry) => entry.id === id);
  if (weapon === undefined) {
    throw new Error(`Unknown card "${id}": neither an upgrade nor a weapon of the content`);
  }
  if (weapon.evolvedFrom !== undefined) {
    const fusion = content.fusions?.find((entry) => entry.resultId === id);
    const from = content.weapons?.find((entry) => entry.id === weapon.evolvedFrom);
    const upgradeName = content.upgrades.find((entry) => entry.id === fusion?.upgradeId)?.name;
    if (from === undefined || upgradeName === undefined) {
      throw new Error(`Fusion card "${id}" has no fusion of a known weapon and upgrade`);
    }
    return {
      kind: 'fusion',
      id,
      name: weapon.name,
      description: weapon.description,
      weapon,
      label: 'Fusion',
      replaces: from.name,
      recipe: `${from.name} + ${upgradeName}`,
      tint: 'fusion',
      rarityLabel: null,
    };
  }
  const level = player?.weapons?.find((slot) => slot.id === id)?.level ?? 0;
  const className = content.classes.find((entry) => entry.id === weapon.classAffinity)?.name;
  return {
    kind: 'weapon',
    id,
    name: weapon.name,
    description: weapon.description,
    weapon,
    label: className === undefined ? 'Agrès' : `Agrès · ${className}`,
    rank: level === 0 ? 'Nouveau' : `Niveau ${String(level + 1)}`,
    steps: stepsOf(weapon),
    everyBars: weapon.rhythm === 'continuous' ? 1 : weapon.rhythm.everyBars,
    tint: 'common',
    rarityLabel: null,
  };
}
