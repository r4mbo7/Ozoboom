import { describe, expect, it } from 'vitest';
import type { GameContent, SetDefinition } from '../data/types';
import { TICKS_PER_BAR } from '../shared/tempo';
import { setFraction } from '../sim/lineup';
import type { SimState } from '../sim/state';
import { UI_FIXTURE_CONTENT, fixtureState } from './fixtures';
import {
  enteredSpeaker,
  gearSlots,
  isNight,
  plugHelp,
  sunPosition,
  trapCapacity,
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

describe('trapCapacity', () => {
  it('adds one slot per Volume level to the set maximum', () => {
    expect([0, 1, 2, 4].map((volume) => trapCapacity(SET, { volume }))).toEqual([6, 7, 8, 10]);
    expect(trapCapacity(SET, {})).toBe(6);
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
