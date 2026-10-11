import { describe, expect, it } from 'vitest';
import { type GameEnd, type GameStart, parseGameEvent } from './stats';

const START: GameStart = {
  event: 'start',
  stage: 'soiree-v0',
  mode: 'local',
  players: 2,
  classes: 'healer+mage',
  device: 'gamepad',
  version: 'dev',
};

const END: GameEnd = {
  ...START,
  event: 'end',
  stage: 'dome',
  outcome: 'core',
  tier: 3,
  seconds: 412,
};

function parse(event: object): ReturnType<typeof parseGameEvent> {
  return parseGameEvent(JSON.stringify(event));
}

describe('parseGameEvent', () => {
  it('reads a start', () => {
    const json = JSON.stringify(START);

    const event = parseGameEvent(json);

    expect(event).toEqual(START);
  });

  it('reads an end', () => {
    const json = JSON.stringify(END);

    const event = parseGameEvent(json);

    expect(event).toEqual(END);
  });

  it('reads a commit sha as the version', () => {
    const start = { ...START, version: '007c3d2a6f1e9b8c4d5e6f708192a3b4c5d6e7f8' };

    const event = parse(start);

    expect(event).toEqual(start);
  });

  it('refuses text that is not a json object', () => {
    const bodies = ['', 'start', '[]', 'null', '42', '{"event":'];

    const events = bodies.map(parseGameEvent);

    expect(events).toEqual(bodies.map(() => null));
  });

  it('refuses an event with a missing field', () => {
    const start: Partial<GameStart> = { ...START };
    const end: Partial<GameEnd> = { ...END };
    delete start.device;
    delete end.seconds;

    const events = [parse(start), parse(end)];

    expect(events).toEqual([null, null]);
  });

  it('refuses an event with an extra field', () => {
    const start = { ...START, name: 'Ana' };
    const endFieldsOnStart = { ...START, outcome: 'won' };

    const events = [parse(start), parse(endFieldsOnStart)];

    expect(events).toEqual([null, null]);
  });

  it('refuses an event whose field is out of its values', () => {
    const invalid: object[] = [
      { ...START, event: 'visit' },
      { ...START, mode: 'versus' },
      { ...START, device: 'none' },
      { ...START, players: 0, classes: '' },
      { ...START, players: 5, classes: 'mage+mage+mage+mage+mage' },
      { ...START, players: 1.5 },
      { ...START, players: '2' },
      { ...START, players: 3 },
      { ...START, version: '' },
      { ...START, version: 'Dev build' },
      { ...END, outcome: 'lost' },
      { ...END, tier: -1 },
      { ...END, tier: 2.5 },
      { ...END, seconds: -3 },
      { ...END, seconds: '412' },
    ];

    const events = invalid.map(parse);

    expect(events).toEqual(invalid.map(() => null));
  });

  it('checks stage and classes by their shape, so a new stage or class passes', () => {
    const fresh = { ...START, stage: 'plage-2', classes: 'bard+mage' };
    const badShapes: object[] = [
      { ...START, stage: 'Dome' },
      { ...START, stage: 'x'.repeat(25) },
      { ...START, stage: '' },
      { ...START, classes: 'mage+Tank' },
      { ...START, classes: `mage+${'x'.repeat(25)}` },
      { ...START, classes: 'mage+' },
      { ...START, classes: 'mage tank' },
    ];

    const accepted = parse(fresh);
    const refused = badShapes.map(parse);

    expect(accepted).toEqual(fresh);
    expect(refused).toEqual(badShapes.map(() => null));
  });
});
