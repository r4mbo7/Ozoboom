import { describe, expect, it } from 'vitest';
import { roundTripFromStats } from './stats';

describe('roundTripFromStats', () => {
  it('reads the pair the transport selected, on a side that never sees nominated', () => {
    const report = [
      { id: 'T1', type: 'transport', selectedCandidatePairId: 'P2' },
      { id: 'P1', type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.2 },
      { id: 'P2', type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.041 },
    ];

    expect(roundTripFromStats(report)).toBeCloseTo(41);
  });

  it('falls back to a nominated pair, then to a succeeded one', () => {
    const nominated = [
      { id: 'P1', type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.01 },
      { id: 'P2', type: 'candidate-pair', nominated: true, currentRoundTripTime: 0.05 },
    ];
    const succeeded = [
      { id: 'P1', type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.03 },
    ];

    expect(roundTripFromStats(nominated)).toBeCloseTo(50);
    expect(roundTripFromStats(succeeded)).toBeCloseTo(30);
  });

  it('gives null without a measured pair', () => {
    const report = [
      { id: 'P1', type: 'candidate-pair', state: 'waiting', currentRoundTripTime: 0.02 },
      { id: 'P2', type: 'candidate-pair', state: 'succeeded' },
      { id: 'X', type: 'data-channel' },
    ];

    expect(roundTripFromStats(report)).toBeNull();
    expect(roundTripFromStats([])).toBeNull();
  });
});
