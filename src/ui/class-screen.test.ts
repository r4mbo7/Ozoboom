import { describe, expect, it } from 'vitest';
import { CLASSES } from '../data/classes';
import { STAT_STEPS, classStats } from './class-screen';

function statsOf(classId: string) {
  const info = CLASSES.find((entry) => entry.id === classId);
  if (info === undefined) {
    throw new Error(`No class ${classId}`);
  }
  return Object.fromEntries(classStats(CLASSES, info).map((stat) => [stat.label, stat]));
}

describe('classStats', () => {
  it('ranks the life, the speed and the reach of a class against the others', () => {
    const tank = statsOf('tank');
    const mage = statsOf('mage');

    expect(tank.Vie).toEqual({ label: 'Vie', value: '200', steps: STAT_STEPS });
    expect(mage.Vie?.steps).toBe(1);
    expect(mage.Vitesse).toEqual({ label: 'Vitesse', value: '7,5', steps: STAT_STEPS });
    expect(tank.Vitesse?.steps).toBe(1);
    expect(mage.Portée?.steps).toBe(STAT_STEPS);
    expect(tank.Portée?.steps).toBe(1);
  });

  it('puts a lone class in the middle of every scale', () => {
    const [only] = CLASSES;
    if (only === undefined) {
      throw new Error('No class');
    }

    const stats = classStats([only], only);

    expect(stats.map((stat) => stat.steps)).toEqual([3, 3, 3]);
  });
});
