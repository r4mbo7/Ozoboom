import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { playBot } from './balance';
import { botCommand } from './bot';
import { COMBAT_OPTIONS } from './fixtures';
import { createSimulation } from './index';
import { hashState } from './replay';

const TICKS = 1500;

const STAGE_FINGERPRINTS: Readonly<Record<string, string>> = {
  'soiree-v0': '2f225573',
  dome: 'f7cce676',
  ambyss: '9a15331a',
};

function playDuo(seed: number) {
  const options = {
    ...COMBAT_OPTIONS,
    seed,
    players: [
      { id: 0 as const, classId: 'raver' },
      { id: 1 as const, classId: 'raver' },
    ],
  };
  const simulation = createSimulation(options);
  const { state } = simulation;
  for (let tick = 0; tick < TICKS; tick++) {
    simulation.step([0 as const, 1 as const].map((id) => botCommand(state, options.content, id)));
  }
  return state;
}

describe('the automatic player', () => {
  it('walks to a vibe on the ground, not to one in flight', () => {
    const { state } = createSimulation(COMBAT_OPTIONS);
    const [player] = state.players;
    if (player === undefined) {
      throw new Error('expected one player');
    }
    const idle = botCommand(state, COMBAT_OPTIONS.content, 0);
    const y = player.y + 40;
    const flight = { ticksLeft: 10, ticks: 24, fromX: 0, fromY: 0 };
    state.pickups.push({
      id: 9001,
      kind: 'vibes',
      amount: 1,
      x: player.x,
      y,
      prevX: player.x,
      prevY: y,
      ticksLeft: 100,
      flight,
    });

    expect(botCommand(state, COMBAT_OPTIONS.content, 0)).toEqual(idle);
    state.pickups.forEach((pickup) => delete pickup.flight);
    expect(botCommand(state, COMBAT_OPTIONS.content, 0)).not.toEqual(idle);
  });

  it('plays the same short game for two twice from the same seed', () => {
    expect(hashState(playDuo(3))).toBe(hashState(playDuo(3)));
  });

  it('keeps the fingerprint of a short game for two', () => {
    const state = playDuo(3);

    expect(state.stats.kills).toBeGreaterThan(0);
    expect(hashState(state)).toBe('2b54eaca');
  });

  it('reaches another state from another seed', () => {
    expect(hashState(playDuo(4))).not.toBe(hashState(playDuo(3)));
  });
});

describe.each(CONTENT.sets)('a short bot game on set $id', ({ id }) => {
  it('keeps its fingerprint', () => {
    const state = playBot(['mage', 'healer'], 3, CONTENT, TICKS, id);

    expect(state.stats.kills).toBeGreaterThan(0);
    expect(hashState(state)).toBe(STAGE_FINGERPRINTS[id]);
  });
});
