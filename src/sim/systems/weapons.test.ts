import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameContent, WeaponDefinition } from '../../data/types';
import { TICKS_PER_BAR, tempoOf } from '../../shared/tempo';
import { FIXTURE_CONTENT, FIXTURE_OPTIONS, actionsFor } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import { spawnEnemy } from './spawning';
import { WEAPONS, firesOnTick } from './weapons';

const weapon = (rhythm: WeaponDefinition['rhythm']): WeaponDefinition => ({
  id: 'club',
  name: 'club',
  description: 'club',
  rhythm,
  effect: { kind: 'sweep', damage: 1, radius: 10, arcDegrees: 90 },
  maxLevel: 3,
  levelMul: 2,
});

function armed(definition: WeaponDefinition, level = 1) {
  const content: GameContent = { ...FIXTURE_CONTENT, weapons: [definition] };
  const simulation = createSimulation({ ...FIXTURE_OPTIONS, content });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  player.weapons = [{ id: 'club', level, phase: 0 }];
  return { simulation, player };
}

function firedTicks(simulation: Simulation, steps: number): number[] {
  const ticks: number[] = [];
  for (let i = 0; i < steps; i++) {
    simulation.step([]);
    if (simulation.state.events.some((event) => event.type === 'weaponFired')) {
      ticks.push(simulation.state.tick);
    }
  }
  return ticks;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('firesOnTick', () => {
  it('fires on ticks 0 and 24 of each bar for steps 0 and 8', () => {
    const rhythm = { everyBars: 1, steps: [0, 8] };

    const ticks = Array.from({ length: TICKS_PER_BAR }, (_, tick) => tick).filter((tick) =>
      firesOnTick(rhythm, tick),
    );

    expect(ticks).toEqual([0, 24]);
  });

  it('waits for the period to come around when it spans several bars', () => {
    const rhythm = { everyBars: 2, steps: [1] };

    expect([3, 51, 99].map((tick) => firesOnTick(rhythm, tick))).toEqual([true, false, true]);
  });

  it('fires every sixteenth of a bar on the Dome, where a sixteenth is not a whole tick', () => {
    const dome = tempoOf(18);
    const rhythm = { everyBars: 1, steps: [1, 2, 3, 5] };

    const ticks = Array.from({ length: dome.ticksPerBar }, (_, tick) => tick).filter((tick) =>
      firesOnTick(rhythm, tick, dome),
    );

    expect(ticks).toEqual([4, 9, 13, 22]);
  });
});

describe('weapons', () => {
  it('fires twice per bar for steps 0 and 8', () => {
    const { simulation } = armed(weapon({ everyBars: 1, steps: [0, 8] }));

    expect(firedTicks(simulation, 2 * TICKS_PER_BAR)).toEqual([24, 48, 72, 96]);
  });

  it('fires on every tick when continuous', () => {
    const { simulation } = armed(weapon('continuous'));

    expect(firedTicks(simulation, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not fire for a downed player', () => {
    const { simulation, player } = armed(weapon('continuous'));
    player.downed = true;

    expect(firedTicks(simulation, 5)).toEqual([]);
  });

  it('hands the module the compounded power and the closest enemy', () => {
    const { simulation, player } = armed(weapon('continuous'), 3);
    const grump = FIXTURE_CONTENT.enemies[0];
    if (grump === undefined) {
      throw new Error('expected an enemy');
    }
    spawnEnemy(simulation.state, grump, player.x + 600, player.y, false);
    const near = spawnEnemy(simulation.state, grump, player.x + 90, player.y, false);
    spawnEnemy(simulation.state, grump, player.x - 400, player.y, false);
    const fire = vi.spyOn(WEAPONS.sweep, 'fire');

    simulation.step([]);

    const shot = fire.mock.calls[0]?.[4];
    expect(shot?.power).toBe(4);
    expect(shot?.target?.id).toBe(near.id);
  });

  it('finds a target however far it is', () => {
    const { simulation, player } = armed(weapon('continuous'));
    const grump = FIXTURE_CONTENT.enemies[0];
    if (grump === undefined) {
      throw new Error('expected an enemy');
    }
    const far = spawnEnemy(simulation.state, grump, player.x + 800, player.y, false);
    const fire = vi.spyOn(WEAPONS.sweep, 'fire');

    simulation.step([]);

    expect(fire.mock.calls[0]?.[4].target?.id).toBe(far.id);
  });

  it('gives a null target on an empty field', () => {
    const { simulation } = armed(weapon('continuous'));
    const fire = vi.spyOn(WEAPONS.sweep, 'fire');

    simulation.step([]);

    expect(fire.mock.calls[0]?.[4].target).toBeNull();
  });
});

describe('choosing a weapon', () => {
  it('adds the slot then levels it up, announcing each time', () => {
    const { simulation, player } = armed(weapon('continuous'));
    player.weapons = [];
    simulation.step([]);
    simulation.state.pendingUpgrades.push({ playerId: 0, options: ['club'], rarities: ['common'] });
    simulation.step([]);
    const choose = actionsFor(0, { type: 'chooseUpgrade', upgradeId: 'club' });

    simulation.step([choose]);
    const first = simulation.state.events.filter((event) => event.type === 'weaponGained');
    simulation.state.pendingUpgrades.push({ playerId: 0, options: ['club'], rarities: ['common'] });
    simulation.step([choose]);
    const second = simulation.state.events.filter((event) => event.type === 'weaponGained');

    expect(first).toEqual([{ type: 'weaponGained', playerId: 0, weaponId: 'club' }]);
    expect(second).toEqual(first);
    expect(player.weapons.map((slot) => slot.level)).toEqual([2]);
  });
});
