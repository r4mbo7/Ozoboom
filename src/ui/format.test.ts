import { describe, expect, it } from 'vitest';
import { TICK_RATE_HZ } from '../shared/tempo';
import { fixtureState } from './fixtures';
import { endStats, formatDuration, formatNumber, formatPercent, ratio } from './format';

describe('formatDuration', () => {
  it('shows minutes and zero-padded seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65 * TICK_RATE_HZ)).toBe('1:05');
    expect(formatDuration(12 * 60 * TICK_RATE_HZ + 59 * TICK_RATE_HZ + 28)).toBe('12:59');
  });
});

describe('formatNumber', () => {
  it('groups thousands the French way', () => {
    expect(formatNumber(1873)).toBe('1\u202f873');
  });
});

describe('ratio and formatPercent', () => {
  it('clamps to the gauge and survives an empty maximum', () => {
    expect(ratio(150, 100)).toBe(1);
    expect(ratio(-5, 100)).toBe(0);
    expect(ratio(5, 0)).toBe(0);
  });

  it('rounds to a whole percent with a narrow no-break space', () => {
    expect(formatPercent(0.416)).toBe('42\u202f%');
  });
});

describe('endStats', () => {
  it('lists phrases held, time, kills, the scene volume and the score', () => {
    const state = fixtureState({
      tick: 125 * TICK_RATE_HZ,
      core: { x: 0, y: 0, radius: 60, hp: 250, maxHp: 1000, watts: 0 },
      stats: { kills: 1042, phrasesHeld: 6, damageDealt: 0, vibesCollected: 0, wattsSpent: 0 },
    });

    expect(endStats(state)).toEqual([
      { label: 'Phrases tenues', value: '6' },
      { label: 'Temps', value: '2:05' },
      { label: 'Bad vibes dissipées', value: '1\u202f042' },
      { label: 'Vie de la scène', value: '25\u202f%' },
      { label: 'Score', value: '12\u202f510' },
    ]);
  });

  it('never shows a negative volume after a defeat', () => {
    const state = fixtureState({
      core: { x: 0, y: 0, radius: 60, hp: -40, maxHp: 1000, watts: 0 },
    });

    expect(endStats(state)[3]?.value).toBe('0\u202f%');
  });
});
