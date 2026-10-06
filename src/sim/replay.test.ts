import { describe, expect, it } from 'vitest';
import { hashState, runScript } from './replay';
import { DUO, playTeam, referenceCommands, replayScript, RELIC_IDS } from './replay-scripts';

describe('replay', () => {
  it('reaches the same state twice from the same seed and script', () => {
    const script = referenceCommands(1000);

    const first = hashState(runScript(DUO, script));
    const second = hashState(runScript(DUO, script));

    expect(first).toBe(second);
  });

  it('reaches another state from another seed', () => {
    const script = referenceCommands(1000);

    const original = hashState(runScript(DUO, script));
    const reseeded = hashState(runScript({ ...DUO, seed: 1235 }, script));

    expect(reseeded).not.toBe(original);
  });

  it('keeps the fingerprint of the reference script', () => {
    const state = replayScript('reference').run();

    expect(state.status).toBe('running');
    expect(state.set.segment).toBe('drop');
    expect(state.stats.kills).toBe(30);
    expect(state.stats.phrasesHeld).toBe(2);
    expect(state.players.map((player) => player.upgrades)).toEqual([
      ['big-bass', 'quick-feet'],
      ['big-bass'],
    ]);
    expect(hashState(state)).toBe(replayScript('reference').hash);
  });
});

describe('replay of a game that plugs a speaker', () => {
  it('keeps the fingerprint of the speaker script', () => {
    const state = replayScript('speaker').run();

    expect(state.speakers?.map((speaker) => speaker.plugged)).toEqual([true]);
    expect(state.volume).toBe(1);
    expect(hashState(state)).toBe(replayScript('speaker').hash);
  });
});

describe('replay of a game that kills its first boss and picks a relic', () => {
  it('keeps the fingerprint of the relic script', () => {
    const state = replayScript('relic').run();

    expect(state.players[0]?.upgrades.filter((id) => RELIC_IDS.includes(id))).toHaveLength(1);
    expect(state.pendingUpgrades.some((offer) => offer.kind === 'relic')).toBe(false);
    expect(hashState(state)).toBe(replayScript('relic').hash);
  });
});

describe('replay of a team of three', () => {
  it('keeps the fingerprint of the team script', () => {
    const { state, downs, revives } = playTeam();

    expect(downs).toBe(4);
    expect(revives).toBe(2);
    expect(hashState(state)).toBe(replayScript('team').hash);
  });
});

describe('hashState', () => {
  it('is an 8-digit hexadecimal fingerprint', () => {
    const state = runScript(DUO, []);

    expect(hashState(state)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('does not depend on the order in which keys were written', () => {
    const state = runScript(DUO, []);
    const reordered = Object.fromEntries(Object.entries(state).reverse()) as typeof state;

    expect(hashState(reordered)).toBe(hashState(state));
  });

  it('changes when any value of the state changes', () => {
    const state = runScript(DUO, []);
    const before = hashState(state);
    const player = state.players[1];
    if (player === undefined) {
      throw new Error('expected two players');
    }

    player.x += 0.5;

    expect(hashState(state)).not.toBe(before);
  });
});
