import { describe, expect, it } from 'vitest';
import type { GameContent, SetDefinition } from '../data/types';
import { TICKS_PER_BAR } from '../shared/tempo';
import { setFraction } from '../sim/lineup';
import type { SimState } from '../sim/state';
import {
  UI_FIXTURE_CONTENT,
  fixtureForScreen,
  fixturePlayer,
  fixtureState,
  fixtureTrap,
  idleSnapshot,
} from './fixtures';
import {
  classToken,
  dropReading,
  enteredSpeaker,
  gearSlots,
  handTiles,
  isNight,
  playerLabel,
  plugHelp,
  rosterOf,
  sunPosition,
  trapToTake,
  volumeCrans,
} from './hud-model';

const [first] = UI_FIXTURE_CONTENT.sets;
if (first === undefined) {
  throw new Error('expected a fixture set');
}
const SET: SetDefinition = first;

function withSpeakers(plugged: boolean[], plugTicks: number[] = []): SimState {
  const speakers = (SET.speakers ?? []).map((definition, index) => ({
    id: definition.id,
    x: definition.x,
    y: definition.y,
    radius: definition.radius,
    plugTicks: plugTicks[index] ?? 0,
    plugged: plugged[index] ?? false,
  }));
  return fixtureState({ speakers, volume: plugged.filter(Boolean).length });
}

const lineup = Array.from({ length: 10 }, (_, index) => ({ left: index / 10, width: 0.05 }));

describe('sunPosition', () => {
  it('sits at the left of the first slot at the start of the set', () => {
    expect(sunPosition(0, lineup)).toBe(0);
  });

  it('crosses a slot as the set fraction crosses it', () => {
    const early = sunPosition(0.31, lineup);
    const late = sunPosition(0.39, lineup);

    expect(early).toBeCloseTo(0.3 + 0.1 * 0.05, 12);
    expect(late).toBeCloseTo(0.3 + 0.9 * 0.05, 12);
  });

  it('ends at the right edge of the sunrise', () => {
    expect(sunPosition(1, lineup)).toBeCloseTo(0.95, 12);
  });

  it('follows the set fraction of a real state through the line-up slots', () => {
    const slots = Array.from({ length: 14 }, (_, index) => ({ left: index / 14, width: 1 / 14 }));
    const early = fixtureState({ tick: 100 });
    const late = fixtureState({ tick: 100 + 4 * TICKS_PER_BAR });

    const positions = [early, late].map((state) => sunPosition(setFraction(SET, state), slots));

    expect(positions[1]).toBeGreaterThan(positions[0] ?? 1);
  });
});

describe('isNight', () => {
  it('is night between the dusk and the dawn of the palette only', () => {
    expect([0.1, 0.3, 0.59, 0.6, 0.9].map(isNight)).toEqual([false, true, true, false, false]);
  });
});

describe('volumeCrans', () => {
  it('has one cran per speaker of the set, all off at Volume 0', () => {
    const crans = volumeCrans(SET, withSpeakers([false, false, false, false]));

    expect(crans.map((cran) => cran.state)).toEqual(['off', 'off', 'off', 'off']);
  });

  it('lights the crans of the plugged speakers in their own colour', () => {
    const crans = volumeCrans(SET, withSpeakers([true, false, true, false]));

    expect(crans.map((cran) => cran.state)).toEqual(['on', 'off', 'on', 'off']);
    expect(crans.map((cran) => cran.token)).toEqual(['healer', 'turquoise', 'or', 'mage']);
  });

  it('fills the cran of a speaker being plugged with its progress', () => {
    const needed = 2 * TICKS_PER_BAR;

    const crans = volumeCrans(SET, withSpeakers([true, false, false, false], [0, needed / 4]));

    expect(crans[1]).toMatchObject({ state: 'plugging', fill: 0.25 });
  });

  it('has no cran when the set has no speaker', () => {
    const bare = { ...SET, speakers: [] };

    expect(volumeCrans(bare, fixtureState())).toEqual([]);
  });
});

describe('handTiles', () => {
  const definitions = new Map(UI_FIXTURE_CONTENT.traps.map((trap) => [trap.id, trap]));
  const player = fixturePlayer({ x: 760, y: 500, hand: [{ trapId: 'laser' }] });

  function field(count: number, underfoot = false): SimState {
    const far = Array.from({ length: count }, (_, index) => ({
      ...fixtureTrap(1 + index, 'laser'),
      x: 100 + index * 200,
      y: 100,
    }));
    const under = underfoot ? [{ ...fixtureTrap(9, 'caisson-de-basse'), x: 760, y: 500 }] : [];
    return fixtureState({ traps: [...far, ...under] });
  }

  it('shows each held trap, then the free slots', () => {
    const tiles = handTiles(definitions, field(0), player, 2, 6);

    expect(tiles).toEqual([
      { trapId: 'laser', available: true },
      { trapId: null, available: false },
    ]);
  });

  it('greys a held trap out when all slots are taken', () => {
    const tiles = handTiles(definitions, field(6), player, 2, 6);

    expect(tiles[0]).toEqual({ trapId: 'laser', available: false });
  });

  it('greys a held trap out over a placed trap', () => {
    const tiles = handTiles(definitions, field(0, true), player, 2, 6);

    expect(tiles[0]).toEqual({ trapId: 'laser', available: false });
  });
});

describe('trapToTake', () => {
  const definitions = new Map(UI_FIXTURE_CONTENT.traps.map((trap) => [trap.id, trap]));
  const under = fixtureState({ traps: [{ ...fixtureTrap(9, 'laser'), x: 760, y: 500 }] });

  it('names the trap under the player when a hand is free', () => {
    const player = fixturePlayer({ x: 760, y: 500, hand: [{ trapId: 'caisson-de-basse' }] });

    expect(trapToTake(definitions, under, player, 2)).toBe('laser');
  });

  it('names nothing with full hands or on free ground', () => {
    const full = fixturePlayer({
      x: 760,
      y: 500,
      hand: [{ trapId: 'caisson-de-basse' }, { trapId: 'laser' }],
    });
    const away = fixturePlayer({ x: 100, y: 800, hand: [] });

    expect([
      trapToTake(definitions, under, full, 2),
      trapToTake(definitions, under, away, 2),
    ]).toEqual([null, null]);
  });
});

describe('gearSlots', () => {
  it('has three slots, hollow until a weapon is held', () => {
    const empty = gearSlots({}, UI_FIXTURE_CONTENT);
    const held = gearSlots(
      {
        weapons: [
          { id: 'diabolo', level: 2, phase: 0 },
          { id: 'baton-de-feu', level: 1, phase: 0 },
        ],
      },
      UI_FIXTURE_CONTENT,
    );

    expect(empty.map((slot) => slot.weapon)).toEqual([null, null, null]);
    expect(held.map((slot) => slot.weapon?.id ?? null)).toEqual(['diabolo', 'baton-de-feu', null]);
    expect(held.map((slot) => slot.level)).toEqual([2, 1, 0]);
  });

  it('leaves a slot hollow when its weapon is unknown', () => {
    const content: GameContent = { ...UI_FIXTURE_CONTENT, weapons: [] };

    const slots = gearSlots({ weapons: [{ id: 'diabolo', level: 1, phase: 0 }] }, content);

    expect(slots[0]?.weapon).toBeNull();
  });
});

describe('enteredSpeaker', () => {
  it('finds the unplugged speaker a player stands in', () => {
    const state = withSpeakers([false, false, false, false]);
    const speaker = state.speakers?.[0];
    const player = state.players[0];
    if (speaker === undefined || player === undefined) {
      throw new Error('expected a speaker and a player');
    }
    player.x = speaker.x;
    player.y = speaker.y;

    expect(enteredSpeaker(SET, state)).toEqual({ plugBars: 2 });
  });

  it('ignores a plugged speaker and a player outside', () => {
    const plugged = withSpeakers([true, true, true, true]);
    const speaker = plugged.speakers?.[0];
    const player = plugged.players[0];
    if (speaker === undefined || player === undefined) {
      throw new Error('expected a speaker and a player');
    }
    player.x = speaker.x;
    player.y = speaker.y;

    expect(enteredSpeaker(SET, plugged)).toBeNull();
    expect(enteredSpeaker(SET, withSpeakers([false, false, false, false]))).toBeNull();
  });
});

describe('plugHelp', () => {
  it('tells how many bars to stay', () => {
    expect(plugHelp(2)).toBe('Reste deux mesures pour brancher');
    expect(plugHelp(1)).toBe('Reste une mesure pour brancher');
  });
});

describe('rosterOf', () => {
  const snapshot = idleSnapshot();

  it('is the solo HUD when the sim holds one player', () => {
    const state = fixtureState();

    const roster = rosterOf(state, { players: [{ playerId: 0, snapshot }] });

    expect(roster.team).toBe(false);
    expect(roster.locals.map((player) => player.id)).toEqual([0]);
    expect(roster.others).toEqual([]);
  });

  it('splits the players of this screen from the others of the sim', () => {
    const state = fixtureForScreen('team');

    const roster = rosterOf(state, {
      players: [
        { playerId: 0, snapshot },
        { playerId: 1, snapshot },
      ],
    });

    expect(roster.team).toBe(true);
    expect(roster.locals.map((player) => player.name)).toEqual(['Léa', 'Tom']);
    expect(roster.others.map((player) => player.name)).toEqual(['Inès', 'Sam']);
  });

  it('keeps the order of the frame for the players of this screen', () => {
    const state = fixtureForScreen('team');

    const roster = rosterOf(state, {
      players: [
        { playerId: 2, snapshot },
        { playerId: 0, snapshot },
      ],
    });

    expect(roster.locals.map((player) => player.name)).toEqual(['Inès', 'Léa']);
    expect(roster.others.map((player) => player.name)).toEqual(['Tom', 'Sam']);
  });

  it('ignores a local player the sim does not hold', () => {
    const state = fixtureState();

    const roster = rosterOf(state, { players: [{ playerId: 3, snapshot }] });

    expect(roster.locals).toEqual([]);
  });
});

describe('who a player is', () => {
  it('colours the three classes and falls back to gold', () => {
    expect(['mage', 'tank', 'healer', 'inconnue'].map(classToken)).toEqual([
      'mage',
      'tank',
      'healer',
      'or',
    ]);
  });

  it('names a player by name, or by place when the name is absent', () => {
    expect(playerLabel({ id: 1, name: 'Tom' })).toBe('Tom');
    expect(playerLabel({ id: 2 })).toBe('Joueur 3');
  });
});

describe('dropReading', () => {
  it('counts down to the drop during the build-up', () => {
    const state = fixtureForScreen('game');

    const reading = dropReading(SET, state, UI_FIXTURE_CONTENT);

    expect(reading.label).toBe('Drop');
    expect(reading.value).toMatch(/^\d+:\d{2}$/);
    expect(reading.dropping).toBe(false);
  });

  it('names the boss the drop brought', () => {
    const state = fixtureForScreen('team', true);
    const bossId = SET.tiers[state.set.tier]?.bossId;
    const boss = UI_FIXTURE_CONTENT.enemies.find((enemy) => enemy.id === bossId);

    const reading = dropReading(SET, state, UI_FIXTURE_CONTENT);

    expect(boss).toBeDefined();
    expect(reading).toEqual({ label: 'Drop', value: boss?.name, dropping: true });
  });

  it('greets the sunrise once the set is won', () => {
    const reading = dropReading(SET, fixtureForScreen('won'), UI_FIXTURE_CONTENT);

    expect(reading).toEqual({ label: 'Sunrise', value: '', dropping: false });
  });
});
