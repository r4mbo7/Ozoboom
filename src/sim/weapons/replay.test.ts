import { describe, expect, it } from 'vitest';
import { hashState } from '../replay';
import { playThrown, replayScript } from '../replay-scripts';

describe('thrown weapons replay', () => {
  it('reaches the same state twice from the same seed', () => {
    expect(hashState(playThrown().simulation.state)).toBe(hashState(playThrown().simulation.state));
  });

  it('plays a scripted game with the three weapons, with a fixed fingerprint', () => {
    const { simulation, recorded } = playThrown();

    const fired = new Set(
      recorded.flatMap(({ event }) => (event.type === 'weaponFired' ? [event.weaponId] : [])),
    );
    expect([...fired].sort()).toEqual(['frisbee', 'lob', 'spark']);
    expect(simulation.state.stats.damageDealt).toBeGreaterThan(0);
    expect(hashState(simulation.state)).toBe(replayScript('thrown').hash);
  });
});
