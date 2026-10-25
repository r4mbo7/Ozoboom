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

const OFFER_SIZE = 3;
const MAX_WEAPONS_PER_OFFER = 2;
const DEFAULT_WEAPON_SLOTS = 3;
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

function fusionsOpen(state: SimState): boolean {
  return (state.speakers ?? []).every((speaker) => speaker.plugged);
}

function pluggedSpeakers(state: SimState): number {
  return (state.speakers ?? []).filter((speaker) => speaker.plugged).length;
}

// Draws nothing without rare nor legendary weight, so that it leaves the generator as is.
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

function hasAffinity(
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

// Unit weights consume the generator as a uniform draw would; rarity right after its upgrade (ADR 0010).
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

function relicOfferSize(state: SimState): number {
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

// A stream from the seed alone: the game's draws leave the bosses as they are, and the other way round.
export function drawBoss(seed: number, content: ResolvedContent, drawn: readonly string[]): string {
  const rng = seedRng((seed ^ BOSS_STREAM) >>> 0);
  drawn.forEach(() => nextU32(rng));
  const pool = [...content.enemies.values()]
    .filter((enemy) => enemy.behaviour === 'boss')
    .map((enemy) => enemy.id);
  const round = drawn.slice(drawn.length - (drawn.length % pool.length));
  // A new round leaves out the last boss, so that none comes twice in a row.
  const excluded = round.length > 0 ? round : drawn.slice(-1);
  const fresh = pool.filter((id) => !excluded.includes(id));
  return pick(rng, fresh.length > 0 ? fresh : pool);
}
