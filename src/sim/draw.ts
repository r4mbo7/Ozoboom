import type {
  FusionDefinition,
  Rarity,
  RarityWeights,
  SetDefinition,
  UpgradeDefinition,
  WeaponDefinition,
} from '../data/types';
import { nextInt, nextU32, pick, seedRng } from '../shared/prng';
import type { ResolvedContent } from './content';
import type { PlayerState, RngState, SimState, UpgradeOffer } from './state';

export const OFFER_SIZE = 3;
// Circus weapons in one offer, fusions included: the rest of it are upgrades.
export const MAX_WEAPONS_PER_OFFER = 2;
export const DEFAULT_WEAPON_SLOTS = 3;
const AFFINITY_WEIGHT = 2;
const FUSION_WEIGHT = 3;

interface Candidate {
  id: string;
  weight: number;
  weapon?: true;
}

export function isEligible(upgrade: UpgradeDefinition, player: PlayerState): boolean {
  if (upgrade.family === 'class' && upgrade.classId !== player.classId) {
    return false;
  }
  const stacks = player.upgrades.filter((id) => id === upgrade.id).length;
  return stacks < upgrade.maxStacks;
}

// The recipe that turns `weapon`, a fused form, out of what the player holds: the base weapon at
// its maximum level and the upgrade at its maximum stacks, a recipe serving once per player.
export function openFusion(
  weapon: WeaponDefinition,
  player: PlayerState,
  state: SimState,
  content: ResolvedContent,
): FusionDefinition | undefined {
  if (
    weapon.evolvedFrom === undefined ||
    player.fused?.includes(weapon.id) ||
    !fusionsOpen(state)
  ) {
    return undefined;
  }
  return content.fusions.find((fusion) => {
    const base = content.weapons.get(fusion.weaponId);
    const upgrade = content.upgrades.get(fusion.upgradeId);
    const held = player.weapons?.find((slot) => slot.id === fusion.weaponId);
    return (
      fusion.resultId === weapon.id &&
      base !== undefined &&
      upgrade !== undefined &&
      held !== undefined &&
      held.level >= base.maxLevel &&
      player.upgrades.filter((id) => id === upgrade.id).length >= upgrade.maxStacks
    );
  });
}

export function weaponSlotCount(set: SetDefinition): number {
  return set.weaponSlots ?? DEFAULT_WEAPON_SLOTS;
}

// A held weapon is offered as a level up, a new one only while a slot is free.
export function isWeaponOffered(
  weapon: WeaponDefinition,
  player: PlayerState,
  state: SimState,
  set: SetDefinition,
): boolean {
  const held = player.weapons?.find((slot) => slot.id === weapon.id);
  if (held !== undefined) {
    return held.level < weapon.maxLevel;
  }
  if (weapon.evolvedFrom !== undefined || (player.weapons?.length ?? 0) >= weaponSlotCount(set)) {
    return false;
  }
  const opener = (set.speakers ?? []).find((speaker) => speaker.unlocksWeaponId === weapon.id);
  if (opener !== undefined && !isPlugged(state, opener.id)) {
    return false;
  }
  return (weapon.unlockedBySpeakers ?? 0) <= pluggedSpeakers(state);
}

function isPlugged(state: SimState, speakerId: string): boolean {
  return (state.speakers ?? []).some((speaker) => speaker.id === speakerId && speaker.plugged);
}

// Every speaker of the set plugged opens the fusions; a set without speakers never holds them back.
function fusionsOpen(state: SimState): boolean {
  return (state.speakers ?? []).every((speaker) => speaker.plugged);
}

function pluggedSpeakers(state: SimState): number {
  return (state.speakers ?? []).filter((speaker) => speaker.plugged).length;
}

// A Volume without rare nor legendary weight draws nothing, so that it leaves the generator as is.
function drawRarity(rng: RngState, weights: RarityWeights | undefined): Rarity {
  if (weights === undefined || weights.rare + weights.legendary === 0) {
    return 'common';
  }
  const roll = nextInt(rng, weights.common + weights.rare + weights.legendary);
  if (roll < weights.common) {
    return 'common';
  }
  return roll < weights.common + weights.rare ? 'rare' : 'legendary';
}

// A weapon is drawn more often for the class of its `classAffinity` and for those that list it.
export function hasAffinity(
  content: Pick<ResolvedContent, 'classes'>,
  weapon: WeaponDefinition,
  classId: string,
): boolean {
  return (
    weapon.classAffinity === classId ||
    content.classes.get(classId)?.affinityWeaponIds?.includes(weapon.id) === true
  );
}

function candidates(
  state: SimState,
  content: ResolvedContent,
  set: SetDefinition,
  player: PlayerState,
): Candidate[] {
  const pool: Candidate[] = [];
  for (const upgrade of content.upgrades.values()) {
    if (upgrade.family !== 'relic' && isEligible(upgrade, player)) {
      pool.push({ id: upgrade.id, weight: 1 });
    }
  }
  const excluded = content.classes.get(player.classId)?.excludedWeaponIds;
  for (const weapon of content.weapons.values()) {
    if (excluded?.includes(weapon.id) === true) {
      continue;
    }
    if (openFusion(weapon, player, state, content) !== undefined) {
      pool.push({ id: weapon.id, weight: FUSION_WEIGHT, weapon: true });
    } else if (isWeaponOffered(weapon, player, state, set)) {
      const weight = hasAffinity(content, weapon, player.classId) ? AFFINITY_WEIGHT : 1;
      pool.push({ id: weapon.id, weight, weapon: true });
    }
  }
  return pool;
}

// Weighted draw without replacement; a pool of unit weights consumes the generator exactly as a
// uniform draw would. The rarity of each upgrade is drawn right after the upgrade (ADR 0010).
export function drawOffer(
  rng: RngState,
  state: SimState,
  content: ResolvedContent,
  set: SetDefinition,
  player: PlayerState,
): Pick<UpgradeOffer, 'options' | 'rarities'> {
  const pool = candidates(state, content, set, player);
  const { rarityWeights } = content;
  const weights = rarityWeights[Math.min(state.volume ?? 0, rarityWeights.length - 1)];
  let total = pool.reduce((sum, candidate) => sum + candidate.weight, 0);
  const options: string[] = [];
  const rarities: Rarity[] = [];
  let weapons = 0;
  while (options.length < OFFER_SIZE && pool.length > 0) {
    let roll = nextInt(rng, total);
    let index = 0;
    while (roll >= (pool[index]?.weight ?? 0)) {
      roll -= pool[index]?.weight ?? 0;
      index += 1;
    }
    const [picked] = pool.splice(index, 1);
    if (picked !== undefined) {
      options.push(picked.id);
      rarities.push(
        content.upgrades.get(picked.id)?.rarities === undefined
          ? 'common'
          : drawRarity(rng, weights),
      );
      total -= picked.weight;
      weapons += picked.weapon === true ? 1 : 0;
      if (picked.weapon === true && weapons === MAX_WEAPONS_PER_OFFER) {
        total -= pool.reduce(
          (sum, candidate) => sum + (candidate.weapon ? candidate.weight : 0),
          0,
        );
        pool.splice(0, pool.length, ...pool.filter((candidate) => candidate.weapon !== true));
      }
    }
  }
  return { options, rarities };
}

export function relicOfferSize(state: SimState): number {
  return OFFER_SIZE + (state.volume ?? 0);
}

export function drawRelics(
  rng: RngState,
  state: SimState,
  content: ResolvedContent,
  player: PlayerState,
): string[] {
  const pool = [...content.upgrades.values()].filter(
    (upgrade) => upgrade.family === 'relic' && isEligible(upgrade, player),
  );
  const offer: string[] = [];
  while (offer.length < relicOfferSize(state) && pool.length > 0) {
    const [picked] = pool.splice(nextInt(rng, pool.length), 1);
    if (picked !== undefined) {
      offer.push(picked.id);
    }
  }
  return offer;
}

const BOSS_STREAM = 0xb055;

// The boss of the next drop, among the bosses of the content not drawn yet in this round. Once each
// came, a new round starts without the last one, so that no boss comes twice in a row. The n-th
// boss takes the n-th value of a stream drawn from the seed alone: what the game drew before the
// break leaves the bosses as they are, and drawing them leaves the game's generator as it is.
export function drawBoss(seed: number, content: ResolvedContent, drawn: readonly string[]): string {
  const rng = seedRng((seed ^ BOSS_STREAM) >>> 0);
  drawn.forEach(() => nextU32(rng));
  const pool = [...content.enemies.values()]
    .filter((enemy) => enemy.behaviour === 'boss')
    .map((enemy) => enemy.id);
  const round = drawn.slice(drawn.length - (drawn.length % pool.length));
  const excluded = round.length > 0 ? round : drawn.slice(-1);
  const fresh = pool.filter((id) => !excluded.includes(id));
  return pick(rng, fresh.length > 0 ? fresh : pool);
}
