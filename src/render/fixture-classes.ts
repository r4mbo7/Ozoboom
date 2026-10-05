import type { RenderContent } from './context';

// Skills by kind, as the V0.2 classes will have them: the mage nova, the roadie dash and barrier,
// the care heal pulse.
export const FIXTURE_CLASSES: RenderContent['classes'] = [
  {
    id: 'mage',
    skill: { effect: { kind: 'nova', damage: 40, radius: 150, knockback: 60 } },
    ultimate: {
      effect: { kind: 'laserShow', damagePerTick: 3, radius: 300, durationTicks: 96 },
    },
  },
  {
    id: 'tank',
    skill: { effect: { kind: 'dash', distance: 110, invulnerableTicks: 12, tauntRadius: 150 } },
    ultimate: { effect: { kind: 'barrier', hp: 60, radius: 80, durationTicks: 240 } },
  },
  {
    id: 'healer',
    skill: { effect: { kind: 'healPulse', amount: 20, radius: 160, coreRepair: 8 } },
    ultimate: {
      effect: { kind: 'healPulse', amount: 40, radius: 300, coreRepair: 20, revive: true },
    },
  },
];

export type FixtureEvent =
  | 'beat'
  | 'enemyDied'
  | 'coreHit'
  | 'speakerPlugged'
  | 'charge'
  | 'flightCase'
  | 'caseBroken'
  | 'heal'
  | 'rally';
