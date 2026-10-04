import { describe, expect, it } from 'vitest';
import { armedArena, stand, stepTo, thrownWeapon } from './thrown.test-support';

const lob = thrownWeapon('lob', {
  kind: 'lob',
  damage: 30,
  radius: 80,
  range: 260,
  flightTicks: 10,
});

describe('lob', () => {
  it('aims at the densest group within range, not the closest bad vibe', () => {
    const { simulation } = armedArena(lob);
    stand(simulation, 400, 340);
    const crowd = [
      stand(simulation, 600, 400),
      stand(simulation, 620, 420),
      stand(simulation, 640, 400),
    ];
    stand(simulation, 400, 800);

    stepTo(simulation, 24);

    const [shot] = simulation.state.projectiles;
    expect(shot?.arc?.ticksTotal).toBe(10);
    expect(shot?.arc?.toX).toBeGreaterThanOrEqual(600);
    expect(shot?.arc?.toX).toBeLessThanOrEqual(640);
    expect(crowd.every((enemy) => enemy.hp === 1000)).toBe(true);
  });

  it('ignores a bigger group out of range', () => {
    const { simulation } = armedArena(lob);
    const near = stand(simulation, 400, 300);
    for (const y of [700, 710, 720]) {
      stand(simulation, 400, y);
    }

    stepTo(simulation, 24);

    expect(simulation.state.projectiles[0]?.arc?.toY).toBe(near.y);
  });

  it('touches nothing in flight then hurts and pushes everyone around the landing point', () => {
    const { simulation } = armedArena(lob);
    const under = stand(simulation, 500, 400);
    const inside = stand(simulation, 560, 400);
    const outside = stand(simulation, 700, 400);

    stepTo(simulation, 24 + 8);
    expect([under.hp, inside.hp, outside.hp]).toEqual([1000, 1000, 1000]);
    simulation.step([]);

    expect(simulation.state.projectiles).toHaveLength(0);
    expect([under.hp, inside.hp, outside.hp]).toEqual([970, 970, 1000]);
    expect(inside.x).toBeGreaterThan(560);
    expect(simulation.state.events.filter((event) => event.type === 'enemyHit')).toHaveLength(2);
  });

  it('does not throw when nothing is within range', () => {
    const { simulation } = armedArena(lob);
    stand(simulation, 1500, 800);

    stepTo(simulation, 24);

    expect(simulation.state.projectiles).toHaveLength(0);
  });

  describe('with dropRain', () => {
    const rain = thrownWeapon(
      'rain',
      { kind: 'lob', damage: 30, radius: 80, range: 100, flightTicks: 10, dropRain: true },
      [0, 4, 8, 12],
    );

    it('lobs only on the first beat of the bar, within range, outside the drop', () => {
      const { simulation } = armedArena(rain);
      stand(simulation, 400, 350);
      stand(simulation, 800, 800);

      const lobbed: number[] = [];
      let ids = simulation.state.nextEntityId;
      while (simulation.state.tick < 48) {
        simulation.step([]);
        if (simulation.state.nextEntityId > ids) {
          lobbed.push(simulation.state.tick);
          ids = simulation.state.nextEntityId;
        }
      }

      expect(lobbed).toEqual([48]);
    });

    it('lobs from the first beat across the whole arena during the drop', () => {
      const { simulation } = armedArena(rain);
      stand(simulation, 900, 800);
      simulation.state.set.segment = 'drop';

      stepTo(simulation, 12);

      expect(simulation.state.projectiles.map(({ arc }) => [arc?.toX, arc?.toY])).toEqual([
        [900, 800],
      ]);
    });
  });
});
