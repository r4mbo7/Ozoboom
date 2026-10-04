import { describe, expect, it } from 'vitest';
import type { AttackDefinition, StatKey } from '../../data/types';
import { length } from '../../shared/vec';
import type { PlayerInput } from '../commands';
import { COMBAT_CONTENT, COMBAT_OPTIONS, commandFor } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { PlayerState, ProjectileState } from '../state';

function shooter(
  attack: Partial<AttackDefinition> = {},
  modifiers: Partial<Record<StatKey, number>> = {},
): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation({
    ...COMBAT_OPTIONS,
    content: {
      ...COMBAT_CONTENT,
      classes: COMBAT_CONTENT.classes.map((definition) => ({
        ...definition,
        attack: { ...definition.attack, ...attack },
      })),
    },
  });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  player.modifiers = modifiers;
  return { simulation, player };
}

function fireTicks(simulation: Simulation, input: Partial<PlayerInput>, ticks: number): number[] {
  const fired: number[] = [];
  for (let i = 0; i < ticks; i++) {
    simulation.step([commandFor(0, input)]);
    if (simulation.state.events.some((event) => event.type === 'playerFired')) {
      fired.push(simulation.state.tick);
    }
  }
  return fired;
}

const aimUp = { aim: { x: 0, y: -1 }, fire: true };

describe('player attack', () => {
  it('fires a projectile from the player along the aim, with the stats of the class', () => {
    const { simulation, player } = shooter();
    const from = { x: player.x, y: player.y };

    simulation.step([commandFor(0, aimUp)]);

    const projectile = simulation.state.projectiles[0];
    expect(simulation.state.projectiles).toHaveLength(1);
    expect(projectile).toMatchObject({
      owner: { kind: 'player', playerId: 0 },
      prevX: from.x,
      prevY: from.y,
      vx: 0,
      vy: -12,
      radius: 4,
      damage: 10,
      pierceLeft: 0,
    });
    expect(projectile?.ticksLeft).toBe(40 - 1);
    expect(simulation.state.events).toContainEqual({
      type: 'playerFired',
      playerId: 0,
      x: from.x,
      y: from.y,
      angle: -Math.PI / 2,
    });
  });

  it('fires again every cooldown while the trigger is held, and not without it', () => {
    const { simulation } = shooter();

    const idle = fireTicks(simulation, { aim: { x: 0, y: -1 } }, 5);
    const held = fireTicks(simulation, aimUp, 40);

    expect(idle).toEqual([]);
    expect(held).toEqual([6, 18, 30, 42]);
  });

  it('is ready to fire as soon as the cooldown has run out, even while not firing', () => {
    const { simulation } = shooter();
    fireTicks(simulation, aimUp, 1);

    const idle = fireTicks(simulation, {}, 20);
    const again = fireTicks(simulation, aimUp, 1);

    expect(idle).toEqual([]);
    expect(again).toEqual([22]);
  });

  it('keeps the exact fire rate of a cooldown shortened to a fraction of a tick', () => {
    const { simulation } = shooter({}, { attackCooldownMul: 0.85 });

    const fired = fireTicks(simulation, aimUp, 52);

    expect(fired).toEqual([1, 12, 22, 32, 42, 52]);
  });

  it('applies the damage, projectile speed and pierce modifiers', () => {
    const { simulation } = shooter({}, { damageMul: 1.5, projectileSpeedMul: 2, pierceAdd: 2 });

    simulation.step([commandFor(0, aimUp)]);

    expect(simulation.state.projectiles[0]).toMatchObject({ damage: 15, vy: -24, pierceLeft: 2 });
  });

  it('spreads extra projectiles evenly over the spread of the attack, centered on the aim', () => {
    const { simulation } = shooter({ spreadRadians: Math.PI / 2 }, { projectileCountAdd: 2 });

    simulation.step([commandFor(0, { aim: { x: 1, y: 0 }, fire: true })]);

    const velocities = simulation.state.projectiles.map((p: ProjectileState) => ({
      x: p.vx / 12,
      y: p.vy / 12,
    }));
    expect(velocities).toHaveLength(3);
    const [low, middle, high] = velocities;
    expect(middle).toEqual({ x: 1, y: 0 });
    expect(low?.x).toBeCloseTo(Math.SQRT1_2, 14);
    expect(low?.y).toBeCloseTo(-Math.SQRT1_2, 14);
    expect(high?.x).toBeCloseTo(Math.SQRT1_2, 14);
    expect(high?.y).toBeCloseTo(Math.SQRT1_2, 14);
    for (const velocity of velocities) {
      expect(length(velocity)).toBeCloseTo(1, 14);
    }
    expect(simulation.state.events.filter((event) => event.type === 'playerFired')).toHaveLength(1);
  });

  it('lets a downed player hold the trigger in vain', () => {
    const { simulation, player } = shooter();
    player.downed = true;

    const fired = fireTicks(simulation, aimUp, 30);

    expect(fired).toEqual([]);
    expect(simulation.state.projectiles).toEqual([]);
  });
});
