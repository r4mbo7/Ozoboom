import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { RARITY_WEIGHTS } from '../data/upgrades';
import type {
  GameContent,
  SetDefinition,
  UpgradeDefinition,
  WeaponDefinition,
} from '../data/types';
import { resolveContent } from './content';
import { drawOffer } from './draw';
import { FIXTURE_CONTENT, FIXTURE_OPTIONS, FIXTURE_SET } from './fixtures';
import { createSimulation } from './index';
import type { UpgradeOffer } from './state';

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

const tiered = (id: string): UpgradeDefinition =>
  upgrade(id, {
    rarities: {
      rare: { description: `${id} rare`, modifiers: [{ stat: 'speedMul', mul: 1.2 }] },
      legendary: { description: `${id} legendary`, modifiers: [{ stat: 'speedMul', mul: 1.3 }] },
    },
    maxStacks: 3,
  });

function setup(
  upgrades: UpgradeDefinition[],
  weapons: WeaponDefinition[],
  slots = 3,
  fusions: GameContent['fusions'] = [],
  speakers: SetDefinition['speakers'] = [],
) {
  const set = { ...FIXTURE_SET, weaponSlots: slots, speakers };
  const content: GameContent = {
    ...FIXTURE_CONTENT,
    upgrades,
    weapons,
    fusions,
    sets: [set],
    rarityWeights: RARITY_WEIGHTS,
  };
  const { state } = createSimulation({ ...FIXTURE_OPTIONS, content });
  const player = state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  const resolved = resolveContent(content);
  const offer = (): Omit<UpgradeOffer, 'playerId'> =>
    drawOffer(state.rng, state, resolved, set, player);
  const draw = (): string[] => [...offer().options];
  return { state, player, draw, offer };
}

function rarityCounts(offer: () => Omit<UpgradeOffer, 'playerId'>, times: number) {
  const counts = { common: 0, rare: 0, legendary: 0 };
  for (let i = 0; i < times; i++) {
    offer().rarities.forEach((rarity) => (counts[rarity] += 1));
  }
  return counts;
}

function seen(draw: () => string[], times: number): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < times; i++) {
    draw().forEach((id) => ids.add(id));
  }
  return ids;
}

describe('draw', () => {
  it('never offers the same upgrade twice, at any Volume and for any seed', () => {
    const resolved = resolveContent(CONTENT);
    const set = CONTENT.sets[0];
    if (set === undefined) {
      throw new Error('expected a set');
    }
    const repeated: string[][] = [];

    for (let seed = 1; seed <= 300; seed++) {
      const { state } = createSimulation({
        seed,
        content: CONTENT,
        setId: set.id,
        players: [{ id: 0, classId: CONTENT.classes[seed % CONTENT.classes.length]?.id ?? '' }],
      });
      const player = state.players[0];
      if (player === undefined) {
        throw new Error('expected a player');
      }
      state.volume = seed % 6;
      const { options } = drawOffer(state.rng, state, resolved, set, player);
      if (new Set(options).size !== options.length) {
        repeated.push([...options]);
      }
    }

    expect(repeated).toEqual([]);
  });

  it('draws every upgrade common at Volume 0 and 1', () => {
    const { state, offer } = setup([tiered('a'), tiered('b'), tiered('c')], []);

    const atZero = rarityCounts(offer, 300);
    state.volume = 1;
    const atOne = rarityCounts(offer, 300);

    expect(atZero).toEqual({ common: 900, rare: 0, legendary: 0 });
    expect(atOne).toEqual({ common: 900, rare: 0, legendary: 0 });
  });

  it('opens rares at Volume 2, legendaries at Volume 3, with the weights of the data', () => {
    const { state, offer } = setup([tiered('a'), tiered('b'), tiered('c')], []);

    state.volume = 2;
    const atTwo = rarityCounts(offer, 2000);
    state.volume = 9;
    const beyond = rarityCounts(offer, 2000);

    expect(atTwo.legendary).toBe(0);
    expect(atTwo.rare / 6000).toBeCloseTo(0.25, 1);
    expect(beyond.rare / 6000).toBeCloseTo(0.3, 1);
    expect(beyond.legendary / 6000).toBeCloseTo(0.1, 1);
  });

  it('keeps weapons, and upgrades without rarities, common', () => {
    const { state, offer } = setup([upgrade('plain')], [weapon('a'), weapon('b')]);
    state.volume = 4;

    expect(rarityCounts(offer, 200)).toEqual({ common: 600, rare: 0, legendary: 0 });
  });

  it('keeps the share of weapons in the draw as the Volume rises', () => {
    const { state, draw } = setup(
      [tiered('a'), tiered('b'), tiered('c'), tiered('d')],
      [weapon('w1'), weapon('w2'), weapon('w3'), weapon('w4')],
    );
    const weaponShare = (): number => {
      let weapons = 0;
      for (let i = 0; i < 2000; i++) {
        weapons += draw().filter((id) => id.startsWith('w')).length;
      }
      return weapons / 6000;
    };

    const atZero = weaponShare();
    state.volume = 4;
    const atFour = weaponShare();

    expect(atFour).toBeCloseTo(atZero, 1);
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

  it('opens a weapon only once the speaker that unlocks it is plugged', () => {
    const { state, draw } = setup(
      [],
      [weapon('free'), weapon('plates')],
      3,
      [],
      [
        {
          id: 'dome',
          name: 'Dôme',
          description: 'Dôme',
          x: 10,
          y: 10,
          radius: 5,
          plugBars: 1,
          aura: { kind: 'mist', slowFactor: 1, healPerBar: 0, radius: 10 },
          unlocksWeaponId: 'plates',
        },
      ],
    );

    const unplugged = seen(draw, 50);
    state.speakers = (state.speakers ?? []).map((speaker) => ({ ...speaker, plugged: true }));

    expect(unplugged).toEqual(new Set(['free']));
    expect(seen(draw, 50)).toEqual(new Set(['free', 'plates']));
  });

  it('holds a fusion back until every speaker of the set is plugged', () => {
    const { state, player, draw } = setup(
      [upgrade('twin')],
      [weapon('base', { maxLevel: 1 }), weapon('fused', { evolvedFrom: 'base' })],
      3,
      [{ weaponId: 'base', upgradeId: 'twin', resultId: 'fused' }],
      [
        {
          id: 'dome',
          name: 'Dôme',
          description: 'Dôme',
          x: 10,
          y: 10,
          radius: 5,
          plugBars: 1,
          aura: { kind: 'mist', slowFactor: 1, healPerBar: 0, radius: 10 },
        },
      ],
    );
    player.weapons = [{ id: 'base', level: 1, phase: 0 }];
    player.upgrades = ['twin'];

    const unplugged = seen(draw, 30);
    state.speakers = (state.speakers ?? []).map((speaker) => ({ ...speaker, plugged: true }));

    expect(unplugged.has('fused')).toBe(false);
    expect(seen(draw, 30).has('fused')).toBe(true);
  });

  it('never draws a relic in a level offer', () => {
    const { draw } = setup([upgrade('common'), upgrade('relic', { family: 'relic' })], []);

    expect(seen(draw, 50)).toEqual(new Set(['common']));
  });

  it('never draws an evolved form', () => {
    const { draw } = setup([], [weapon('base'), weapon('evolved', { evolvedFrom: 'base' })]);

    expect(seen(draw, 50)).toEqual(new Set(['base']));
  });

  it('draws an open fusion three times as often as a plain card', () => {
    const { player, draw } = setup(
      [upgrade('plain'), upgrade('twin')],
      [weapon('base', { maxLevel: 1 }), weapon('fused', { evolvedFrom: 'base' })],
      3,
      [{ weaponId: 'base', upgradeId: 'twin', resultId: 'fused' }],
    );
    player.weapons = [{ id: 'base', level: 1, phase: 0 }];
    player.upgrades = ['twin'];
    const first = { plain: 0, fused: 0 };

    for (let i = 0; i < 10_000; i++) {
      const [pick] = draw();
      if (pick === 'plain' || pick === 'fused') {
        first[pick] += 1;
      }
    }

    expect(first.fused / first.plain).toBeGreaterThan(2.7);
    expect(first.fused / first.plain).toBeLessThan(3.3);
  });
});
