import { describe, expect, it } from 'vitest';
import { COMBAT_OPTIONS, commandFor, placeEnemy } from './fixtures';
import { createSimulation, type Simulation } from './index';

const ENEMIES = 300;
const PROJECTILES = 200;
const WARMUP_STEPS = 100;
const MEASURED_STEPS = 600;
const KINDS = ['grump', 'queue', 'doorman', 'drizzle'] as const;

function crowdedArena(): Simulation {
  const simulation = createSimulation(COMBAT_OPTIONS);
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

describe('performance', () => {
  it(`steps ${String(ENEMIES)} enemies and ${String(PROJECTILES)} projectiles in under 2 ms on average`, () => {
    const simulation = crowdedArena();
    const fire = [commandFor(0, { aim: { x: 1, y: 1 }, fire: true })];
    let measured = 0;

    for (let step = 0; step < WARMUP_STEPS + MEASURED_STEPS; step++) {
      refillProjectiles(simulation, step);
      const start = performance.now();
      simulation.step(fire);
      if (step >= WARMUP_STEPS) {
        measured += performance.now() - start;
      }
    }

    const average = measured / MEASURED_STEPS;
    console.info(`sim step with ${String(ENEMIES)} enemies: ${average.toFixed(3)} ms on average`);
    expect(simulation.state.status).toBe('running');
    expect(simulation.state.enemies).toHaveLength(ENEMIES);
    expect(average).toBeLessThan(2);
  });
});
