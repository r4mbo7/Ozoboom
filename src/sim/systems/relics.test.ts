import { describe, expect, it } from 'vitest';
import type { UpgradeDefinition } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { resolveContent } from '../content';
import { drawOffer } from '../draw';
import { COMBAT_CONTENT, COMBAT_OPTIONS, actionsFor, placeEnemy } from '../fixtures';
import { createSimulation, type Simulation } from '../index';

const relic = (id: string): UpgradeDefinition => ({
  id,
  name: id,
  description: id,
  family: 'relic',
  modifiers: [{ stat: 'damageMul', mul: 1.5 }],
  maxStacks: 1,
});

const RELICS = ['r1', 'r2', 'r3', 'r4', 'r5'];

function game(relics: readonly string[] = RELICS, players = 1): Simulation {
  const simulation = createSimulation({
    ...COMBAT_OPTIONS,
    players: ([0, 1] as const).slice(0, players).map((id) => ({ id, classId: 'raver' })),
    content: { ...COMBAT_CONTENT, upgrades: [...COMBAT_CONTENT.upgrades, ...relics.map(relic)] },
  });
  for (const player of simulation.state.players) {
    player.x = 100;
    player.y = 800;
  }
  return simulation;
}

function killBoss(simulation: Simulation): void {
  placeEnemy(simulation.state, 'curfew', 1200, 100).hp = 0;
}

describe('boss relics', () => {
  it('offer three distinct relics at Volume 0 and pause the game', () => {
    const simulation = game();
    killBoss(simulation);

    simulation.step([]);

    const [offer] = simulation.state.pendingUpgrades;
    expect(offer?.kind).toBe('relic');
    expect(offer?.options).toHaveLength(3);
    expect(new Set(offer?.options).size).toBe(3);
    expect(offer?.options.every((id) => RELICS.includes(id))).toBe(true);
    expect(simulation.state.events).toContainEqual({
      type: 'relicOffered',
      playerId: 0,
      options: offer?.options,
    });
    expect(simulation.state.status).toBe('choosingUpgrade');
  });

  it('offer four relics at Volume 1', () => {
    const simulation = game();
    simulation.state.volume = 1;
    killBoss(simulation);

    simulation.step([]);

    expect(simulation.state.pendingUpgrades[0]?.options).toHaveLength(4);
  });

  it('never offer a relic already held, and apply the one chosen', () => {
    const simulation = game(['r1', 'r2', 'r3', 'r4']);
    const [player] = simulation.state.players;
    player?.upgrades.push('r1');
    killBoss(simulation);
    simulation.step([]);
    const options = simulation.state.pendingUpgrades[0]?.options ?? [];
    const before = { ...player?.modifiers };

    simulation.step([actionsFor(0, { type: 'chooseUpgrade', upgradeId: 'r2' })]);

    expect(options).not.toContain('r1');
    expect(options).toHaveLength(3);
    expect(player?.upgrades).toContain('r2');
    expect(player?.modifiers).not.toEqual(before);
    expect(simulation.state.pendingUpgrades).toEqual([]);
    expect(simulation.state.status).toBe('running');
  });

  it('offer what remains when fewer relics are left than the offer size', () => {
    const simulation = game(['r1', 'r2']);
    killBoss(simulation);

    simulation.step([]);

    expect([...(simulation.state.pendingUpgrades[0]?.options ?? [])].sort()).toEqual(['r1', 'r2']);
  });

  it('offer nothing and let the game run on when no relic is left', () => {
    const simulation = game(['r1']);
    simulation.state.players[0]?.upgrades.push('r1');
    killBoss(simulation);

    simulation.step([]);

    expect(simulation.state.pendingUpgrades).toEqual([]);
    expect(simulation.state.events.some((event) => event.type === 'relicOffered')).toBe(false);
    expect(simulation.state.status).toBe('running');
  });

  it('offer each player their own relics', () => {
    const simulation = game(RELICS, 2);
    killBoss(simulation);

    simulation.step([]);

    expect(simulation.state.pendingUpgrades.map((offer) => offer.playerId)).toEqual([0, 1]);
  });

  it('come before the level offer when both fall on the same tick', () => {
    const simulation = game();
    const [player] = simulation.state.players;
    if (player === undefined) {
      throw new Error('expected one player');
    }
    player.vibes = player.vibesToNextLevel;
    killBoss(simulation);

    simulation.step([]);

    expect(simulation.state.pendingUpgrades.map((offer) => offer.kind)).toEqual(['relic']);
    const [first] = simulation.state.pendingUpgrades[0]?.options ?? [];
    simulation.step([actionsFor(0, { type: 'chooseUpgrade', upgradeId: first ?? '' })]);
    expect(simulation.state.pendingUpgrades).toHaveLength(1);
    expect(simulation.state.pendingUpgrades[0]?.kind).toBeUndefined();
    expect(simulation.state.status).toBe('choosingUpgrade');
  });

  it('chain behind a level offer already waiting', () => {
    const simulation = game();
    simulation.state.pendingUpgrades.push({
      playerId: 0,
      options: ['quick-feet'],
      rarities: ['common'],
    });
    killBoss(simulation);

    simulation.step([]);

    expect(simulation.state.pendingUpgrades.map((offer) => offer.kind)).toEqual([
      undefined,
      'relic',
    ]);
    simulation.step([actionsFor(0, { type: 'chooseUpgrade', upgradeId: 'quick-feet' })]);
    expect(simulation.state.pendingUpgrades[0]?.kind).toBe('relic');
    expect(simulation.state.status).toBe('choosingUpgrade');
  });

  it('give way to victory when the last boss falls, with no offer at all', () => {
    const simulation = game();
    const [player] = simulation.state.players;
    if (player === undefined) {
      throw new Error('expected one player');
    }
    simulation.state.set.tier = 1;
    simulation.state.set.segment = 'drop';
    simulation.state.set.segmentStartTick = simulation.state.tick - TICKS_PER_BAR;
    player.vibes = player.vibesToNextLevel;
    killBoss(simulation);

    for (let tick = 0; tick < 2 * TICKS_PER_BAR && simulation.state.status === 'running'; tick++) {
      simulation.step([]);
    }

    expect(simulation.state.pendingUpgrades).toEqual([]);
    expect(simulation.state.status).toBe('won');
  });
});

describe('level draw', () => {
  it('never contains a relic', () => {
    const simulation = game();
    const content = resolveContent({
      ...COMBAT_CONTENT,
      upgrades: [...COMBAT_CONTENT.upgrades, ...RELICS.map(relic)],
    });
    const [player] = simulation.state.players;
    const set = content.sets.values().next().value;
    if (player === undefined || set === undefined) {
      throw new Error('expected a player and a set');
    }

    for (let draw = 0; draw < 50; draw += 1) {
      const offer = drawOffer(simulation.state.rng, simulation.state, content, set, player);
      expect(offer.options.some((id) => RELICS.includes(id))).toBe(false);
    }
  });
});
