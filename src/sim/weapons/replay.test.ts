import { describe, expect, it } from 'vitest';
import type { GameContent } from '../../data/types';
import { FIXTURE_CONTENT, FIXTURE_OPTIONS, stepAndRecord } from '../fixtures';
import { createSimulation } from '../index';
import { hashState } from '../replay';
import { thrownWeapon } from './thrown.test-support';

const REFERENCE_HASH = 'bd478e05';
const SCRIPT_TICKS = 900;

const content: GameContent = {
  ...FIXTURE_CONTENT,
  weapons: [
    thrownWeapon(
      'spark',
      { kind: 'spark', damage: 5, speed: 18, pierce: 3, rangeTicks: 24 },
      [0, 4, 8, 12],
    ),
    thrownWeapon('lob', { kind: 'lob', damage: 30, radius: 80, range: 260, flightTicks: 24 }, [0]),
    thrownWeapon(
      'frisbee',
      { kind: 'boomerang', damage: 14, heal: 6, range: 280, speed: 16 },
      [4, 12],
    ),
  ],
};

function play() {
  const simulation = createSimulation({ ...FIXTURE_OPTIONS, seed: 7, content });
  const [player] = simulation.state.players;
  if (player === undefined) {
    throw new Error('expected a player');
  }
  player.weapons = ['spark', 'lob', 'frisbee'].map((id) => ({ id, level: 1, phase: 0 }));
  return { simulation, recorded: stepAndRecord(simulation, SCRIPT_TICKS) };
}

describe('thrown weapons replay', () => {
  it('reaches the same state twice from the same seed', () => {
    expect(hashState(play().simulation.state)).toBe(hashState(play().simulation.state));
  });

  it('plays a scripted game with the three weapons, with a fixed fingerprint', () => {
    const { simulation, recorded } = play();

    const fired = new Set(
      recorded.flatMap(({ event }) => (event.type === 'weaponFired' ? [event.weaponId] : [])),
    );
    expect([...fired].sort()).toEqual(['frisbee', 'lob', 'spark']);
    expect(simulation.state.stats.damageDealt).toBeGreaterThan(0);
    expect(hashState(simulation.state)).toBe(REFERENCE_HASH);
  });
});
