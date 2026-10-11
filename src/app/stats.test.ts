import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { type GameEvent, parseGameEvent } from '../shared/stats';
import { TICK_RATE_HZ } from '../shared/tempo';
import { createSimulation } from '../sim/index';
import type { SimState } from '../sim/state';
import { type GameContext, createGameStats, gameEvent, outcomeOf, sendGameEvent } from './stats';

const CONTEXT: GameContext = { mode: 'local', device: 'gamepad', version: __APP_RELEASE__ };

function trio(): SimState {
  return createSimulation({
    seed: 1,
    setId: 'dome',
    content: CONTENT,
    players: [
      { id: 0, classId: 'tank' },
      { id: 1, classId: 'mage' },
      { id: 2, classId: 'healer' },
    ],
  }).state;
}

function lost(core: number, downed: boolean): SimState {
  const state = trio();
  state.status = 'lost';
  state.core.hp = core;
  for (const player of state.players) {
    player.downed = downed;
  }
  return state;
}

describe('gameEvent', () => {
  it('describes a started game by its stage, players and sorted classes', () => {
    const state = trio();

    const event = gameEvent(state, CONTEXT);

    expect(event).toEqual({
      event: 'start',
      stage: 'dome',
      mode: 'local',
      players: 3,
      classes: 'healer+mage+tank',
      device: 'gamepad',
      version: __APP_RELEASE__,
    });
    expect(parseGameEvent(JSON.stringify(event))).toEqual(event);
  });

  it('describes an ended game by its outcome, tier and whole seconds of sim', () => {
    const state = trio();
    state.status = 'won';
    state.set.tier = 4;
    state.tick = 61 * TICK_RATE_HZ + 5;

    const event = gameEvent(state, CONTEXT, outcomeOf(state));

    expect(event).toEqual({
      event: 'end',
      stage: 'dome',
      mode: 'local',
      players: 3,
      classes: 'healer+mage+tank',
      device: 'gamepad',
      version: __APP_RELEASE__,
      outcome: 'won',
      tier: 4,
      seconds: 61,
    });
    expect(parseGameEvent(JSON.stringify(event))).toEqual(event);
  });

  it('counts a machine without input yet as keyboard and mouse', () => {
    const event = gameEvent(trio(), { ...CONTEXT, device: 'none' });

    expect(event.device).toBe('keyboardMouse');
  });

  it('keeps a quit or an interrupted game as such', () => {
    expect(gameEvent(trio(), CONTEXT, 'quit')).toMatchObject({ event: 'end', outcome: 'quit' });
    expect(gameEvent(trio(), CONTEXT, 'interrupted')).toMatchObject({
      event: 'end',
      outcome: 'interrupted',
    });
  });
});

describe('outcomeOf', () => {
  it('tells a won game', () => {
    const state = trio();
    state.status = 'won';

    expect(outcomeOf(state)).toBe('won');
  });

  it('tells a silent scene before the players, as the sim does', () => {
    expect(outcomeOf(lost(0, true))).toBe('core');
  });

  it('tells a game lost with every player down', () => {
    expect(outcomeOf(lost(10, true))).toBe('downed');
  });
});

describe('createGameStats', () => {
  it('sends one start, then one end however many ways the game ends', () => {
    const sent: GameEvent[] = [];
    const stats = createGameStats((event) => sent.push(event));
    const state = lost(0, false);

    stats.start(state, CONTEXT);
    stats.end(state, outcomeOf(state));
    stats.end(state, 'quit');

    expect(sent.map((event) => (event.event === 'end' ? event.outcome : event.event))).toEqual([
      'start',
      'core',
    ]);
  });

  it('sends no end for a game it never started, as on an online guest', () => {
    const sent: GameEvent[] = [];
    const stats = createGameStats((event) => sent.push(event));

    stats.end(trio(), 'interrupted');

    expect(sent).toEqual([]);
  });

  it('ends each game once when the players play again', () => {
    const sent: GameEvent[] = [];
    const stats = createGameStats((event) => sent.push(event));

    stats.start(trio(), CONTEXT);
    stats.end(trio(), 'quit');
    stats.start(trio(), CONTEXT);
    stats.end(trio(), 'quit');

    expect(sent.map((event) => event.event)).toEqual(['start', 'end', 'start', 'end']);
  });
});

describe('sendGameEvent', () => {
  const EVENT = gameEvent(trio(), CONTEXT);

  function recording(answer: () => boolean) {
    const beacons: { url: string; data: string }[] = [];
    return {
      beacons,
      beacon: (url: string, data: string) => {
        beacons.push({ url, data });
        return answer();
      },
    };
  }

  it('beacons the event as text to the stats Worker', () => {
    const recorder = recording(() => true);

    const sent = sendGameEvent(EVENT, 'https://stats.example', '', recorder.beacon);

    expect(sent).toBe(true);
    expect(recorder.beacons).toEqual([
      { url: 'https://stats.example/event', data: JSON.stringify(EVENT) },
    ]);
  });

  it('sends nothing without a stats Worker, as in development and tests', () => {
    const recorder = recording(() => true);

    expect(sendGameEvent(EVENT, undefined, '', recorder.beacon)).toBe(false);
    expect(sendGameEvent(EVENT, '', '', recorder.beacon)).toBe(false);
    expect(recorder.beacons).toEqual([]);
  });

  it('sends nothing in a development mode', () => {
    const recorder = recording(() => true);

    const sent = sendGameEvent(EVENT, 'https://stats.example', '?dev=fast', recorder.beacon);

    expect(sent).toBe(false);
    expect(recorder.beacons).toEqual([]);
  });

  it('lets the game go on when the beacon fails', () => {
    const throwing = recording(() => {
      throw new TypeError('blocked');
    });

    expect(sendGameEvent(EVENT, 'https://stats.example', '', throwing.beacon)).toBe(false);
  });
});
