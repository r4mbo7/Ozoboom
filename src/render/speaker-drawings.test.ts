import { describe, expect, it } from 'vitest';
import { createSpeakers } from './speakers';
import {
  FIXTURE_SPEAKERS,
  SPEAKER_SHAPES,
  bodyOf,
  context,
  frameAt,
  stateWith,
  wavesOf,
} from './speakers.test-support';

describe('speakers seen from above', () => {
  it('draws each speaker with its own drawing, chosen by its identifier', () => {
    const ctx = context();

    createSpeakers(ctx).update(stateWith(['off', 'plugging', 'plugged', 'off']), 0, frameAt(0.4));

    expect(FIXTURE_SPEAKERS.map((_, index) => bodyOf(ctx, index).texture)).toEqual(
      FIXTURE_SPEAKERS.map((def) => SPEAKER_SHAPES[def.id]?.texture),
    );
  });

  it('turns the front of the tarp and the wall toward the scène, not the tower nor the pylon', () => {
    const ctx = context();
    const state = stateWith(['off', 'off', 'off', 'off']);

    createSpeakers(ctx).update(state, 0, frameAt(0.4));

    const fronts = FIXTURE_SPEAKERS.map((def, index) => {
      const { rotation } = bodyOf(ctx, index);
      const toCore = Math.atan2(state.core.y - def.y, state.core.x - def.x);
      return [def.id, Math.round(Math.cos(rotation + Math.PI / 2 - toCore) * 100) / 100 + 0];
    });
    expect(fronts).toEqual([
      ['dome-chill', 1],
      ['foret', 0],
      ['sub', 1],
      ['cercle-acid', -1],
    ]);
  });

  it('sends sound waves only once plugged, moving on the beat, held still in calm mode', () => {
    const state = stateWith(['plugged', 'off', 'plugged', 'plugged']);
    const boundsAt = (now: number, calm: boolean) => {
      const ctx = context();
      const frame = frameAt(0.4, calm);
      frame.now = now;
      createSpeakers(ctx).update(state, 0, frame);
      return [0, 1, 2, 3].map((index) => {
        const waves = wavesOf(ctx, index);
        return waves.visible ? waves.getLocalBounds().width : 0;
      });
    };

    const early = boundsAt(1, false);
    const later = boundsAt(7, false);

    expect(early[1]).toBe(0);
    expect(early.filter((width) => width > 0)).toHaveLength(3);
    expect(later).not.toEqual(early);
    expect(boundsAt(1, true)).toEqual(boundsAt(7, true));
  });
});
