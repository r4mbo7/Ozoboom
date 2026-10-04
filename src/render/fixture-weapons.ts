import type { WeaponEffect } from '../data/types';
import type { SimState } from '../sim/state';
import { WEAPONS } from '../data/weapons';

export const BASE_WEAPON_IDS = WEAPONS.filter((weapon) => weapon.evolvedFrom === undefined).map(
  (weapon) => weapon.id,
);
export const EVOLVED_WEAPON_IDS = WEAPONS.filter((weapon) => weapon.evolvedFrom !== undefined).map(
  (weapon) => weapon.id,
);

export function giveWeapons(state: SimState, ids: readonly string[]): void {
  const player = state.players[0];
  if (player !== undefined) {
    player.weapons = ids.map((id) => ({ id, level: 1, phase: 0 }));
  }
}

export function effectOf(id: string): WeaponEffect {
  const found = WEAPONS.find((weapon) => weapon.id === id);
  if (found === undefined) {
    throw new Error(`Unknown fixture weapon "${id}"`);
  }
  return found.effect;
}

// One player, all the weapons around them and nothing else: for judging a silhouette at a given size.
export function layWeaponSheet(state: SimState, diameter: number, ids: readonly string[]): void {
  state.enemies = [];
  state.projectiles = [];
  state.pickups = [];
  state.traps = [];
  const player = state.players[0];
  if (player !== undefined) {
    player.radius = diameter / 1.1;
    player.x = player.prevX = state.core.x;
    player.y = player.prevY = state.core.y + 160;
    player.aim = { x: 0, y: -1 };
  }
  giveWeapons(state, ids);
}
