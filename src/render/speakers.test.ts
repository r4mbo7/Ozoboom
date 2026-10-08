import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import { SPEAKER_TOKENS, mixColor, plugShare, speakerToken } from './speaker-kit';
import { SPEAKER_EXTENTS } from './speaker-leds';
import { createSpeakers } from './speakers';
import {
  BEAMS,
  FIXTURE_SPEAKERS,
  bodyOf,
  context,
  frameAt,
  glowOf,
  ledsOf,
  standbyOf,
  stateWith,
  zoneOf,
} from './speakers.test-support';

describe('plug share', () => {
  it.each([
    [0, 2, 0],
    [12, 2, 0.125],
    [TICKS_PER_BAR, 2, 0.5],
    [TICKS_PER_BAR * 2, 2, 1],
    [TICKS_PER_BAR * 3, 2, 1],
    [30, 3, 30 / (3 * TICKS_PER_BAR)],
  ])('reads %i ticks of %i bars as %f', (plugTicks, plugBars, share) => {
    expect(plugShare(plugTicks, plugBars)).toBeCloseTo(share);
  });
});

describe('LED column and standby', () => {
  it('stands the LED column right of every drawing, plugged or not', () => {
    const ctx = context();

    createSpeakers(ctx).update(stateWith(['off', 'plugging', 'plugged', 'off']), 0, frameAt(0.4));

    for (const [index, def] of FIXTURE_SPEAKERS.entries()) {
      const leds = ledsOf(ctx, index);
      expect(leds.visible).toBe(true);
      expect(leds.position).toMatchObject({ x: def.x, y: def.y });
      expect(leds.getLocalBounds().minX).toBeGreaterThan(SPEAKER_EXTENTS[def.id] ?? Infinity);
    }
  });

  it('blinks a standby LED in its color on each unplugged speaker, steady in calm mode', () => {
    const state = stateWith(['off', 'plugging', 'plugged', 'off']);
    const standbyAt = (now: number, calm = false) => {
      const ctx = context();
      const frame = frameAt(0.4, calm);
      frame.now = now;
      createSpeakers(ctx).update(state, 0, frame);
      return [0, 1, 2].map((index) => {
        const standby = standbyOf(ctx, index);
        if (!standby.visible) {
          return 0;
        }
        expect(standby.tint).toBe(frame.palette[speakerToken(FIXTURE_SPEAKERS[index]?.id ?? '')]);
        return standby.alpha;
      });
    };

    expect(standbyAt(TICKS_PER_BAR)).toEqual([1, 1, 0]);
    expect(standbyAt(TICKS_PER_BAR + TICKS_PER_BEAT)).toEqual([0.25, 0.25, 0]);
    expect(standbyAt(TICKS_PER_BAR + TICKS_PER_BEAT, true)).toEqual([1, 1, 0]);
  });
});

describe('speaker colors', () => {
  it.each([
    ['dome-chill', 'healer'],
    ['foret', 'turquoise'],
    ['sub', 'or'],
    ['cercle-acid', 'mage'],
  ] as const)('takes the color of %s from its identifier: %s', (id, token) => {
    expect(speakerToken(id)).toBe(token);
  });

  it('refuses a speaker it has no color for', () => {
    expect(() => speakerToken('inconnue')).toThrow('inconnue');
    expect(Object.keys(SPEAKER_TOKENS)).toHaveLength(4);
  });

  it.each([0.4, 1])('tints each plugged stack in its own color at %f', (fraction) => {
    const ctx = context();
    const frame = frameAt(fraction);

    createSpeakers(ctx).update(stateWith(['plugged', 'plugged', 'plugged', 'plugged']), 0, frame);

    expect(
      FIXTURE_SPEAKERS.map((def, index) => [def.id, bodyOf(ctx, index).tint] as const),
    ).toEqual(FIXTURE_SPEAKERS.map((def) => [def.id, frame.palette[speakerToken(def.id)]]));
  });

  it('tints an unplugged stack gray with a touch of its color, its zone a little more', () => {
    const ctx = context();
    const frame = frameAt(0.4);
    const gray = mixColor(frame.palette.badVibe, frame.palette.texte, 0.35);

    createSpeakers(ctx).update(stateWith(['off', 'off', 'off', 'off']), 0, frame);

    for (const [index, def] of FIXTURE_SPEAKERS.entries()) {
      const color = frame.palette[speakerToken(def.id)];
      expect(bodyOf(ctx, index).tint).toBe(mixColor(gray, color, 0.28));
      expect(zoneOf(ctx, index).tint).toBe(mixColor(gray, color, 0.3));
    }
  });
});

describe('light rule and calm mode', () => {
  it.each([
    [0.4, false],
    [1, true],
  ])('outlines the stacks only by day at %f', (fraction, outlined) => {
    const ctx = context();

    createSpeakers(ctx).update(stateWith(['off', 'off', 'off', 'off']), 0, frameAt(fraction));

    expect(ctx.layers.speakers.children[BEAMS + 2]?.visible).toBe(outlined);
  });

  it('shivers while plugging, and holds still in calm mode', () => {
    const state = stateWith(['plugging', 'off', 'off', 'off']);
    const still = FIXTURE_SPEAKERS[0];
    const positions = (calm: boolean) => {
      const ctx = context();
      const frame = frameAt(0.4, calm);
      frame.now = 7.3;
      createSpeakers(ctx).update(state, 0, frame);
      return bodyOf(ctx, 0).position;
    };

    expect(positions(false).x).not.toBe(still?.x);
    expect(positions(true).x).toBe(still?.x);
    expect(positions(true).y).toBe(still?.y);
  });

  it('lights the cable only once the speaker is plugged', () => {
    const ctx = context();
    createSpeakers(ctx).update(stateWith(['plugged', 'off', 'off', 'off']), 0, frameAt(0.4));

    expect(ctx.layers.glow.children[0]?.visible).toBe(true);
    expect(ctx.layers.glow.children[2]?.visible).toBe(false);
  });

  it('throws on a speaker the set does not define', () => {
    const ctx = context();
    const state = stateWith(['off', 'off', 'off', 'off']);
    state.setId = 'unknown-set';

    expect(() => {
      createSpeakers(ctx).update(state, 0, frameAt(0.4));
    }).toThrow('unknown-set');
  });
});

describe('speakerPlugged flash', () => {
  it('bursts from the speaker for a beat, and never past three times its radius', () => {
    const ctx = context();
    const family = createSpeakers(ctx);
    const state = stateWith(['plugged', 'off', 'off', 'off']);
    state.tick = 100;
    state.events = [{ type: 'speakerPlugged', speakerId: 'dome-chill' }];
    family.onEvent?.(state.events[0] ?? { type: 'gameWon' }, state, frameAt(0.4));
    const frame = frameAt(0.4);

    frame.now = 100.5;
    family.update(state, 0, frame);
    const flash = ctx.layers.fx.children[1];
    expect(flash?.visible).toBe(true);
    expect((flash?.scale.x ?? 0) * 32).toBeLessThanOrEqual((FIXTURE_SPEAKERS[0]?.radius ?? 0) * 3);

    frame.now = 130;
    family.update(state, 0, frame);
    expect(flash?.visible).toBe(false);
  });
});

describe('plugged speaker beams', () => {
  const radius = 160;
  const plugged = () => stateWith(['plugged', 'off', 'off', 'off']);

  function beamsAt(now: number, fraction = 0.4, calm = false) {
    const ctx = context();
    const frame = frameAt(fraction, calm);
    frame.now = now;
    createSpeakers(ctx).update(plugged(), 0, frame);
    return glowOf(ctx, 0);
  }

  it('sweeps the aura with three beams a third of a turn apart, longer than the aura', () => {
    const { beams } = beamsAt(0);

    expect(beams).toHaveLength(3);
    expect(beams.every((beam) => beam.visible)).toBe(true);
    expect(beams.map((beam) => beam.scale.x * 32)).toEqual([
      radius * 1.15,
      radius * 1.15,
      radius * 1.15,
    ]);
    expect((beams[1]?.rotation ?? 0) - (beams[0]?.rotation ?? 0)).toBeCloseTo(Math.PI * (2 / 3));
    expect((beams[2]?.rotation ?? 0) - (beams[1]?.rotation ?? 0)).toBeCloseTo(Math.PI * (2 / 3));
  });

  it('turns the beams once in eight bars', () => {
    const start = beamsAt(0).beams[0]?.rotation ?? 0;

    expect((beamsAt(TICKS_PER_BAR).beams[0]?.rotation ?? 0) - start).toBeCloseTo(Math.PI / 4);
    expect((beamsAt(TICKS_PER_BAR * 8).beams[0]?.rotation ?? 0) - start).toBeCloseTo(Math.PI * 2);
  });

  it('shrinks the full halo to 62 % of the aura', () => {
    expect(beamsAt(0).halo.scale.x * 32).toBeCloseTo(radius * 0.62);
  });

  it('halves the beams by day', () => {
    const night = beamsAt(0, 0.4).beams[0]?.alpha ?? 0;

    expect(beamsAt(0, 1).beams[0]?.alpha).toBeCloseTo(night / 2);
  });

  it('holds the beams still at half intensity in calm mode', () => {
    const moving = beamsAt(0).beams[0]?.alpha ?? 0;
    const calm = beamsAt(TICKS_PER_BAR * 3, 0.4, true).beams[0];

    expect(calm?.rotation).toBe(beamsAt(0, 0.4, true).beams[0]?.rotation);
    expect(calm?.alpha).toBeCloseTo(moving / 2);
  });

  it('shows no beam on an unplugged speaker', () => {
    const ctx = context();
    createSpeakers(ctx).update(plugged(), 0, frameAt(0.4));

    expect(glowOf(ctx, 1).beams.some((beam) => beam.visible)).toBe(false);
  });
});
