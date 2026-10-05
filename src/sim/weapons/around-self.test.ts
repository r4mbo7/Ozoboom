import { describe, expect, it } from 'vitest';
import type { GameContent, WeaponDefinition } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { commandFor, FIXTURE_CONTENT, FIXTURE_OPTIONS } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import { hashState } from '../replay';
import type { EnemyState, ProjectileState } from '../state';
import { spawnEnemy } from '../systems/spawning';

const HALF_BAR = TICKS_PER_BAR / 2;
const EVERY_BEAT = [0, 4, 8, 12];

const SWEEP: WeaponDefinition = {
  id: 'baton',
  name: 'baton',
  description: 'baton',
  rhythm: 'continuous',
  effect: { kind: 'sweep', damage: 8, radius: 90, arcDegrees: 120 },
  maxLevel: 5,
  levelMul: 1.3,
};

const ORBIT: WeaponDefinition = {
  id: 'eventails',
  name: 'eventails',
  description: 'eventails',
  rhythm: 'continuous',
  effect: { kind: 'orbit', damage: 6, count: 2, radius: 22, orbitRadius: 70, turnsPerBar: 2 },
  maxLevel: 5,
  levelMul: 1.3,
};

const HOOP: WeaponDefinition = {
  id: 'cerceaux',
  name: 'cerceaux',
  description: 'cerceaux',
  rhythm: { everyBars: 1, steps: EVERY_BEAT },
  effect: { kind: 'hoop', damage: 12, radius: 70, wideRadius: 120, knockback: 30 },
  maxLevel: 5,
  levelMul: 1.3,
};

function armed(definition: WeaponDefinition, level = 1) {
  const content: GameContent = { ...FIXTURE_CONTENT, weapons: [definition] };
  const simulation = createSimulation({ ...FIXTURE_OPTIONS, content });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  player.weapons = [{ id: definition.id, level, phase: 0 }];
  player.aim = { x: 1, y: 0 };
  return { simulation, player };
}

function stand(simulation: Simulation, dx: number, dy: number): EnemyState {
  const player = simulation.state.players[0];
  const grump = FIXTURE_CONTENT.enemies[0];
  if (player === undefined || grump === undefined) {
    throw new Error('expected a player and an enemy');
  }
  const enemy = spawnEnemy(simulation.state, grump, player.x + dx, player.y + dy, false);
  enemy.speed = 0;
  enemy.maxHp = 1000;
  enemy.hp = 1000;
  return enemy;
}

function bodies(simulation: Simulation): ProjectileState[] {
  return simulation.state.projectiles.filter((projectile) => projectile.owner.kind === 'weapon');
}

describe('sweep', () => {
  it('hits an enemy in front of the aim', () => {
    const { simulation } = armed(SWEEP);
    const ahead = stand(simulation, 60, 0);

    simulation.step([]);

    expect(ahead.hp).toBe(992);
  });

  it('turns to the closest bad vibe, even behind the player', () => {
    const { simulation } = armed(SWEEP);
    const behind = stand(simulation, -60, 0);

    simulation.step([]);

    expect(behind.hp).toBe(992);
  });

  it('spares a bad vibe on the other side of the closest one', () => {
    const { simulation } = armed(SWEEP);
    const closest = stand(simulation, -50, 0);
    const opposite = stand(simulation, 70, 0);

    simulation.step([]);

    expect([closest.hp, opposite.hp]).toEqual([992, 1000]);
  });

  it('spares an enemy beside the closest one, out of the sector', () => {
    const { simulation } = armed(SWEEP);
    stand(simulation, 60, 0);
    const beside = stand(simulation, 0, 62);

    simulation.step([]);

    expect(beside.hp).toBe(1000);
  });

  it('hits an enemy near the edge of the sector and spares one just past it', () => {
    const { simulation } = armed(SWEEP);
    stand(simulation, 50, 0);
    const inside = stand(simulation, 40, 66);
    const outside = stand(simulation, 30, 66);

    simulation.step([]);

    expect(inside.hp).toBe(992);
    expect(outside.hp).toBe(1000);
  });

  it('aims at the closest bad vibe, not where the player aims', () => {
    const { simulation } = armed(SWEEP);
    const above = stand(simulation, 0, -60);
    const right = stand(simulation, 70, 0);

    simulation.step([commandFor(0, { aim: { x: 1, y: 0 } })]);

    expect([above.hp, right.hp]).toEqual([992, 1000]);
  });

  it('spares an enemy beyond the radius', () => {
    const { simulation } = armed(SWEEP);
    const far = stand(simulation, 150, 0);

    simulation.step([]);

    expect(far.hp).toBe(1000);
  });

  it('scales the damage with the level', () => {
    const { simulation } = armed(SWEEP, 3);
    const ahead = stand(simulation, 60, 0);

    simulation.step([]);

    expect(ahead.hp).toBeCloseTo(1000 - 8 * 1.3 * 1.3, 10);
  });
});

describe('orbit', () => {
  it('keeps its bodies at the orbit radius around the player', () => {
    const { simulation, player } = armed(ORBIT);

    simulation.step([]);

    const distances = bodies(simulation).map((body) =>
      Math.sqrt(
        (body.x - player.x) * (body.x - player.x) + (body.y - player.y) * (body.y - player.y),
      ),
    );
    expect(distances).toHaveLength(2);
    for (const distance of distances) {
      expect(distance).toBeCloseTo(70, 6);
    }
  });

  it('spaces the bodies evenly', () => {
    const { simulation, player } = armed(ORBIT);

    simulation.step([]);

    const [first, second] = bodies(simulation);
    expect(first?.x).toBeCloseTo(2 * player.x - (second?.x ?? 0), 6);
    expect(first?.y).toBeCloseTo(2 * player.y - (second?.y ?? 0), 6);
  });

  it('makes a full turn in 1 / turnsPerBar bar', () => {
    const { simulation } = armed(ORBIT);
    simulation.step([]);
    const start = bodies(simulation).map((body) => ({ x: body.x, y: body.y }));
    const quarter = TICKS_PER_BAR / 2 / 4;

    for (let i = 0; i < quarter; i++) {
      simulation.step([]);
    }
    const afterQuarterTurn = bodies(simulation).map((body) => ({ x: body.x, y: body.y }));
    for (let i = 0; i < 3 * quarter; i++) {
      simulation.step([]);
    }
    const afterTurn = bodies(simulation).map((body) => ({ x: body.x, y: body.y }));

    expect(afterTurn[0]?.x).toBeCloseTo(start[0]?.x ?? NaN, 6);
    expect(afterTurn[0]?.y).toBeCloseTo(start[0]?.y ?? NaN, 6);
    expect(afterQuarterTurn[0]?.x).not.toBeCloseTo(start[0]?.x ?? NaN, 0);
  });

  it('hurts an enemy once per half bar however long a body stays on it', () => {
    const { simulation } = armed({
      ...ORBIT,
      effect: { kind: 'orbit', damage: 6, count: 1, radius: 22, orbitRadius: 70, turnsPerBar: 0 },
    });
    const enemy = stand(simulation, 70, 0);
    const hits: number[] = [];
    enemy.hp = 1e6;

    for (let i = 0; i < 2 * HALF_BAR; i++) {
      const before = enemy.hp;
      simulation.step([]);
      if (enemy.hp < before) {
        hits.push(simulation.state.tick);
      }
    }

    expect(hits.length).toBeGreaterThanOrEqual(2);
    for (const [index, tick] of hits.entries()) {
      const previous = hits[index - 1];
      if (previous !== undefined) {
        expect(Math.floor(tick / HALF_BAR)).not.toBe(Math.floor(previous / HALF_BAR));
      }
    }
  });

  it('deals its damage times the power', () => {
    const { simulation } = armed(ORBIT, 2);
    const enemy = stand(simulation, 70, 0);

    while (enemy.hp === 1000) {
      simulation.step([]);
    }

    expect(enemy.hp).toBeCloseTo(1000 - 6 * 1.3, 10);
  });

  it('leaves no body once the player is downed', () => {
    const { simulation, player } = armed(ORBIT);
    simulation.step([]);

    player.downed = true;
    simulation.step([]);
    simulation.step([]);

    expect(bodies(simulation)).toHaveLength(0);
  });

  it('keeps its bodies when the player stands in a corner', () => {
    const { simulation, player } = armed(ORBIT);
    player.x = 5;
    player.y = 5;

    for (let i = 0; i < TICKS_PER_BAR; i++) {
      simulation.step([]);
    }

    expect(bodies(simulation).map((body) => body.id)).toHaveLength(2);
    expect(Math.min(...bodies(simulation).map((body) => body.id))).toBeLessThan(
      simulation.state.nextEntityId - 2,
    );
  });
});

describe('hoop', () => {
  function stepTo(simulation: Simulation, tick: number): void {
    while (simulation.state.tick < tick - 1) {
      simulation.step([]);
    }
  }

  it('pushes an enemy radially away and hurts it', () => {
    const { simulation, player } = armed(HOOP);
    const enemy = stand(simulation, 0, 60);
    stepTo(simulation, TICKS_PER_BAR + 12);
    enemy.x = player.x;
    enemy.y = player.y + 50;
    enemy.hp = 1000;

    simulation.step([]);

    expect(enemy.x).toBeCloseTo(player.x, 6);
    expect(enemy.y).toBeCloseTo(player.y + 80, 6);
    expect(enemy.hp).toBe(988);
  });

  it('widens on beats 1 and 3 only', () => {
    const { simulation, player } = armed(HOOP);
    const enemy = stand(simulation, 100, 0);
    const reached: number[] = [];

    for (const tick of [
      TICKS_PER_BAR,
      TICKS_PER_BAR + 12,
      TICKS_PER_BAR + 24,
      TICKS_PER_BAR + 36,
    ]) {
      stepTo(simulation, tick);
      enemy.x = player.x + 100;
      enemy.y = player.y;
      enemy.hp = 1000;
      simulation.step([]);
      reached.push(enemy.hp < 1000 ? 1 : 0);
    }

    expect(reached).toEqual([1, 0, 1, 0]);
  });

  it('spares an enemy beyond the ring', () => {
    const { simulation, player } = armed(HOOP);
    const enemy = stand(simulation, 200, 0);

    stepTo(simulation, TICKS_PER_BAR);
    simulation.step([]);

    expect(enemy.x).toBe(player.x + 200);
    expect(enemy.hp).toBe(1000);
  });
});

describe('a game with the three weapons', () => {
  const content: GameContent = { ...FIXTURE_CONTENT, weapons: [SWEEP, HOOP, ORBIT] };

  function play(level: number): string {
    const simulation = createSimulation({ ...FIXTURE_OPTIONS, seed: 99, content });
    const player = simulation.state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    player.weapons = [SWEEP, HOOP, ORBIT].map((definition) => ({
      id: definition.id,
      level: Math.min(level, definition.maxLevel),
      phase: 0,
    }));
    for (let tick = 0; tick < 1200; tick++) {
      const angle = tick / 40;
      simulation.step([
        commandFor(0, {
          move: { x: Math.floor(tick / 60) % 2 === 0 ? 1 : -1, y: 0.4 },
          aim: { x: Math.floor(angle) % 2 === 0 ? 1 : -1, y: 1 },
        }),
      ]);
    }
    expect(simulation.state.stats.damageDealt).toBeGreaterThan(0);
    return hashState(simulation.state);
  }

  it('keeps the fingerprint at level 1', () => {
    expect(play(1)).toBe('2d8f38bf');
  });

  it('keeps the fingerprint at the maximum level', () => {
    expect(play(5)).toBe('b2e67195');
  });
});
