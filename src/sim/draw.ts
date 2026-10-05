import type {
  FusionDefinition,
  SetDefinition,
  UpgradeDefinition,
  WeaponDefinition,
} from '../data/types';
import { nextInt } from '../shared/prng';
import type { ResolvedContent } from './content';
import type { PlayerState, RngState, SimState } from './state';

export const OFFER_SIZE = 3;
export const DEFAULT_WEAPON_SLOTS = 3;
const RARE_FROM_VOLUME = 2;
const LEGENDARY_FROM_VOLUME = 3;
const AFFINITY_WEIGHT = 2;
const FUSION_WEIGHT = 3;

interface Candidate {
  id: string;
  weight: number;
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

function isRarityOpen(upgrade: UpgradeDefinition, volume: number): boolean {
  switch (upgrade.rarity) {
    case 'rare':
      return volume >= RARE_FROM_VOLUME;
    case 'legendary':
      return volume >= LEGENDARY_FROM_VOLUME;
    default:
      return true;
  }
}

function candidates(
  state: SimState,
  content: ResolvedContent,
  set: SetDefinition,
  player: PlayerState,
): Candidate[] {
  const volume = state.volume ?? 0;
  const pool: Candidate[] = [];
  for (const upgrade of content.upgrades.values()) {
    if (
      upgrade.family !== 'relic' &&
      isEligible(upgrade, player) &&
      isRarityOpen(upgrade, volume)
    ) {
      pool.push({ id: upgrade.id, weight: 1 });
    }
  }
  for (const weapon of content.weapons.values()) {
    if (openFusion(weapon, player, state, content) !== undefined) {
      pool.push({ id: weapon.id, weight: FUSION_WEIGHT });
    } else if (isWeaponOffered(weapon, player, state, set)) {
      const weight = weapon.classAffinity === player.classId ? AFFINITY_WEIGHT : 1;
      pool.push({ id: weapon.id, weight });
    }
  }
  return pool;
}

// Weighted draw without replacement; a pool of unit weights consumes the generator exactly as a
// uniform draw would.
export function drawOffer(
  rng: RngState,
  state: SimState,
  content: ResolvedContent,
  set: SetDefinition,
  player: PlayerState,
): string[] {
  const pool = candidates(state, content, set, player);
  let total = pool.reduce((sum, candidate) => sum + candidate.weight, 0);
  const offer: string[] = [];
  while (offer.length < OFFER_SIZE && pool.length > 0) {
    let roll = nextInt(rng, total);
    let index = 0;
    while (roll >= (pool[index]?.weight ?? 0)) {
      roll -= pool[index]?.weight ?? 0;
      index += 1;
    }
    const [picked] = pool.splice(index, 1);
    if (picked !== undefined) {
      offer.push(picked.id);
      total -= picked.weight;
    }
  }
  return offer;
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
