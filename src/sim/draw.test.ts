import { describe, expect, it } from 'vitest';
import type { GameContent, UpgradeDefinition, WeaponDefinition } from '../data/types';
import { resolveContent } from './content';
import { drawOffer } from './draw';
import { FIXTURE_CONTENT, FIXTURE_OPTIONS, FIXTURE_SET } from './fixtures';
import { createSimulation } from './index';

const weapon = (id: string, extra: Partial<WeaponDefinition> = {}): WeaponDefinition => ({
  id,
  name: id,
  description: id,
  rhythm: 'continuous',
  effect: { kind: 'sweep', damage: 1, radius: 10, arcDegrees: 90 },
  maxLevel: 3,
  levelMul: 1.5,
  ...extra,
});

const upgrade = (id: string, extra: Partial<UpgradeDefinition> = {}): UpgradeDefinition => ({
  id,
  name: id,
  description: id,
  family: 'generic',
  modifiers: [{ stat: 'speedMul', mul: 1.1 }],
  maxStacks: 1,
  ...extra,
});

function setup(upgrades: UpgradeDefinition[], weapons: WeaponDefinition[], slots = 3) {
  const set = { ...FIXTURE_SET, weaponSlots: slots };
  const content: GameContent = { ...FIXTURE_CONTENT, upgrades, weapons, sets: [set] };
  const { state } = createSimulation({ ...FIXTURE_OPTIONS, content });
  const player = state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  const resolved = resolveContent(content);
  const draw = (): string[] => drawOffer(state.rng, state, resolved, set, player);
  return { state, player, draw };
}

function seen(draw: () => string[], times: number): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < times; i++) {
    draw().forEach((id) => ids.add(id));
  }
  return ids;
}

describe('draw', () => {
  const tiered = [
    upgrade('common'),
    upgrade('other'),
    upgrade('third'),
    upgrade('rare', { rarity: 'rare' }),
    upgrade('legend', { rarity: 'legendary' }),
  ];

  it('offers neither rare nor legendary upgrades without Volume', () => {
    const { draw } = setup(tiered, []);

    expect(seen(draw, 200)).toEqual(new Set(['common', 'other', 'third']));
  });

  it('opens rare upgrades at Volume 2 and legendary ones at Volume 3', () => {
    const { state, draw } = setup(tiered, []);

    state.volume = 2;
    const atTwo = seen(draw, 200);
    state.volume = 3;
    const atThree = seen(draw, 200);

    expect(atTwo).toEqual(new Set(['common', 'other', 'third', 'rare']));
    expect(atThree).toEqual(new Set(['common', 'other', 'third', 'rare', 'legend']));
  });

  it('doubles the frequency of a weapon with the class affinity', () => {
    const { draw } = setup([], [weapon('fond', { classAffinity: 'raver' }), weapon('other')]);
    const first = { fond: 0, other: 0 };

    for (let i = 0; i < 10_000; i++) {
      first[draw()[0] as 'fond' | 'other'] += 1;
    }

    expect(first.fond / first.other).toBeGreaterThan(1.8);
    expect(first.fond / first.other).toBeLessThan(2.2);
  });

  it('proposes only level ups once every slot is full', () => {
    const { player, draw } = setup(
      [upgrade('common')],
      [weapon('a'), weapon('b'), weapon('c'), weapon('d')],
      3,
    );
    player.weapons = [
      { id: 'a', level: 1, phase: 0 },
      { id: 'b', level: 3, phase: 0 },
      { id: 'c', level: 1, phase: 0 },
    ];

    expect(seen(draw, 100)).toEqual(new Set(['common', 'a', 'c']));
  });

  it('opens a speaker-locked weapon only with as many plugged speakers', () => {
    const { state, draw } = setup([], [weapon('ribbon', { unlockedBySpeakers: 4 })]);
    const plugged = () => ({ id: 's', x: 0, y: 0, radius: 1, plugTicks: 0, plugged: true });

    state.speakers = [plugged(), plugged(), plugged()];
    const withThree = draw();
    state.speakers = [plugged(), plugged(), plugged(), plugged()];
    const withFour = draw();

    expect(withThree).toEqual([]);
    expect(withFour).toEqual(['ribbon']);
  });

  it('never draws a relic in a level offer', () => {
    const { draw } = setup([upgrade('common'), upgrade('relic', { family: 'relic' })], []);

    expect(seen(draw, 50)).toEqual(new Set(['common']));
  });

  it('never draws an evolved form', () => {
    const { draw } = setup([], [weapon('base'), weapon('evolved', { evolvedFrom: 'base' })]);

    expect(seen(draw, 50)).toEqual(new Set(['base']));
  });
});
