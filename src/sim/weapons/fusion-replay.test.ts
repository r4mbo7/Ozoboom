import { describe, expect, it } from 'vitest';
import type { GameContent } from '../../data/types';
import { FIXTURE_CONTENT, FIXTURE_OPTIONS, actionsFor, commandFor } from '../fixtures';
import { createSimulation } from '../index';
import { hashState } from '../replay';
import type { SimEvent } from '../state';
import { thrownWeapon } from './thrown.test-support';

const REFERENCE_HASH = '26a4571f';
const SCRIPT_TICKS = 900;
const FUSE_AT_TICK = 200;

const content: GameContent = {
  ...FIXTURE_CONTENT,
  upgrades: [
    ...FIXTURE_CONTENT.upgrades,
    {
      id: 'twin',
      name: 'twin',
      description: 'twin',
      family: 'generic',
      modifiers: [{ stat: 'speedMul', mul: 1.05 }],
      maxStacks: 2,
    },
  ],
  weapons: [
    thrownWeapon('ribbon', { kind: 'ribbon', length: 220, markedTicks: 48 }, [2, 6, 10, 14]),
    thrownWeapon('stick', { kind: 'sweep', damage: 8, radius: 90, arcDegrees: 120 }, [0, 4, 8, 12]),
    {
      ...thrownWeapon(
        'double-stick',
        { kind: 'sweep', damage: 16, radius: 110, arcDegrees: 360 },
        [0, 4, 8, 12],
      ),
      evolvedFrom: 'stick',
      maxLevel: 1,
    },
  ],
  fusions: [{ weaponId: 'stick', upgradeId: 'twin', resultId: 'double-stick' }],
};

function play() {
  const simulation = createSimulation({ ...FIXTURE_OPTIONS, seed: 11, content });
  const [player] = simulation.state.players;
  if (player === undefined) {
    throw new Error('expected a player');
  }
  player.weapons = [
    { id: 'ribbon', level: 1, phase: 0 },
    { id: 'stick', level: 3, phase: 0 },
  ];
  player.upgrades = ['twin', 'twin'];
  const events: SimEvent[] = [];
  for (let i = 0; i < SCRIPT_TICKS; i++) {
    if (simulation.state.tick === FUSE_AT_TICK && simulation.state.status === 'running') {
      player.vibes = player.vibesToNextLevel;
    }
    const offer = simulation.state.pendingUpgrades[0]?.options;
    const pick = offer?.includes('double-stick') ? 'double-stick' : offer?.[0];
    simulation.step([
      pick === undefined
        ? commandFor(0, { move: { x: 1, y: 0 }, aim: { x: 1, y: 0 } })
        : actionsFor(0, { type: 'chooseUpgrade', upgradeId: pick }),
    ]);
    events.push(...simulation.state.events);
  }
  return { simulation, events };
}

describe('ribbon and fusion replay', () => {
  it('reaches the same state twice from the same seed', () => {
    expect(hashState(play().simulation.state)).toBe(hashState(play().simulation.state));
  });

  it('plays a scripted game with the ribbon and a fusion, with a fixed fingerprint', () => {
    const { simulation, events } = play();

    expect(events.filter((event) => event.type === 'weaponEvolved')).toEqual([
      { type: 'weaponEvolved', playerId: 0, weaponId: 'stick', resultId: 'double-stick' },
    ]);
    expect(
      events.some((event) => event.type === 'weaponFired' && event.weaponId === 'ribbon'),
    ).toBe(true);
    expect(simulation.state.players[0]?.weapons?.map((slot) => slot.id)).toEqual([
      'ribbon',
      'double-stick',
    ]);
    expect(hashState(simulation.state)).toBe(REFERENCE_HASH);
  });
});
