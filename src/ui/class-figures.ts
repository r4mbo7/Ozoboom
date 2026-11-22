import type { AttackDefinition, WeaponDefinition, WeaponEffect } from '../data/types';
import { attackModule } from '../sim/attacks';
import type { PlayerState } from '../sim/state';
import { weaponPower } from '../sim/stats';

export const damageOf = (attack: AttackDefinition): number | undefined =>
  attackModule(attack).damage(attack);

// Shots per beat of this tempo, for an attack whose data holds its cooldown; one that strikes on the
// beat holds none.
export const rateOf = (attack: AttackDefinition, ticksPerBeat: number): number | undefined =>
  'cooldownTicks' in attack ? ticksPerBeat / attack.cooldownTicks : undefined;

interface PropFigures {
  readonly damage?: number;
  readonly range?: number;
  // On each catch, or on every bar for a zone or a trail.
  readonly heal?: number;
  readonly healsPerBar?: true;
}

export function figuresOf(effect: WeaponEffect): PropFigures {
  switch (effect.kind) {
    case 'sweep':
      return { damage: effect.damage, range: effect.radius };
    case 'spark':
      return { damage: effect.damage, range: effect.speed * effect.rangeTicks };
    case 'hoop':
      return { damage: effect.damage, range: effect.wideRadius };
    case 'lob':
      return { damage: effect.damage, range: effect.range };
    case 'boomerang':
      return { damage: effect.damage, range: effect.range, heal: effect.heal };
    case 'plate':
      return { range: effect.radius, heal: effect.healPerBar, healsPerBar: true };
    case 'totem':
      return { damage: effect.damage, range: effect.radius };
    case 'orbit':
      return { damage: effect.damage, range: effect.orbitRadius + effect.radius };
    case 'trail':
      return { heal: effect.healPerBar, healsPerBar: true };
    case 'ribbon':
      return { range: effect.length };
  }
}

// The damage of one hit of a prop at this level, as the sim deals it; null for a prop that never hits.
export function propHit(
  weapon: WeaponDefinition,
  level: number,
  { modifiers, levelPower = 1 }: Pick<PlayerState, 'modifiers' | 'levelPower'>,
): number | null {
  const { damage } = figuresOf(weapon.effect);
  if (damage === undefined) {
    return null;
  }
  return damage * weaponPower({ modifiers }, weapon, level) * levelPower;
}
