import type { TrapDefinition, TrapWear } from './types';

// About three minutes at the main stage's 145 bpm (2 min 45), half as strong after 1 min 45 and a fifth
// just before it goes out; a fifth longer per Volume level. The Rallonge recharges a trap at most
// every 16 bars, about 26 s.
export const TRAP_WEAR: TrapWear = {
  lifetimeBars: 100,
  faintest: 0.2,
  lifetimePerVolume: 0.2,
  rechargeEveryBars: 16,
  plugInBeats: 0.5,
  pluggedBeats: 1,
  unplugBeats: 0.25,
};

export const TRAPS: readonly TrapDefinition[] = [
  {
    id: 'caisson-de-basse',
    name: 'Subwoofer',
    takeLabel: 'Take the subwoofer',
    putLabel: 'Drop the subwoofer',
    description: 'Sends a bass wave on every beat and pushes the bad vibes back.',
    radius: 18,
    cadence: 'beat',
    effect: { kind: 'shockwave', damage: 5, radius: 75, knockback: 8 },
    carrierWeight: 3,
  },
  {
    id: 'laser',
    name: 'Laser',
    takeLabel: 'Take the laser',
    putLabel: 'Drop the laser',
    description: 'Sweeps an arc with a line of light that dissolves the bad vibes.',
    radius: 14,
    cadence: 'continuous',
    effect: { kind: 'beam', damagePerTick: 2, length: 360, width: 12, sweepDegrees: 90 },
    carrierWeight: 2,
  },
  {
    id: 'ventilateur-brumisant',
    name: 'Misting Fan',
    takeLabel: 'Take the fan',
    putLabel: 'Drop the fan',
    description:
      'Blows a cone of mist that sweeps the floor, heals on every beat and slows the bad vibes.',
    radius: 16,
    cadence: 'continuous',
    effect: {
      kind: 'breeze',
      slowFactor: 0.7,
      healPerBeat: 3,
      length: 200,
      coneDegrees: 50,
      sweepDegrees: 90,
    },
    carrierWeight: 0.1,
    shade: 110,
  },
];
