import { describe, expect, it } from 'vitest';
import type { TrapEffect } from '../data/types';
import { trapReach } from './reach';

const LASER: TrapEffect = { kind: 'beam', damagePerTick: 1, length: 360, width: 12 };
const SUBWOOFER: TrapEffect = { kind: 'shockwave', damage: 6, radius: 110, knockback: 24 };

describe('trapReach', () => {
  it('draws the laser as long as its owner trapRadiusMul makes it reach', () => {
    const owner = { modifiers: { trapRadiusMul: 1.5 } };

    const length = trapReach(LASER, owner);

    expect(length).toBe(1.5 * 360);
  });

  it('draws the shockwave as wide as its owner trapRadiusMul makes it reach', () => {
    const owner = { modifiers: { trapRadiusMul: 1.5 } };

    const radius = trapReach(SUBWOOFER, owner);

    expect(radius).toBe(1.5 * 110);
  });

  it('draws the base reach when the owner has no trapRadiusMul', () => {
    const owner = { modifiers: {} };

    expect(trapReach(LASER, owner)).toBe(360);
    expect(trapReach(SUBWOOFER, owner)).toBe(110);
  });
});
