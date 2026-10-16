import type { GameContent, Rarity, UpgradeFamily, WeaponDefinition } from '../data/types';
import type { PlayerId, PlayerState, SimEvent, UpgradeOffer } from '../sim/state';
import { t } from '../shared/i18n';
import { upgradeForm } from '../sim/stats';
import { formatNumber } from './format';

export const SIXTEENTHS_PER_BAR = 16;

const familyLabels = (): Record<UpgradeFamily, string> => ({
  class: t('Classe'),
  generic: t('Générique'),
  defense: t('Défense'),
  relic: t('Relique'),
});

const rarityLabels = (): Record<Rarity, string | null> => ({
  common: null,
  rare: t('Rare'),
  legendary: t('Légendaire'),
});

export type CardTint = 'common' | 'rare' | 'legendary' | 'relic' | 'fusion';

// The rank a card gives, out of how many: one pearl per rank, and the words that say it.
export interface Pearls {
  rank: number;
  max: number;
  label: string;
}

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
  // A relic comes once, from a boss: it has no rank to tell.
  pearls: Pearls | null;
}

export interface WeaponCard extends CardBase {
  kind: 'weapon';
  weapon: WeaponDefinition;
  label: string;
  rank: string;
  pearls: Pearls;
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
  return offer.kind === 'relic' ? t('Le boss lâche une relique') : t('Choisis ton amélioration');
}

export function offerKicker(offer: UpgradeOffer, player: PlayerState | undefined): string {
  if (offer.kind === 'relic') {
    return t('Boss vaincu');
  }
  return player === undefined
    ? t('Niveau supérieur')
    : t('Niveau {level}', { level: formatNumber(player.level) });
}

export function stepsOf(weapon: WeaponDefinition): readonly boolean[] | 'continuous' {
  if (weapon.rhythm === 'continuous') {
    return 'continuous';
  }
  const { steps } = weapon.rhythm;
  return Array.from({ length: SIXTEENTHS_PER_BAR }, (_, step) => steps.includes(step));
}

function rankOf(family: UpgradeFamily, stacks: number): string {
  if (family === 'relic') {
    return '';
  }
  return stacks === 0 ? t('Nouveau') : t('Rang {rank}', { rank: formatNumber(stacks + 1) });
}

export function cardFor(
  id: string,
  offer: UpgradeOffer,
  player: PlayerState | undefined,
  content: GameContent,
): Card {
  const upgrade = content.upgrades.find((entry) => entry.id === id);
  if (upgrade !== undefined) {
    const rarity = offer.rarities[offer.options.indexOf(id)] ?? 'common';
    const className =
      upgrade.family === 'class'
        ? content.classes.find((entry) => entry.id === upgrade.classId)?.name
        : undefined;
    const stacks = player?.upgrades.filter((held) => held === id).length ?? 0;
    const rank = stacks + 1;
    return {
      kind: 'upgrade',
      id,
      name: t(upgrade.name),
      description: t(upgradeForm(upgrade, rarity).description),
      family: upgrade.family,
      label:
        className === undefined
          ? familyLabels()[upgrade.family]
          : t('Classe · {className}', { className: t(className) }),
      rank: rankOf(upgrade.family, stacks),
      pearls:
        upgrade.family === 'relic'
          ? null
          : {
              rank,
              max: upgrade.maxStacks,
              label: t('Rang {rank} sur {max}', {
                rank: formatNumber(rank),
                max: formatNumber(upgrade.maxStacks),
              }),
            },
      tint: upgrade.family === 'relic' || offer.kind === 'relic' ? 'relic' : rarity,
      rarityLabel: upgrade.family === 'relic' ? null : rarityLabels()[rarity],
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
      name: t(weapon.name),
      description: t(weapon.description),
      weapon,
      label: t('Fusion'),
      replaces: t(from.name),
      recipe: t('{weapon} + {upgrade}', { weapon: t(from.name), upgrade: t(upgradeName) }),
      tint: 'fusion',
      rarityLabel: null,
    };
  }
  const level = player?.weapons?.find((slot) => slot.id === id)?.level ?? 0;
  const next = formatNumber(level + 1);
  const className = content.classes.find((entry) => entry.id === weapon.classAffinity)?.name;
  return {
    kind: 'weapon',
    id,
    name: t(weapon.name),
    description: t(weapon.description),
    weapon,
    label:
      className === undefined ? t('Agrès') : t('Agrès · {className}', { className: t(className) }),
    rank: level === 0 ? t('Nouveau') : t('Niveau {level}', { level: next }),
    pearls: {
      rank: level + 1,
      max: weapon.maxLevel,
      label: t('Niveau {level} sur {max}', { level: next, max: formatNumber(weapon.maxLevel) }),
    },
    steps: stepsOf(weapon),
    everyBars: weapon.rhythm === 'continuous' ? 1 : weapon.rhythm.everyBars,
    tint: 'common',
    rarityLabel: null,
  };
}

export function cardName(id: string, content: GameContent): string {
  const name =
    content.upgrades.find((entry) => entry.id === id)?.name ??
    content.weapons?.find((entry) => entry.id === id)?.name;
  return name === undefined ? id : t(name);
}

export type Celebrated = 'rare' | 'legendary';

export interface Dealt {
  // The place of the card in its offer.
  index: number;
  delayMs: number;
  celebrated: Celebrated | null;
}

const DEAL_STAGGER_MS = 150;
const DEAL_SPAN_MS = 300;
const CELEBRATED: Partial<Record<CardTint, number>> = { rare: 1, legendary: 2 };

// The cards fall one by one inside the grace of the menu, the rarest last.
export function dealOf(tints: readonly CardTint[]): Dealt[] {
  const stagger = Math.min(DEAL_STAGGER_MS, DEAL_SPAN_MS / Math.max(1, tints.length - 1));
  return tints
    .map((tint, index) => ({ tint, index }))
    .sort((a, b) => (CELEBRATED[a.tint] ?? 0) - (CELEBRATED[b.tint] ?? 0))
    .map(({ tint, index }, turn) => ({
      index,
      delayMs: turn * stagger,
      celebrated: tint === 'rare' || tint === 'legendary' ? tint : null,
    }));
}

// The card a player has just taken, whatever its kind.
export function pickOf(event: SimEvent): { playerId: PlayerId; cardId: string } | null {
  switch (event.type) {
    case 'upgradeChosen':
      return { playerId: event.playerId, cardId: event.upgradeId };
    case 'weaponGained':
      return { playerId: event.playerId, cardId: event.weaponId };
    case 'weaponEvolved':
      return { playerId: event.playerId, cardId: event.resultId };
    default:
      return null;
  }
}

function listOf(names: readonly string[]): string {
  const last = names.at(-1);
  return names.length < 2 || last === undefined
    ? names.join('')
    : t('{names} et {last}', { names: names.slice(0, -1).join(', '), last });
}

// A player of another screen: still choosing, or the name of the card taken.
export interface RemoteChoice {
  name: string;
  classId: string;
  picked: string | null;
}

export interface WaitChip {
  text: string;
  // Once the choice is made, the chip takes the colour and the mark of that class.
  classId: string | null;
}

export interface Waiting {
  // One chip per remote player of this offer.
  chips: WaitChip[];
  // Once every player of this screen has chosen: who the set waits for.
  waiting: string | null;
}

export function waitingFor(remote: readonly RemoteChoice[], localsDone: boolean): Waiting {
  const choosing = remote.filter((player) => player.picked === null).map((player) => player.name);
  return {
    chips: remote.map((player) =>
      player.picked === null
        ? { text: t('{name} choisit…', { name: player.name }), classId: null }
        : {
            text: t('{name} : {card}', { name: player.name, card: player.picked }),
            classId: player.classId,
          },
    ),
    waiting:
      choosing.length > 0 && localsDone
        ? t('En attente de {players}', { players: listOf(choosing) })
        : null,
  };
}
