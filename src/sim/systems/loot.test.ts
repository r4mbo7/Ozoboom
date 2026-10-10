import { describe, expect, it } from 'vitest';
import type { SetDefinition } from '../../data/types';
import { seedRng } from '../../shared/prng';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { resolveContent } from '../content';
import {
  EFFECTS_CONTENT,
  EFFECTS_OPTIONS,
  FIXTURE_SET,
  type TimedEvent,
  commandFor,
  placeEnemy,
  stepAndRecord,
} from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import { hashState } from '../replay';
import type { LootState, PlayerState } from '../state';
import { drawLootTrap } from './loot';

const PLAYER_IDS = [0, 1, 2, 3] as const;

const LOOT_SET: SetDefinition = {
  ...FIXTURE_SET,
  id: 'loot-set',
  loot: { everyBars: 2, lifetimeBars: 4, radius: 16, first: 'mister' },
};

function game(players = 1): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation({
    ...EFFECTS_OPTIONS,
    setId: LOOT_SET.id,
    content: { ...EFFECTS_CONTENT, sets: [...EFFECTS_CONTENT.sets, LOOT_SET] },
    players: PLAYER_IDS.slice(0, players).map((id) => ({ id, classId: 'raver' })),
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

function lootAt(simulation: Simulation, x: number, y: number, trapId = 'beam'): LootState {
  const loot = { id: 900, trapId, ticksLeft: 100, x, y, prevX: x, prevY: y };
  simulation.state.loots = [loot];
  return loot;
}

describe('loot carriers', () => {
  it('make the first bad vibe spawned on each loot bar a carrier, and no other', () => {
    const { simulation } = game();

    const before = until(simulation, 2 * TICKS_PER_BAR - 1);
    const onBar = until(simulation, 2 * TICKS_PER_BAR);

    const spawned = onBar.flatMap(({ event }) => (event.type === 'enemySpawned' ? [event.id] : []));
    const carriers = simulation.state.enemies.filter((enemy) => enemy.carriesLoot === true);
    expect(before.some(({ event }) => event.type === 'lootDropped')).toBe(false);
    expect(carriers.map((enemy) => enemy.id)).toEqual(spawned.slice(0, 1));
  });

  it('drop the first loot of the game with the first trap of the set where they die', () => {
    const { simulation } = game();
    const carrier = placeEnemy(simulation.state, 'grump', 300, 200);
    carrier.carriesLoot = true;
    carrier.hp = 0;

    const recorded = stepAndRecord(simulation, 1);

    expect(simulation.state.loots).toEqual([
      expect.objectContaining({ trapId: 'mister', x: 300, y: 200 }),
    ]);
    expect(recorded.map(({ event }) => event)).toContainEqual(
      expect.objectContaining({ type: 'lootDropped', trapId: 'mister', x: 300, y: 200 }),
    );
  });

  it('drop one loot per player when a boss dies', () => {
    const { simulation } = game(3);
    const boss = placeEnemy(simulation.state, 'curfew', 300, 200);
    boss.hp = 0;

    stepAndRecord(simulation, 1);

    expect(simulation.state.loots).toHaveLength(3);
  });

  it('drop nothing in a set without loot', () => {
    const simulation = createSimulation(EFFECTS_OPTIONS);
    const carrier = placeEnemy(simulation.state, 'grump', 300, 200);
    carrier.carriesLoot = true;
    carrier.hp = 0;

    stepAndRecord(simulation, 1);

    expect(simulation.state.loots ?? []).toEqual([]);
  });
});

describe('loots', () => {
  it('go to the hand of the first player who touches them with a free hand', () => {
    const { simulation, player } = game();
    player.hand = ['subwoofer'];
    const loot = lootAt(simulation, player.x + player.radius + 10, player.y);

    const recorded = stepAndRecord(simulation, 1);

    expect(player.hand).toEqual(['subwoofer', 'beam']);
    expect(simulation.state.loots).toEqual([]);
    expect(recorded.map(({ event }) => event)).toContainEqual({
      type: 'lootCollected',
      id: loot.id,
      playerId: player.id,
      trapId: 'beam',
      x: loot.x,
      y: loot.y,
    });
  });

  it('stay on the ground when the hands are full', () => {
    const { simulation, player } = game();
    player.hand = ['subwoofer', 'subwoofer'];
    lootAt(simulation, player.x, player.y);

    stepAndRecord(simulation, 1);

    expect(player.hand).toEqual(['subwoofer', 'subwoofer']);
    expect(simulation.state.loots).toHaveLength(1);
  });

  it('stay out of reach of a downed player', () => {
    const { simulation, player } = game();
    player.downed = true;
    lootAt(simulation, player.x, player.y);

    stepAndRecord(simulation, 1);

    expect(simulation.state.loots).toHaveLength(1);
  });

  it('vanish at the end of their lifetime', () => {
    const { simulation } = game();
    lootAt(simulation, 20, 20).ticksLeft = 2;

    stepAndRecord(simulation, 2);

    expect(simulation.state.loots).toEqual([]);
  });
});

describe('loot replay', () => {
  it('keeps the fingerprint of a game that drops loots and picks them up', () => {
    const { simulation, player } = game();
    player.hand = [];
    const types: string[] = [];

    while (simulation.state.tick < 10 * TICKS_PER_BAR) {
      const [loot] = simulation.state.loots ?? [];
      const toLoot =
        loot === undefined ? { x: 0, y: 0 } : { x: loot.x - player.x, y: loot.y - player.y };
      const distance = Math.sqrt(toLoot.x * toLoot.x + toLoot.y * toLoot.y);
      const move = distance > 0 ? { x: toLoot.x / distance, y: toLoot.y / distance } : toLoot;
      const [target] = [...simulation.state.enemies].sort(
        (one, other) =>
          Math.abs(one.x - player.x) +
          Math.abs(one.y - player.y) -
          (Math.abs(other.x - player.x) + Math.abs(other.y - player.y)),
      );
      const aim =
        target === undefined ? { x: 0, y: -1 } : { x: target.x - player.x, y: target.y - player.y };
      simulation.step([commandFor(0, { move, aim, fire: true })]);
      types.push(...simulation.state.events.map((event) => event.type));
    }

    expect(types).toContain('lootDropped');
    expect(types).toContain('lootCollected');
    expect(hashState(simulation.state)).toBe('d105b2bf');
  });
});

describe('drawLootTrap', () => {
  it('follows the weight of each trap', () => {
    const traps = [...resolveContent(EFFECTS_CONTENT).traps.values()];
    const rng = seedRng(7);
    const counts = new Map<string, number>();

    for (let i = 0; i < 6000; i++) {
      const id = drawLootTrap(rng, traps);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const total = traps.reduce((sum, trap) => sum + trap.lootWeight, 0);
    for (const trap of traps) {
      expect((counts.get(trap.id) ?? 0) / 6000).toBeCloseTo(trap.lootWeight / total, 1);
    }
  });
});
