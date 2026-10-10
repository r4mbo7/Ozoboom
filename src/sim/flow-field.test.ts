import { describe, expect, it } from 'vitest';
import type { ObstacleDefinition, SetDefinition } from '../data/types';
import { TICKS_PER_BAR } from '../shared/tempo';
import { botCommand } from './bot';
import { COMBAT_CONTENT, CROWN_SET, FIXTURE_SET, placeEnemy } from './fixtures';
import { CONTENT } from '../data/content';
import { createSimulation, type SimulationOptions } from './index';

const DOME: SetDefinition = {
  ...CROWN_SET,
  tiers: CROWN_SET.tiers.map((tier) => ({
    ...tier,
    spawns: [
      { enemyId: 'grump', everyBars: 1, count: 3, fromPhrase: 0 },
      { enemyId: 'queue', everyBars: 1, count: 3, fromPhrase: 0 },
      { enemyId: 'doorman', everyBars: 2, count: 1, fromPhrase: 0 },
    ],
  })),
};

const GAMES = 100;
const BARS = 8;
const PATIENCE = 2 * TICKS_PER_BAR;
// Within this many radii of the core's skin a bad vibe is in the crowd at the core, not lost.
const CROWD_RADII = 4;

describe('flow field', () => {
  it('walks a bad vibe round a wall to the one gap in it', () => {
    const wall: ObstacleDefinition[] = [];
    for (let x = 20; x < 1600; x += 40) {
      if (x < 1100 || x > 1180) {
        wall.push({ x, y: 300, radius: 20 });
      }
    }
    const simulation = createSimulation({
      seed: 1,
      players: [{ id: 0, classId: 'raver' }],
      setId: FIXTURE_SET.id,
      content: { ...COMBAT_CONTENT, sets: [{ ...FIXTURE_SET, obstacles: wall }] },
    });
    const { state } = simulation;
    state.core.hp = Number.MAX_SAFE_INTEGER;
    const grump = placeEnemy(state, 'grump', 200, 100);

    for (let tick = 0; tick < 1500; tick++) {
      simulation.step([]);
    }

    const dx = grump.x - state.core.x;
    const dy = grump.y - state.core.y;
    const gap = Math.sqrt(dx * dx + dy * dy) - 48 - grump.radius;
    expect(gap).toBeLessThan(1);
  });

  it('leads every bad vibe to the core through the passages of a domed stage, in a hundred games', () => {
    const stall = longestStall({
      seed: 0,
      players: [{ id: 0, classId: 'raver' }],
      setId: DOME.id,
      content: { ...COMBAT_CONTENT, sets: [DOME] },
    });

    console.info(
      `flow field, fixture crown: ${String(stall.worst)} ticks, ${String(stall.watched)} enemy-ticks`,
    );
    expect(stall.watched).toBeGreaterThan(0);
    expect(stall.worst).toBeLessThanOrEqual(PATIENCE);
  }, 60_000);

  it('does the same on the Dome', () => {
    const stall = longestStall({
      seed: 0,
      players: [{ id: 0, classId: 'tank' }],
      setId: 'dome',
      content: CONTENT,
    });

    console.info(
      `flow field, Dome: ${String(stall.worst)} ticks, ${String(stall.watched)} enemy-ticks`,
    );
    expect(stall.watched).toBeGreaterThan(0);
    expect(stall.worst).toBeLessThanOrEqual(PATIENCE);
  }, 120_000);
});

// Plays GAMES games with a bot and an unkillable core, and returns the longest a bad vibe going
// for the core went without getting closer to it, out of the crowd at the core.
function longestStall(options: SimulationOptions): { worst: number; watched: number } {
  let worst = 0;
  let watched = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    const simulation = createSimulation({ ...options, seed });
    const { state } = simulation;
    state.core.hp = Number.MAX_SAFE_INTEGER;
    for (const player of state.players) {
      player.hp = Number.MAX_SAFE_INTEGER;
    }
    const definitions = new Map(options.content.enemies.map((enemy) => [enemy.id, enemy]));
    const best = new Map<number, { gap: number; tick: number }>();
    for (let tick = 0; tick < BARS * TICKS_PER_BAR; tick++) {
      simulation.step([botCommand(state, options.content, 0)]);
      for (const enemy of state.enemies) {
        const definition = definitions.get(enemy.kind);
        if (definition?.ranged !== undefined || definition?.special?.kind === 'steal') {
          continue;
        }
        const dx = enemy.x - state.core.x;
        const dy = enemy.y - state.core.y;
        const gap = Math.sqrt(dx * dx + dy * dy) - state.core.radius - enemy.radius;
        const record = best.get(enemy.id);
        const chasing = enemy.target !== 'core' || enemy.stunTicks > 0;
        if (record === undefined || gap < record.gap - 1 || chasing) {
          best.set(enemy.id, { gap, tick });
        } else if (gap > CROWD_RADII * enemy.radius) {
          worst = Math.max(worst, tick - record.tick);
        }
        watched += 1;
      }
    }
  }
  return { worst, watched };
}
