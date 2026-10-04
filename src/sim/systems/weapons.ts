import type { WeaponEffect } from '../../data/types';
import { boomerang } from '../weapons/boomerang';
import { hoop } from '../weapons/hoop';
import { lob } from '../weapons/lob';
import { orbit } from '../weapons/orbit';
import { plate } from '../weapons/plate';
import { ribbon } from '../weapons/ribbon';
import { spark } from '../weapons/spark';
import { sweep } from '../weapons/sweep';
import { totem } from '../weapons/totem';
import { trail } from '../weapons/trail';
import type { WeaponModule } from '../weapons/types';
import type { StepContext } from './types';

// One module per effect kind; an issue replaces its own module and touches this registry only on
// its line (docs/plans/v0.1.md). All inert until then.
export const WEAPONS: Readonly<Record<WeaponEffect['kind'], WeaponModule>> = {
  sweep,
  spark,
  hoop,
  lob,
  boomerang,
  plate,
  totem,
  orbit,
  trail,
  ribbon,
};

export function weapons(ctx: StepContext): void {
  const { state, content } = ctx;
  for (const player of state.players) {
    for (const slot of player.weapons ?? []) {
      const definition = content.weapons.get(slot.id);
      if (definition === undefined) {
        continue;
      }
      WEAPONS[definition.effect.kind].fire(ctx, player, slot, definition);
    }
  }
}
