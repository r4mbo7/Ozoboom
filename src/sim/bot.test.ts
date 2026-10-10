import { describe, expect, it } from 'vitest';
import { botCommand } from './bot';
import { COMBAT_OPTIONS } from './fixtures';
import { createSimulation } from './index';
import { hashState } from './replay';

const TICKS = 1500;

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
  it('plays the same short game for two twice from the same seed', () => {
    expect(hashState(playDuo(3))).toBe(hashState(playDuo(3)));
  });

  it('keeps the fingerprint of a short game for two', () => {
    const state = playDuo(3);

    expect(state.stats.kills).toBeGreaterThan(0);
    expect(hashState(state)).toBe('5d53f9fa');
  });

  it('reaches another state from another seed', () => {
    expect(hashState(playDuo(4))).not.toBe(hashState(playDuo(3)));
  });
});
