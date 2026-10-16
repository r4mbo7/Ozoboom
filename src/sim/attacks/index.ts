import type { AttackDefinition } from '../../data/types';
import { FULL_ATTACKS } from '../full';
import { straight } from './straight';
import type { AttackModule, AttackModules, Upgraded } from './types';

// One module per attack kind, one file each; those of the full game come from `FULL_ATTACKS`.
export const ATTACKS: AttackModules = { straight, ...FULL_ATTACKS };

const NO_UPGRADE: Upgraded = { modifiers: {} };

export function attackModule(attack: AttackDefinition): AttackModule<AttackDefinition> {
  return ATTACKS[attack.kind];
}

// 0 for an attack that does not charge.
export function attackChargeTicks(attack: AttackDefinition): number {
  return attackModule(attack).chargeTicks?.(attack) ?? 0;
}

export function attackReach(attack: AttackDefinition, player: Upgraded = NO_UPGRADE): number {
  return attackModule(attack).reach(attack, player);
}
