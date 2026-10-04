import { describe, expect, it } from 'vitest';
import { armedArena, stand, stepTo, thrownWeapon } from './thrown.test-support';

const spark = thrownWeapon('spark', {
  kind: 'spark',
  damage: 5,
  speed: 20,
  pierce: 2,
  rangeTicks: 10,
});

describe('spark', () => {
  it('goes through pierce bad vibes then stops on the next one', () => {
    const { simulation } = armedArena(spark);
    const hit = [460, 520, 580].map((x) => stand(simulation, x, 400));
    const behind = stand(simulation, 640, 400);

    stepTo(simulation, 24 + 10);

    expect(hit.map((enemy) => enemy.hp)).toEqual([995, 995, 995]);
    expect(behind.hp).toBe(1000);
    expect(simulation.state.projectiles).toHaveLength(0);
  });

  it('flies towards the closest bad vibe at its speed', () => {
    const { simulation } = armedArena(spark);
    stand(simulation, 400, 340);
    stand(simulation, 700, 400);

    stepTo(simulation, 24);

    const [shot] = simulation.state.projectiles;
    expect(shot?.owner).toEqual({ kind: 'weapon', playerId: 0, weaponId: 'spark' });
    expect(shot?.vx).toBe(0);
    expect(shot?.vy).toBe(-20);
  });

  it('lives rangeTicks and does nothing on an empty field', () => {
    const { simulation } = armedArena(spark);

    stepTo(simulation, 24);
    expect(simulation.state.projectiles).toHaveLength(0);
    stand(simulation, 1500, 400);
    stepTo(simulation, 72);
    expect(simulation.state.projectiles).toHaveLength(1);
    stepTo(simulation, 72 + 9);

    expect(simulation.state.projectiles).toHaveLength(0);
  });
});
