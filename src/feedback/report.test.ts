import { describe, expect, it } from 'vitest';
import { fixtureForScreen } from '../ui/fixtures';
import { type FeedbackMeta, buildFeedbackReport } from './report';

const meta: FeedbackMeta = {
  version: '7643844469c2f8dc8e89881b3494cedff25a9a7b',
  device: 'gamepad',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/141.0',
  viewport: { width: 1280, height: 800, pixelRatio: 2 },
  calmMode: false,
  averageFps: 58.6,
};

describe('buildFeedbackReport', () => {
  it('describes the run and the machine, one field per line', () => {
    const state = fixtureForScreen('lost');

    const report = buildFeedbackReport(state, meta);

    expect(report.split('\n')).toEqual([
      'version: 7643844469c2f8dc8e89881b3494cedff25a9a7b',
      'seed: 42',
      'class: mage',
      'tier: 1',
      'phrase: 6',
      'tick: 4782 (2:44)',
      'status: lost',
      'stats: kills 1042, phrasesHeld 6, damageDealt 30500, vibesCollected 700',
      'device: gamepad',
      'browser: Mozilla/5.0 (X11; Linux x86_64) Chrome/141.0',
      'screen: 1280x800 @2x',
      'calm: no',
      'fps: 59',
    ]);
  });

  it('keeps only the machine fields before the first run', () => {
    const report = buildFeedbackReport(null, { ...meta, calmMode: true, averageFps: null });

    expect(report.split('\n')).toEqual([
      'version: 7643844469c2f8dc8e89881b3494cedff25a9a7b',
      'device: gamepad',
      'browser: Mozilla/5.0 (X11; Linux x86_64) Chrome/141.0',
      'screen: 1280x800 @2x',
      'calm: yes',
    ]);
  });

  it('rounds fractional statistics', () => {
    const state = fixtureForScreen('won');
    state.stats.damageDealt = 1234.5678;

    const report = buildFeedbackReport(state, meta);

    expect(report).toContain('damageDealt 1235,');
  });

  it('keeps a hostile user agent on one short line', () => {
    const userAgent = `Evil\nseed: 1\r\n${'x'.repeat(1000)}`;

    const report = buildFeedbackReport(null, { ...meta, userAgent });

    const browser = report.split('\n').find((line) => line.startsWith('browser: '));
    expect(browser).toMatch(/^browser: Evil seed: 1 x+…$/);
    expect(browser?.length).toBeLessThanOrEqual(260);
    expect(report.split('\n')).toHaveLength(6);
  });

  it('does not change the state it reads', () => {
    const state = fixtureForScreen('lost');
    const before = structuredClone(state);

    buildFeedbackReport(state, meta);

    expect(state).toEqual(before);
  });

  it('adds the role, the team, the round trip and, after a divergence, the tick', () => {
    const state = fixtureForScreen('lost');

    const report = buildFeedbackReport(state, {
      ...meta,
      online: { role: 'guest', players: 3, roundTripMs: 41.6, desyncTick: 4776 },
    }).split('\n');

    expect(report.slice(-3)).toEqual([
      'fps: 59',
      'online: guest, 3 players, rtt 42 ms',
      `desync: tick 4776, version ${meta.version}`,
    ]);
  });

  it('says so when the browser measured no round trip', () => {
    const report = buildFeedbackReport(null, {
      ...meta,
      online: { role: 'host', players: 2, roundTripMs: null },
    });

    expect(report.split('\n').at(-1)).toBe('online: host, 2 players, rtt unknown');
  });
});
