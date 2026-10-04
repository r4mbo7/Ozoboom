import { describe, expect, it } from 'vitest';
import { COMBAT_OPTIONS, FIXTURE_SHOOTER, placeEnemy, stepAndRecord } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { PlayerState } from '../state';

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

describe('enemy attacks', () => {
  it('hit the core on contact, then once per attack cooldown', () => {
    const { simulation } = arena();
    const { core } = simulation.state;
    placeEnemy(simulation.state, 'grump', core.x, core.y - core.radius - 12);

    const recorded = stepAndRecord(simulation, 60);

    expect(recorded.filter(({ event }) => event.type === 'coreHit')).toEqual([
      { tick: 1, event: { type: 'coreHit', damage: 5 } },
      { tick: 25, event: { type: 'coreHit', damage: 5 } },
      { tick: 49, event: { type: 'coreHit', damage: 5 } },
    ]);
    expect(core.hp).toBe(1000 - 15);
  });

  it('hurt the player they chase and down them at zero', () => {
    const { simulation, player } = arena();
    const bouncer = placeEnemy(simulation.state, 'doorman', player.x + 34, player.y);
    player.hp = 20;

    const recorded = stepAndRecord(simulation, 37);

    expect(bouncer.target).toBe(0);
    expect(
      recorded.filter(({ event }) => event.type === 'playerHit' || event.type === 'playerDowned'),
    ).toEqual([
      { tick: 1, event: { type: 'playerHit', playerId: 0, damage: 12 } },
      { tick: 37, event: { type: 'playerHit', playerId: 0, damage: 12 } },
      { tick: 37, event: { type: 'playerDowned', playerId: 0 } },
    ]);
    expect(player).toMatchObject({ hp: 0, downed: true });
  });

  it('spare a player while they are invulnerable', () => {
    const { simulation, player } = arena();
    placeEnemy(simulation.state, 'doorman', player.x + 34, player.y);
    player.invulnerableTicks = 1_000;

    const recorded = stepAndRecord(simulation, 40);

    expect(recorded.filter(({ event }) => event.type === 'playerHit')).toEqual([]);
    expect(player.hp).toBe(100);
  });

  it('leave the core alone while they are not touching it', () => {
    const { simulation } = arena();
    const { core } = simulation.state;
    placeEnemy(simulation.state, 'grump', core.x, core.y - core.radius - 12 - 30);

    const recorded = stepAndRecord(simulation, 11);

    expect(recorded.filter(({ event }) => event.type === 'coreHit')).toEqual([]);
  });

  it('let a stunned enemy rest until its stun is over', () => {
    const { simulation } = arena();
    const { core } = simulation.state;
    const grump = placeEnemy(simulation.state, 'grump', core.x, core.y - core.radius - 12);
    grump.stunTicks = 100;

    const whileStunned = stepAndRecord(simulation, 30);
    grump.stunTicks = 0;
    const afterwards = stepAndRecord(simulation, 1);

    expect(whileStunned.filter(({ event }) => event.type === 'coreHit')).toEqual([]);
    expect(afterwards.filter(({ event }) => event.type === 'coreHit')).toEqual([
      { tick: 31, event: { type: 'coreHit', damage: 5 } },
    ]);
  });

  it('make a shooter fire at its target once in range, then once per attack cooldown', () => {
    const { simulation } = arena();
    const { core, projectiles } = simulation.state;
    const drizzle = placeEnemy(simulation.state, 'drizzle', core.x, 20);

    const firstShotTick = stepUntil(simulation, () => projectiles.length > 0);
    const reachAtShot = core.y - core.radius - drizzle.y;
    const shot = { ...projectiles[0] };
    stepAndRecord(simulation, 47);
    const beforeCooldown = projectiles.length;
    simulation.step([]);

    expect(firstShotTick).toBe(16);
    expect(reachAtShot).toBe(7 * 50);
    expect(shot).toMatchObject({
      owner: { kind: 'enemy', enemyId: drizzle.id },
      x: core.x,
      vx: 0,
      vy: 7,
      radius: FIXTURE_SHOOTER.ranged?.projectileRadius,
      damage: 5,
      ticksLeft: 50,
    });
    expect(beforeCooldown).toBe(1);
    expect(projectiles).toHaveLength(2);
  });
});

function stepUntil(simulation: Simulation, done: () => boolean): number {
  while (!done()) {
    simulation.step([]);
  }
  return simulation.state.tick;
}
