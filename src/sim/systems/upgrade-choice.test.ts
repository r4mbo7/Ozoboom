import { describe, expect, it } from 'vitest';
import type { GameContent, Rarity } from '../../data/types';
import { FIXTURE_CONTENT, FIXTURE_OPTIONS, actionsFor, commandFor } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { PlayerState } from '../state';

const WITH_TOUGH: GameContent = {
  ...FIXTURE_CONTENT,
  upgrades: [
    ...FIXTURE_CONTENT.upgrades,
    {
      id: 'tough',
      name: 'Coriace',
      description: 'Plus de vie.',
      family: 'generic',
      modifiers: [{ stat: 'maxHpAdd', add: 20 }],
      rarities: {
        rare: { description: 'Bien plus de vie.', modifiers: [{ stat: 'maxHpAdd', add: 40 }] },
        legendary: {
          description: 'Énormément de vie.',
          modifiers: [{ stat: 'maxHpAdd', add: 60 }],
        },
      },
      maxStacks: 2,
    },
  ],
};

const commons = (options: readonly string[]): Rarity[] => options.map(() => 'common');

function pausedOnOffer(
  options: readonly string[],
  content: GameContent = FIXTURE_CONTENT,
  rarities: readonly Rarity[] = commons(options),
): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation({ ...FIXTURE_OPTIONS, content });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  simulation.step([]);
  simulation.state.pendingUpgrades.push({ playerId: 0, options, rarities });
  simulation.step([]);
  return { simulation, player };
}

const choose = (upgradeId: string) => actionsFor(0, { type: 'chooseUpgrade', upgradeId });

describe('upgrade choice', () => {
  it('pauses at the vibes threshold and resumes on the tick after a valid choice', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    const player = simulation.state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    player.vibes = 10;
    simulation.step([]);
    const offered = simulation.state.pendingUpgrades[0]?.options[0] ?? '';
    const pausedAt = simulation.state.tick;

    simulation.step([commandFor(0, { move: { x: 1, y: 0 } })]);
    simulation.step([commandFor(0, { move: { x: 1, y: 0 } })]);
    const whilePaused = { tick: simulation.state.tick, status: simulation.state.status };
    simulation.step([choose(offered)]);
    const onChoice = { tick: simulation.state.tick, status: simulation.state.status };
    simulation.step([]);

    expect(whilePaused).toEqual({ tick: pausedAt, status: 'choosingUpgrade' });
    expect(onChoice).toEqual({ tick: pausedAt, status: 'running' });
    expect(simulation.state.tick).toBe(pausedAt + 1);
  });

  it('applies the chosen upgrade, records it and withdraws the offer', () => {
    const { simulation, player } = pausedOnOffer(['quick-feet', 'big-bass']);

    simulation.step([choose('quick-feet')]);

    expect(player.upgrades).toEqual(['quick-feet']);
    expect(player.modifiers).toEqual({ speedMul: 1.15 });
    expect(player.speed).toBeCloseTo(4.6, 12);
    expect(simulation.state.events).toEqual([
      { type: 'upgradeChosen', playerId: 0, upgradeId: 'quick-feet' },
    ]);
    expect(simulation.state.pendingUpgrades).toEqual([]);
  });

  it('applies the modifiers of the rarity offered and records that rarity', () => {
    const { simulation, player } = pausedOnOffer(['quick-feet', 'tough'], WITH_TOUGH, [
      'common',
      'rare',
    ]);
    const maxHp = player.maxHp;

    simulation.step([choose('tough')]);

    expect(player.upgrades).toEqual(['tough']);
    expect(player.upgradeRarities).toEqual(['rare']);
    expect(player.maxHp).toBe(maxHp + 40);
  });

  it('counts the stacks of every rarity against the maximum', () => {
    const { simulation, player } = pausedOnOffer(['tough'], WITH_TOUGH, ['legendary']);
    player.upgrades.push('tough', 'tough');

    simulation.step([choose('tough')]);

    expect(player.upgrades).toEqual(['tough', 'tough']);
    expect(simulation.state.status).toBe('choosingUpgrade');
  });

  it('ignores an upgrade outside the offer without error', () => {
    const { simulation, player } = pausedOnOffer(['quick-feet', 'big-bass']);

    simulation.step([choose('wide-nova')]);
    simulation.step([choose('no-such-upgrade')]);

    expect(player.upgrades).toEqual([]);
    expect(simulation.state.events).toEqual([]);
    expect(simulation.state.pendingUpgrades).toEqual([
      { playerId: 0, options: ['quick-feet', 'big-bass'], rarities: ['common', 'common'] },
    ]);
    expect(simulation.state.status).toBe('choosingUpgrade');
  });

  it('refuses an offered upgrade that already reached its maximum stacks', () => {
    const { simulation, player } = pausedOnOffer(['wide-nova', 'quick-feet']);
    player.upgrades.push('wide-nova', 'wide-nova');

    simulation.step([choose('wide-nova')]);

    expect(player.upgrades).toEqual(['wide-nova', 'wide-nova']);
    expect(simulation.state.events).toEqual([]);
    expect(simulation.state.pendingUpgrades).toEqual([
      { playerId: 0, options: ['wide-nova', 'quick-feet'], rarities: ['common', 'common'] },
    ]);
  });

  it('lets a player answer only their own offer and waits for every offer', () => {
    const simulation = createSimulation({
      ...FIXTURE_OPTIONS,
      players: [
        { id: 0, classId: 'raver' },
        { id: 1, classId: 'raver' },
      ],
    });
    simulation.state.pendingUpgrades.push(
      { playerId: 0, options: ['quick-feet'], rarities: ['common'] },
      { playerId: 1, options: ['big-bass'], rarities: ['common'] },
    );
    simulation.step([]);

    simulation.step([actionsFor(1, { type: 'chooseUpgrade', upgradeId: 'quick-feet' })]);
    const afterWrongPlayer = simulation.state.pendingUpgrades.length;
    simulation.step([choose('quick-feet')]);
    const afterFirst = simulation.state.status;
    simulation.step([actionsFor(1, { type: 'chooseUpgrade', upgradeId: 'big-bass' })]);

    expect(afterWrongPlayer).toBe(2);
    expect(afterFirst).toBe('choosingUpgrade');
    expect(simulation.state.status).toBe('running');
    expect(simulation.state.players.map((player) => player.upgrades)).toEqual([
      ['quick-feet'],
      ['big-bass'],
    ]);
  });

  it('gives the max hp gained by an upgrade to the current hp', () => {
    const { simulation, player } = pausedOnOffer(['tough'], WITH_TOUGH);
    player.hp = 50;

    simulation.step([choose('tough')]);

    expect({ hp: player.hp, maxHp: player.maxHp }).toEqual({ hp: 70, maxHp: 120 });
  });
});
