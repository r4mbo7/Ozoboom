import { describe, expect, it } from 'vitest';
import type { SetDefinition } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import {
  EFFECTS_CONTENT,
  EFFECTS_OPTIONS,
  FIXTURE_SET,
  type TimedEvent,
  placeEnemy,
  stepAndRecord,
} from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { BombState, PlayerState } from '../state';

const BOMB_SET: SetDefinition = {
  ...FIXTURE_SET,
  id: 'bomb-set',
  bomb: { everyBars: 2, lifetimeBars: 4, radius: 20 },
};

const BOMB_AND_LOOT_SET: SetDefinition = {
  ...BOMB_SET,
  id: 'bomb-and-loot-set',
  loot: { everyBars: 2, lifetimeBars: 4, radius: 16, first: 'mister' },
};

function game(set = BOMB_SET): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation({
    ...EFFECTS_OPTIONS,
    setId: set.id,
    content: { ...EFFECTS_CONTENT, sets: [...EFFECTS_CONTENT.sets, set] },
  });
  const [player] = simulation.state.players;
  if (player === undefined) {
    throw new Error('expected a player');
  }
  return { simulation, player };
}

function until(simulation: Simulation, tick: number): TimedEvent[] {
  return stepAndRecord(simulation, tick - simulation.state.tick);
}

function bombAt(simulation: Simulation, x: number, y: number): BombState {
  const bomb = { id: 900, ticksLeft: 100, x, y, prevX: x, prevY: y };
  simulation.state.bombs = [bomb];
  return bomb;
}

describe('bomb carriers', () => {
  it('make the first bad vibe spawned on each bomb bar a carrier, and no other', () => {
    const { simulation } = game();

    until(simulation, 2 * TICKS_PER_BAR - 1);
    const before = simulation.state.enemies.filter((enemy) => enemy.carriesBomb === true);
    const onBar = until(simulation, 2 * TICKS_PER_BAR);

    const spawned = onBar.flatMap(({ event }) => (event.type === 'enemySpawned' ? [event.id] : []));
    const carriers = simulation.state.enemies.filter((enemy) => enemy.carriesBomb === true);
    expect(before).toEqual([]);
    expect(carriers.map((enemy) => enemy.id)).toEqual(spawned.slice(0, 1));
  });

  it('never load a bad vibe that already carries a loot', () => {
    const { simulation } = game(BOMB_AND_LOOT_SET);

    until(simulation, 4 * TICKS_PER_BAR);

    expect(
      simulation.state.enemies.filter(
        (enemy) => enemy.carriesBomb === true && enemy.carriesLoot === true,
      ),
    ).toEqual([]);
    expect(simulation.state.enemies.some((enemy) => enemy.carriesBomb === true)).toBe(true);
  });

  it('leave the state untouched in a set without bomb', () => {
    const simulation = createSimulation(EFFECTS_OPTIONS);

    until(simulation, 4 * TICKS_PER_BAR);

    expect(simulation.state.enemies.some((enemy) => enemy.carriesBomb === true)).toBe(false);
    expect(simulation.state).not.toHaveProperty('nextBombBar');
    expect(simulation.state).not.toHaveProperty('bombDue');
  });
});

describe('bombs', () => {
  it('fall where their carrier dies', () => {
    const { simulation } = game();
    const carrier = placeEnemy(simulation.state, 'grump', 300, 200);
    carrier.carriesBomb = true;
    carrier.hp = 0;

    const recorded = stepAndRecord(simulation, 1);

    expect(simulation.state.bombs).toEqual([expect.objectContaining({ x: 300, y: 200 })]);
    expect(recorded.map(({ event }) => event)).toContainEqual(
      expect.objectContaining({ type: 'bombDropped', x: 300, y: 200 }),
    );
  });

  it('vanish at the end of their lifetime', () => {
    const { simulation } = game();
    bombAt(simulation, 20, 20).ticksLeft = 2;

    stepAndRecord(simulation, 2);

    expect(simulation.state.bombs).toEqual([]);
  });

  it('stay on the ground under a downed player', () => {
    const { simulation, player } = game();
    player.downed = true;
    bombAt(simulation, player.x, player.y);

    stepAndRecord(simulation, 1);

    expect(simulation.state.bombs).toHaveLength(1);
  });

  it('go off under a player and clear every bad vibe but the bosses, credited to that player', () => {
    const { simulation, player } = game();
    const far = placeEnemy(simulation.state, 'grump', 40, 40);
    const near = placeEnemy(simulation.state, 'grump', 900, 600);
    const boss = placeEnemy(simulation.state, 'curfew', 60, 900);
    const bomb = bombAt(simulation, player.x + player.radius + 19, player.y);

    const recorded = stepAndRecord(simulation, 1).map(({ event }) => event);

    expect(simulation.state.bombs).toEqual([]);
    expect(recorded).toContainEqual({
      type: 'bombExploded',
      id: bomb.id,
      playerId: player.id,
      x: bomb.x,
      y: bomb.y,
    });
    const died = recorded.flatMap((event) => (event.type === 'enemyDied' ? [event] : []));
    expect(died.map((event) => event.id).sort()).toEqual([far.id, near.id].sort());
    expect(died.every((event) => event.byPlayer === player.id)).toBe(true);
    expect(simulation.state.enemies.map((enemy) => enemy.id)).toEqual([boss.id]);
    expect(simulation.state.pickups.length).toBeGreaterThanOrEqual(2);
  });
});
