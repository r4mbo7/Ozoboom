import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { commandFor, peaceful } from '../sim/fixtures';
import { createSimulation } from '../sim/index';
import { applyModifiers } from '../sim/stats';
import { skillCharge } from './hud';

function vjWithTwoLoops() {
  const simulation = peaceful(
    createSimulation({
      seed: 1,
      players: [{ id: 0, classId: 'mage' }],
      setId: CONTENT.sets[0]?.id ?? '',
      content: CONTENT,
    }),
  );
  const player = simulation.state.players[0];
  const vj = CONTENT.classes.find((definition) => definition.id === 'mage');
  const loop = CONTENT.upgrades.find((upgrade) => upgrade.id === 'boucle-vj');
  if (player === undefined || vj === undefined || loop === undefined) {
    throw new Error('expected the VJ and the Boucle VJ upgrade');
  }
  applyModifiers(player, loop.modifiers);
  applyModifiers(player, loop.modifiers);
  return { simulation, player, skill: vj.skill };
}

describe('skillCharge', () => {
  it('fills over the whole-tick total the sim armed, with Boucle VJ twice', () => {
    const { simulation, player, skill } = vjWithTwoLoops();
    simulation.step([commandFor(0, { skill: true })]);
    const armed = player.skillCooldown;

    const charges = [skillCharge(player, skill)];
    for (let elapsed = 1; elapsed <= armed; elapsed++) {
      simulation.step([commandFor(0)]);
      charges.push(skillCharge(player, skill));
    }

    expect(armed).toBe(123);
    charges.forEach((charge, elapsed) => {
      expect(charge).toBeCloseTo(elapsed / armed, 12);
    });
  });
});
