import { describe, expect, it } from 'vitest';
import { CLASSES } from '../data/classes';
import { MAIN_TEMPO } from '../shared/tempo';
import { portraitEvents, standing } from './portrait-state';

function classNamed(id: string) {
  const found = CLASSES.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`No class ${id}`);
  }
  return found;
}

describe('portraitEvents', () => {
  it('steps and fires on every beat, and uses the skill once every two bars, one bar in', () => {
    const mage = classNamed('mage');
    const player = standing(mage);

    const ticks = Array.from({ length: 4 * MAIN_TEMPO.ticksPerBar }, (_, tick) => tick);
    const events = ticks.map((tick) => portraitEvents(tick, player, mage.skill.effect));

    const at = (type: string) =>
      ticks.filter((tick) => events[tick]?.some((event) => event.type === type));
    expect(at('beat')).toEqual(ticks.filter((tick) => tick % MAIN_TEMPO.ticksPerBeat === 0));
    expect(at('playerFired')).toEqual(at('beat'));
    expect(at('skillUsed')).toEqual([MAIN_TEMPO.ticksPerBar, 3 * MAIN_TEMPO.ticksPerBar]);
  });

  it('makes the roadie untouchable for its charge and heals the care with its pulse', () => {
    const tank = classNamed('tank');
    const healer = classNamed('healer');
    const roadie = standing(tank);
    const care = standing(healer);

    portraitEvents(MAIN_TEMPO.ticksPerBar, roadie, tank.skill.effect);
    const healed = portraitEvents(MAIN_TEMPO.ticksPerBar, care, healer.skill.effect);

    expect(roadie.invulnerableTicks).toBeGreaterThan(0);
    expect(healed.some((event) => event.type === 'playerHealed')).toBe(true);
  });
});
