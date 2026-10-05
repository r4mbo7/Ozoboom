import { describe, expect, it } from 'vitest';
import type { GameContent, SetDefinition } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { commandFor, FIXTURE_CARER, FIXTURE_CONTENT, FIXTURE_SET, peaceful } from '../fixtures';
import { createSimulation } from '../index';

const CARER_COOLDOWN_BARS = 4;

function game(set: SetDefinition) {
  const content: GameContent = {
    ...FIXTURE_CONTENT,
    classes: [...FIXTURE_CONTENT.classes, FIXTURE_CARER],
    sets: [set],
  };
  const simulation = peaceful(
    createSimulation({
      seed: 1,
      setId: set.id,
      content,
      players: [
        { id: 0, classId: 'carer' },
        { id: 1, classId: 'carer' },
      ],
    }),
  );
  const { state } = simulation;
  for (const player of state.players) {
    player.x = state.core.x;
    player.y = state.core.y;
  }
  state.core.hp = 100;
  return { simulation, state };
}

function bothCast(simulation: ReturnType<typeof game>['simulation']): number[] {
  simulation.step([commandFor(0, { skill: true }), commandFor(1, { skill: true })]);
  return simulation.state.events.flatMap((event) =>
    event.type === 'coreRepaired' ? [event.amount] : [],
  );
}

describe('the core repair cap of a set', () => {
  it('stops two cares of the same bar from repairing more than the cap', () => {
    const { simulation, state } = game({ ...FIXTURE_SET, coreRepairPerBar: 60 });

    bothCast(simulation);

    expect(state.core.hp).toBe(160);
  });

  it('reports on coreRepaired what was really repaired, and nothing once the cap is spent', () => {
    const { simulation } = game({ ...FIXTURE_SET, coreRepairPerBar: 60 });

    const amounts = bothCast(simulation);

    expect(amounts).toEqual([50, 10]);
  });

  it('repairs again in the next bar', () => {
    const { simulation, state } = game({ ...FIXTURE_SET, coreRepairPerBar: 60 });
    bothCast(simulation);

    for (let tick = 0; tick < CARER_COOLDOWN_BARS * TICKS_PER_BAR; tick++) {
      simulation.step([]);
    }
    const amounts = bothCast(simulation);

    expect(amounts).toEqual([50, 10]);
    expect(state.core.hp).toBe(220);
  });

  it('changes nothing without a cap', () => {
    const { simulation, state } = game(FIXTURE_SET);

    const amounts = bothCast(simulation);

    expect(amounts).toEqual([50, 50]);
    expect(state.core.hp).toBe(200);
    expect(state.core.repairedThisBar).toBeUndefined();
  });

  it('leaves the state untouched while nothing is repaired', () => {
    const { simulation, state } = game({ ...FIXTURE_SET, coreRepairPerBar: 60 });

    simulation.step([]);

    expect(state.core.repairedThisBar).toBeUndefined();
  });
});
