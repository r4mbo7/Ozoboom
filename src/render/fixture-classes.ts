import type { RenderContent } from './context';

// Skills by kind, as the V0.2 classes will have them: the mage nova, the roadie dash, the care heal
// pulse.
export const FIXTURE_CLASSES: RenderContent['classes'] = [
  {
    id: 'mage',
    skill: { effect: { kind: 'nova', damage: 40, radius: 150, knockback: 60 } },
  },
  {
    id: 'tank',
    skill: { effect: { kind: 'dash', distance: 110, invulnerableTicks: 12, tauntRadius: 150 } },
  },
  {
    id: 'healer',
    skill: { effect: { kind: 'healPulse', amount: 20, radius: 160, coreRepair: 8 } },
  },
];

export type FixtureEvent = 'beat' | 'enemyDied' | 'coreHit' | 'speakerPlugged' | 'charge' | 'heal';
