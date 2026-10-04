import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { FIXTURE_OPTIONS, stepAndRecord } from '../fixtures';
import { createSimulation } from '../index';

describe('core watts', () => {
  it('adds the watts of the set to the core on every new bar, not in between', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);

    stepAndRecord(simulation, TICKS_PER_BAR - 1);
    const beforeFirstBar = simulation.state.core.watts;
    stepAndRecord(simulation, 1);
    const onFirstBar = simulation.state.core.watts;
    stepAndRecord(simulation, 2 * TICKS_PER_BAR);

    expect(beforeFirstBar).toBe(50);
    expect(onFirstBar).toBe(55);
    expect(simulation.state.core.watts).toBe(65);
  });

  it('adds the watts per bar bonus of every player', () => {
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
    first.modifiers.wattsPerBarAdd = 2;
    second.modifiers.wattsPerBarAdd = 4;

    stepAndRecord(simulation, TICKS_PER_BAR);

    expect(simulation.state.core.watts).toBe(50 + 5 + 2 + 4);
  });
});
