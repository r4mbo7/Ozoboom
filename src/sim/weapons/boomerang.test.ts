import { describe, expect, it } from 'vitest';
import { armedArena, stand, stepTo, thrownWeapon } from './thrown.test-support';

const frisbee = thrownWeapon(
  'frisbee',
  { kind: 'boomerang', damage: 14, heal: 6, range: 200, speed: 20 },
  [8, 11],
);

describe('boomerang', () => {
  it('hurts on the way out and heals the thrower on the way back', () => {
    const { simulation, players } = armedArena(frisbee);
    const player = players[0];
    const bad = stand(simulation, 500, 400);
    if (player === undefined) {
      throw new Error('expected a player');
    }
    player.hp = 50;

    stepTo(simulation, 24 + 3);
    expect(bad.hp).toBe(986);
    expect(player.hp).toBe(50);
    stepTo(simulation, 24 + 25);

    expect(bad.hp).toBe(986);
    expect(player.hp).toBe(56);
    expect(simulation.state.projectiles).toHaveLength(0);
  });

  it('never heals above the maximum life', () => {
    const { simulation, players } = armedArena(frisbee);
    stand(simulation, 500, 400);
    const player = players[0];
    if (player === undefined) {
      throw new Error('expected a player');
    }
    player.hp = player.maxHp - 2;

    stepTo(simulation, 24 + 30);

    expect(player.hp).toBe(player.maxHp);
  });

  it('flies back to the most injured ally', () => {
    const { simulation, players } = armedArena(frisbee, 2);
    const [thrower, friend] = players;
    if (thrower === undefined || friend === undefined) {
      throw new Error('expected two players');
    }
    stand(simulation, 500, 400);
    friend.x = 300;
    friend.y = 400;
    friend.hp = 40;

    stepTo(simulation, 24 + 14);
    expect(simulation.state.projectiles[0]?.returnTo).toBe(friend.id);
    stepTo(simulation, 24 + 45);

    expect(friend.hp).toBe(46);
    expect(thrower.hp).toBe(thrower.maxHp);
  });

  it('waits for the first frisbee to return before throwing a second', () => {
    const { simulation, players } = armedArena(frisbee);
    stand(simulation, 500, 400);
    const player = players[0];
    if (player === undefined) {
      throw new Error('expected a player');
    }
    player.hp = 10;

    stepTo(simulation, 24 + 3);
    const firstId = simulation.state.projectiles[0]?.id;
    expect(simulation.state.projectiles).toHaveLength(1);
    stepTo(simulation, 24 + 9);
    expect(simulation.state.projectiles.map((shot) => shot.id)).toEqual([firstId]);
    stepTo(simulation, 72 + 1);

    expect(player.hp).toBe(16);
    expect(simulation.state.projectiles.map((shot) => shot.id)).not.toContain(firstId);
    expect(simulation.state.projectiles).toHaveLength(1);
  });
});
