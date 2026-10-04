import { describe, expect, it } from 'vitest';
import { COMBAT_OPTIONS, placeEnemy } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { PlayerState, ProjectileOwner, ProjectileState, SimState } from '../state';

function arena(): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation(COMBAT_OPTIONS);
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  player.x = 100;
  player.y = 800;
  return { simulation, player };
}

function launch(
  state: SimState,
  owner: ProjectileOwner,
  at: { x: number; y: number },
  velocity: { x: number; y: number },
  extra: Partial<ProjectileState> = {},
): ProjectileState {
  const projectile: ProjectileState = {
    id: state.nextEntityId,
    owner,
    x: at.x,
    y: at.y,
    prevX: at.x,
    prevY: at.y,
    vx: velocity.x,
    vy: velocity.y,
    radius: 4,
    damage: 10,
    ticksLeft: 100,
    pierceLeft: 0,
    ...extra,
  };
  state.nextEntityId += 1;
  state.projectiles.push(projectile);
  return projectile;
}

function steps(simulation: Simulation, count: number): void {
  for (let i = 0; i < count; i++) {
    simulation.step([]);
  }
}

const byPlayer: ProjectileOwner = { kind: 'player', playerId: 0 };

describe('projectiles', () => {
  it('fly at their velocity and vanish once their ticks run out', () => {
    const { simulation } = arena();
    const projectile = launch(
      simulation.state,
      byPlayer,
      { x: 300, y: 300 },
      { x: 3, y: -4 },
      {
        ticksLeft: 5,
      },
    );

    steps(simulation, 4);
    const afterFour = { x: projectile.x, y: projectile.y, ticksLeft: projectile.ticksLeft };
    steps(simulation, 1);

    expect(afterFour).toEqual({ x: 312, y: 284, ticksLeft: 1 });
    expect(simulation.state.projectiles).toEqual([]);
  });

  it('vanish once out of the arena', () => {
    const { simulation } = arena();
    launch(simulation.state, byPlayer, { x: 10, y: 300 }, { x: -12, y: 0 });

    steps(simulation, 1);

    expect(simulation.state.projectiles).toEqual([]);
  });

  it('hurt the first enemy a player projectile touches, then stop', () => {
    const { simulation } = arena();
    const { state } = simulation;
    const first = placeEnemy(state, 'doorman', 500, 100);
    const second = placeEnemy(state, 'doorman', 560, 100);
    launch(state, byPlayer, { x: 440, y: 100 }, { x: 12, y: 0 });
    const hpBefore = first.hp;

    steps(simulation, 4);

    expect(first.hp).toBe(hpBefore - 10);
    expect(second.hp).toBe(hpBefore);
    expect(state.projectiles).toEqual([]);
    expect(state.stats.damageDealt).toBe(10);
    expect(first.lastHitBy).toBe(0);
  });

  it('report each hit with an event', () => {
    const { simulation } = arena();
    const { state } = simulation;
    const enemy = placeEnemy(state, 'doorman', 500, 100);
    launch(state, byPlayer, { x: 470, y: 100 }, { x: 12, y: 0 });

    simulation.step([]);

    expect(state.events).toContainEqual({
      type: 'enemyHit',
      id: enemy.id,
      damage: 10,
      x: enemy.x,
      y: enemy.y,
    });
  });

  it('pierce as many enemies as their pierce allows, hitting each one once', () => {
    const { simulation } = arena();
    const { state } = simulation;
    const line = [500, 540, 580].map((x) => placeEnemy(state, 'doorman', x, 100));
    const full = line[0]?.hp ?? 0;
    launch(state, byPlayer, { x: 470, y: 100 }, { x: 4, y: 0 }, { pierceLeft: 1 });

    steps(simulation, 40);

    expect(line.map((enemy) => full - enemy.hp)).toEqual([10, 10, 0]);
    expect(state.projectiles).toEqual([]);
  });

  it('deal the bonus of the lure to a marked enemy', () => {
    const { simulation } = arena();
    const { state } = simulation;
    const enemy = placeEnemy(state, 'doorman', 500, 100);
    enemy.marked = true;
    launch(state, byPlayer, { x: 470, y: 100 }, { x: 12, y: 0 });

    simulation.step([]);

    expect(enemy.maxHp - enemy.hp).toBe(20);
  });

  it('skip an enemy that is already dead this tick', () => {
    const { simulation } = arena();
    const { state } = simulation;
    const dead = placeEnemy(state, 'doorman', 500, 100);
    const behind = placeEnemy(state, 'doorman', 540, 100);
    dead.hp = 0;
    launch(state, byPlayer, { x: 520, y: 100 }, { x: 0, y: 0 });

    simulation.step([]);

    expect(behind.maxHp - behind.hp).toBe(10);
  });

  it('credit a player hit to its player and leave the target alone', () => {
    const { simulation } = arena();
    const { state } = simulation;
    const enemy = placeEnemy(state, 'doorman', 500, 100);
    launch(state, byPlayer, { x: 470, y: 100 }, { x: 12, y: 0 });

    simulation.step([]);

    expect(enemy.maxHp - enemy.hp).toBe(10);
    expect(enemy.lastHitBy).toBe(0);
    expect(enemy.target).toBe('core');
  });

  it('credit a trap hit to no player and leave the target alone', () => {
    const { simulation } = arena();
    const { state } = simulation;
    const enemy = placeEnemy(state, 'doorman', 500, 100);
    launch(state, { kind: 'trap', trapId: 7 }, { x: 470, y: 100 }, { x: 12, y: 0 });

    simulation.step([]);

    expect(enemy.maxHp - enemy.hp).toBe(10);
    expect(enemy.lastHitBy).toBeUndefined();
    expect(enemy.target).toBe('core');
  });

  it('let an enemy projectile hurt a player and the core, but never an enemy', () => {
    const { simulation, player } = arena();
    const { state } = simulation;
    const bystander = placeEnemy(state, 'doorman', 300, 800);
    const fromEnemy: ProjectileOwner = { kind: 'enemy', enemyId: bystander.id };
    launch(state, fromEnemy, { x: 300, y: 800 }, { x: -12, y: 0 });
    launch(state, fromEnemy, { x: state.core.x, y: 216 }, { x: 0, y: 12 });

    steps(simulation, 16);

    expect(bystander.hp).toBe(bystander.maxHp);
    expect(player.hp).toBe(90);
    expect(state.core.hp).toBe(990);
    expect(state.projectiles).toEqual([]);
  });

  it('let an enemy projectile spend itself harmlessly on an invulnerable player', () => {
    const { simulation, player } = arena();
    const { state } = simulation;
    player.invulnerableTicks = 1_000;
    launch(state, { kind: 'enemy', enemyId: 99 }, { x: 130, y: 800 }, { x: -12, y: 0 });

    simulation.step([]);

    expect(player.hp).toBe(100);
    expect(state.events.filter((event) => event.type === 'playerHit')).toEqual([]);
    expect(state.projectiles).toEqual([]);
  });

  it('let a player projectile fly through players and the core', () => {
    const { simulation, player } = arena();
    const { state } = simulation;
    launch(state, byPlayer, { x: 300, y: 800 }, { x: -12, y: 0 });
    launch(state, byPlayer, { x: state.core.x, y: 216 }, { x: 0, y: 12 });

    steps(simulation, 16);

    expect(player.hp).toBe(100);
    expect(state.core.hp).toBe(1000);
    expect(state.projectiles).toHaveLength(2);
  });
});
