import { describe, expect, it } from 'vitest';
import { distanceSquared } from '../../shared/vec';
import { COMBAT_OPTIONS, commandFor, placeEnemy } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { EnemyState, PlayerState } from '../state';

function arena(): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation(COMBAT_OPTIONS);
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  park(player, 100, 800);
  return { simulation, player };
}

function park(player: PlayerState, x: number, y: number): void {
  player.x = x;
  player.y = y;
  player.prevX = x;
  player.prevY = y;
}

function steps(simulation: Simulation, count: number): void {
  for (let i = 0; i < count; i++) {
    simulation.step([]);
  }
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.sqrt(distanceSquared(a, b));

describe('enemy steering', () => {
  it('walks a rusher straight to the core at its speed and stops at contact', () => {
    const { simulation } = arena();
    const { core } = simulation.state;
    const grump = placeEnemy(simulation.state, 'grump', core.x, 100);

    steps(simulation, 10);
    const afterTen = { x: grump.x, y: grump.y };
    steps(simulation, 200);

    expect(afterTen).toEqual({ x: core.x, y: 125 });
    expect({ x: grump.x, y: grump.y }).toEqual({ x: core.x, y: core.y - core.radius - 12 });
  });

  it('turns to a standing player who comes within its aggro radius', () => {
    const { simulation, player } = arena();
    const grump = placeEnemy(simulation.state, 'grump', 800, 100);
    park(player, 800, 260);

    steps(simulation, 1);
    const beyondReach = grump.target;
    park(player, 800, 222);
    steps(simulation, 1);

    expect(beyondReach).toBe('core');
    expect(grump.target).toBe(0);
  });

  it('goes back to the core when its player gets too far or is downed', () => {
    const { simulation, player } = arena();
    const fled = placeEnemy(simulation.state, 'grump', 400, 100);
    park(player, 400, 200);
    steps(simulation, 1);
    const chasing = fled.target;

    park(player, 400, 100 + 2 * 120 + 10);
    steps(simulation, 1);
    const afterFleeing = fled.target;
    park(player, 400, 150);
    steps(simulation, 1);
    const afterReturning = fled.target;
    player.downed = true;
    steps(simulation, 1);

    expect(chasing).toBe(0);
    expect(afterFleeing).toBe('core');
    expect(afterReturning).toBe(0);
    expect(fled.target).toBe('core');
  });

  it('keeps walking to the core when a player shoots it from beyond its aggro radius', () => {
    const { simulation, player } = arena();
    const { core } = simulation.state;
    const grump = placeEnemy(simulation.state, 'grump', core.x, 100);
    park(player, core.x, 100 + 230);

    simulation.step([commandFor(0, { aim: { x: 0, y: -1 }, fire: true })]);
    steps(simulation, 19);

    expect(grump.hp).toBe(10);
    expect(grump.lastHitBy).toBe(0);
    expect(grump.target).toBe('core');
    expect({ x: grump.x, y: grump.y }).toEqual({ x: core.x, y: 100 + 20 * 2.5 });
  });

  it('spreads a horde apart while it marches', () => {
    const { simulation } = arena();
    const { core } = simulation.state;
    const left = placeEnemy(simulation.state, 'queue', core.x - 2, 100);
    const right = placeEnemy(simulation.state, 'queue', core.x + 2, 100);

    steps(simulation, 20);

    expect(right.x - left.x).toBeGreaterThan(16);
    expect(left.y).toBeGreaterThan(130);
    expect(right.y).toBeGreaterThan(130);
  });

  it('keeps a shooter at its distance from the target, backing off when too close', () => {
    const { simulation } = arena();
    const { core } = simulation.state;
    const far = placeEnemy(simulation.state, 'drizzle', core.x, 20);
    const close = placeEnemy(simulation.state, 'drizzle', core.x + 100, core.y);
    const gap = (enemy: EnemyState) => distance(enemy, core) - enemy.radius - core.radius;

    steps(simulation, 200);

    expect(gap(far)).toBeCloseTo(200, 9);
    expect(gap(close)).toBeCloseTo(200, 9);
  });

  it('pushes a trap out of the way of a heavy', () => {
    const { simulation } = arena();
    const { core, traps } = simulation.state;
    const bouncer = placeEnemy(simulation.state, 'doorman', core.x, 100);
    traps.push({
      id: 99,
      kind: 'speaker-stack',
      ownerId: 0,
      x: core.x + 5,
      y: 200,
      prevX: core.x + 5,
      prevY: 200,
      level: 1,
      direction: { x: 1, y: 0 },
      hp: 100,
      cooldown: 0,
    });
    const trap = traps[0];

    steps(simulation, 150);

    expect(trap).toBeDefined();
    expect(trap?.y).toBeGreaterThan(200);
    expect(distance(bouncer, trap ?? core)).toBeGreaterThanOrEqual(20 + 24 - 1e-9);
  });

  it('leaves a trap in place when a rusher walks through it', () => {
    const { simulation } = arena();
    const { core, traps } = simulation.state;
    placeEnemy(simulation.state, 'grump', core.x, 100);
    traps.push({
      id: 99,
      kind: 'speaker-stack',
      ownerId: 0,
      x: core.x,
      y: 200,
      prevX: core.x,
      prevY: 200,
      level: 1,
      direction: { x: 1, y: 0 },
      hp: 100,
      cooldown: 0,
    });

    steps(simulation, 100);

    expect(traps[0]).toMatchObject({ x: core.x, y: 200 });
  });

  it('holds a stunned enemy in place and slows a slowed one', () => {
    const { simulation } = arena();
    const stunned = placeEnemy(simulation.state, 'grump', 400, 100);
    const slowed = placeEnemy(simulation.state, 'grump', 1200, 100);
    stunned.stunTicks = 100;
    slowed.slowFactor = 0.5;
    const slowedStart = { x: slowed.x, y: slowed.y };

    steps(simulation, 1);
    const slowedStep = distance(slowed, slowedStart);
    steps(simulation, 2);
    const whileStunned = { x: stunned.x, y: stunned.y };
    stunned.stunTicks = 0;
    steps(simulation, 1);

    expect(slowedStep).toBeCloseTo(1.25, 12);
    expect(whileStunned).toEqual({ x: 400, y: 100 });
    expect(distance(stunned, { x: 400, y: 100 })).toBeCloseTo(2.5, 12);
  });
});
