import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../data/content';
import type { GameContent, UpgradeDefinition } from '../../data/types';
import { EFFECTS_CONTENT, FIXTURE_CONTENT, FIXTURE_OPTIONS, actionsFor } from '../fixtures';
import { createSimulation, type Simulation, type SimulationOptions } from '../index';
import type { PlayerState } from '../state';

const upgrade = (
  id: string,
  family: UpgradeDefinition['family'],
  extra: Partial<UpgradeDefinition> = {},
): UpgradeDefinition => ({
  id,
  name: id,
  description: id,
  family,
  modifiers: [{ stat: 'damageMul', mul: 1.1 }],
  maxStacks: 2,
  ...extra,
});

const WIDE_POOL: GameContent = {
  ...EFFECTS_CONTENT,
  upgrades: [
    ...FIXTURE_CONTENT.upgrades,
    upgrade('roadie-only', 'class', { classId: 'roadie' }),
    upgrade('tough', 'generic', { maxStacks: 1 }),
    upgrade('cheap', 'defense'),
  ],
};
const RAVER_ELIGIBLE = ['quick-feet', 'big-bass', 'wide-nova', 'cheap'];

const SOIREE = CONTENT.sets.find((set) => set.id === 'soiree-v0');
if (SOIREE === undefined) {
  throw new Error('expected the soiree-v0 set');
}

const choose = (upgradeId: string) => actionsFor(0, { type: 'chooseUpgrade', upgradeId });

function soloGame(options: SimulationOptions = FIXTURE_OPTIONS): {
  simulation: Simulation;
  player: PlayerState;
} {
  const simulation = createSimulation(options);
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, player };
}

function offerAtFirstLevel(seed: number): readonly string[] {
  const { simulation, player } = soloGame({ ...FIXTURE_OPTIONS, seed, content: WIDE_POOL });
  player.upgrades.push('tough');
  player.vibes = player.vibesToNextLevel;
  simulation.step([]);
  return simulation.state.pendingUpgrades[0]?.options ?? [];
}

describe('progression', () => {
  it('does not level up below the threshold', () => {
    const { simulation, player } = soloGame();
    player.vibes = 9;

    simulation.step([]);

    expect({ level: player.level, vibes: player.vibes }).toEqual({ level: 1, vibes: 9 });
    expect(simulation.state.pendingUpgrades).toEqual([]);
    expect(simulation.state.status).toBe('running');
  });

  it('levels up at the threshold, raises the next threshold and offers upgrades', () => {
    const { simulation, player } = soloGame();
    player.vibes = 12;

    simulation.step([]);

    expect({
      level: player.level,
      vibes: player.vibes,
      vibesToNextLevel: player.vibesToNextLevel,
    }).toEqual({ level: 2, vibes: 2, vibesToNextLevel: 15 });
    expect(simulation.state.events).toContainEqual({ type: 'levelUp', playerId: 0, level: 2 });
    expect(simulation.state.pendingUpgrades).toHaveLength(1);
    expect(simulation.state.pendingUpgrades[0]?.playerId).toBe(0);
    expect(simulation.state.status).toBe('choosingUpgrade');
  });

  it('gains several levels at once, presents one offer and keeps the others pending', () => {
    const { simulation, player } = soloGame();
    player.vibes = 10 + 15 + 1;

    simulation.step([]);

    expect({ level: player.level, vibes: player.vibes }).toEqual({ level: 3, vibes: 1 });
    expect(simulation.state.events.filter((event) => event.type === 'levelUp')).toEqual([
      { type: 'levelUp', playerId: 0, level: 2 },
      { type: 'levelUp', playerId: 0, level: 3 },
    ]);
    expect(simulation.state.pendingUpgrades).toHaveLength(1);
    expect(player.pendingLevelUps).toBe(1);
  });

  it('draws each offer of a multi-level gain after the previous choice', () => {
    const { simulation, player } = soloGame();
    player.upgrades.push('wide-nova');
    player.vibes = 10 + 15 + 20;
    simulation.step([]);
    const presented: (readonly string[])[] = [];
    const queued: number[] = [];

    for (let i = 0; i < 3; i++) {
      const offer = simulation.state.pendingUpgrades;
      presented.push(offer[0]?.options ?? []);
      queued.push(offer.length);
      const options = offer[0]?.options ?? [];
      simulation.step([choose(options.includes('wide-nova') ? 'wide-nova' : (options[0] ?? ''))]);
    }

    expect(queued).toEqual([1, 1, 1]);
    expect(presented[0]).toContain('wide-nova');
    expect(presented[1]).not.toContain('wide-nova');
    expect(presented[2]).not.toContain('wide-nova');
    expect(player.upgrades).toHaveLength(4);
    expect(player.upgrades.filter((id) => id === 'wide-nova')).toHaveLength(2);
    expect(player.pendingLevelUps).toBe(0);
    expect(simulation.state.pendingUpgrades).toEqual([]);
    expect(simulation.state.status).toBe('running');
  });

  it('never stacks an upgrade past its maximum over twenty levels gained in one go', () => {
    const simulation = createSimulation({
      seed: 2026,
      players: [{ id: 0, classId: 'mage' }],
      setId: 'soiree-v0',
      content: CONTENT,
    });
    const player = simulation.state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    const stacks = (id: string) => player.upgrades.filter((owned) => owned === id).length;
    const { baseVibes, vibesPerLevel } = SOIREE.levelCurve;
    player.vibes = Array.from({ length: 20 }, (_, i) => baseVibes + vibesPerLevel * i).reduce(
      (sum, vibes) => sum + vibes,
    );

    simulation.step([]);
    for (let i = 0; i < 20; i++) {
      const options = simulation.state.pendingUpgrades[0]?.options ?? [];
      const greediest = [...options].sort((a, b) => stacks(b) - stacks(a))[0] ?? '';
      simulation.step([choose(greediest)]);
    }

    expect(player.level).toBe(21);
    expect(player.upgrades).toHaveLength(20);
    for (const upgrade of CONTENT.upgrades) {
      expect(stacks(upgrade.id)).toBeLessThanOrEqual(upgrade.maxStacks);
    }
    expect(simulation.state.status).toBe('running');
  });

  it('offers three distinct eligible upgrades, the same for the same seed', () => {
    const seeds = Array.from({ length: 40 }, (_, seed) => seed);

    const offers = seeds.map(offerAtFirstLevel);
    const again = seeds.map(offerAtFirstLevel);

    expect(again).toEqual(offers);
    for (const options of offers) {
      expect(options).toHaveLength(3);
      expect(new Set(options).size).toBe(3);
      for (const option of options) {
        expect(RAVER_ELIGIBLE).toContain(option);
      }
    }
    expect(new Set(offers.flat())).toEqual(new Set(RAVER_ELIGIBLE));
    expect(new Set(offers.map((options) => options.join())).size).toBeGreaterThan(1);
  });

  it('offers what is left when fewer than three upgrades are eligible', () => {
    const { simulation, player } = soloGame({
      ...FIXTURE_OPTIONS,
      players: [{ id: 0, classId: 'roadie' }],
      content: EFFECTS_CONTENT,
    });
    player.upgrades.push('quick-feet', 'quick-feet', 'quick-feet');
    player.vibes = 10;

    simulation.step([]);

    expect(simulation.state.pendingUpgrades).toEqual([{ playerId: 0, options: ['big-bass'] }]);
  });

  it('levels up without an offer nor a pause when no upgrade is eligible', () => {
    const { simulation, player } = soloGame();
    player.upgrades.push(
      ...Array<string>(3).fill('quick-feet'),
      ...Array<string>(3).fill('big-bass'),
    );
    player.upgrades.push('wide-nova', 'wide-nova');
    player.vibes = 10;

    simulation.step([]);

    expect(player.level).toBe(2);
    expect(simulation.state.events).toContainEqual({ type: 'levelUp', playerId: 0, level: 2 });
    expect(simulation.state.pendingUpgrades).toEqual([]);
    expect(simulation.state.status).toBe('running');
  });

  it('levels every player up on their own vibes', () => {
    const simulation = createSimulation({
      ...FIXTURE_OPTIONS,
      players: [
        { id: 0, classId: 'raver' },
        { id: 1, classId: 'raver' },
      ],
    });
    const [first, second] = simulation.state.players;
    if (first === undefined || second === undefined) {
      throw new Error('expected two players');
    }
    second.vibes = 10;

    simulation.step([]);

    expect([first.level, second.level]).toEqual([1, 2]);
    expect(simulation.state.pendingUpgrades.map((offer) => offer.playerId)).toEqual([1]);
  });
});
