import { describe, expect, it } from 'vitest';
import { COMBAT_CONTENT, COMBAT_OPTIONS, CROWN_SET, commandFor, placeEnemy } from './fixtures';
import { createSimulation, type Simulation, type SimulationOptions } from './index';

const ENEMIES = 300;
const PROJECTILES = 200;
const WARMUP_STEPS = 100;
const MEASURED_STEPS = 600;
const KINDS = ['grump', 'queue', 'doorman', 'drizzle'] as const;

function crowdedArena(options: SimulationOptions): Simulation {
  const simulation = createSimulation(options);
  const { state } = simulation;
  state.core.hp = Number.MAX_SAFE_INTEGER;
  for (const player of state.players) {
    player.hp = Number.MAX_SAFE_INTEGER;
  }
  for (let i = 0; i < ENEMIES; i++) {
    const x = 40 + ((i * 97) % (state.arena.width - 80));
    const y = 40 + ((i * 61) % (state.arena.height - 80));
    const enemy = placeEnemy(state, KINDS[i % KINDS.length] ?? 'grump', x, y);
    enemy.hp = Number.MAX_SAFE_INTEGER;
  }
  return simulation;
}

function refillProjectiles(simulation: Simulation, step: number): void {
  const { state } = simulation;
  for (let i = state.projectiles.length; i < PROJECTILES; i++) {
    const x = (step * 37 + i * 53) % state.arena.width;
    const y = (step * 29 + i * 71) % state.arena.height;
    state.projectiles.push({
      id: state.nextEntityId,
      owner: { kind: 'player', playerId: 0 },
      x,
      y,
      prevX: x,
      prevY: y,
      vx: i % 2 === 0 ? 12 : -12,
      vy: i % 3 === 0 ? 8 : -8,
      radius: 4,
      damage: 1,
      ticksLeft: 40,
      pierceLeft: 2,
    });
    state.nextEntityId += 1;
  }
}

const CROWN_OPTIONS: SimulationOptions = {
  ...COMBAT_OPTIONS,
  setId: CROWN_SET.id,
  content: {
    ...COMBAT_CONTENT,
    sets: [{ ...CROWN_SET, tiers: CROWN_SET.tiers.map((tier) => ({ ...tier, spawns: [] })) }],
  },
};

describe('performance', () => {
  // The median ignores the steps the OS preempts when parallel agents load the machine.
  it.each([
    ['an open stage', COMBAT_OPTIONS],
    ['a stage of poles and arms, where the bad vibes follow the flow field', CROWN_OPTIONS],
  ] as const)(
    `steps ${String(ENEMIES)} enemies and ${String(PROJECTILES)} projectiles on %s in under 2 ms at the median`,
    (_name, options) => {
      const simulation = crowdedArena(options);
      const fire = [commandFor(0, { aim: { x: 1, y: 1 }, fire: true })];
      const durations: number[] = [];

      for (let step = 0; step < WARMUP_STEPS + MEASURED_STEPS; step++) {
        refillProjectiles(simulation, step);
        const start = performance.now();
        simulation.step(fire);
        if (step >= WARMUP_STEPS) {
          durations.push(performance.now() - start);
        }
      }

      durations.sort((a, b) => a - b);
      const median = durations[Math.floor(durations.length / 2)] ?? Number.POSITIVE_INFINITY;
      console.info(
        `sim step with ${String(ENEMIES)} enemies on ${options.setId}: ${median.toFixed(3)} ms at the median`,
      );
      expect(simulation.state.status).toBe('running');
      expect(simulation.state.enemies).toHaveLength(ENEMIES);
      expect(median).toBeLessThan(2);
    },
  );
});
