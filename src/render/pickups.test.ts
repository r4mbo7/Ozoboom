import { Container, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { PickupState } from '../sim/state';
import type { RenderContext } from './context';
import { createFixtureState } from './fixture';
import { createFrame } from './frame';
import { createLayers } from './layers';
import { CALM_TRAIL_STEPS, TRAIL_STEPS } from './pickup-comet';
import { createPickups } from './pickups';
import type { Shape } from './textures';
import { COMET_LENGTH } from './textures-pickups';

const SPEED = 12;

function context(): RenderContext {
  const shape: Shape = { texture: Texture.EMPTY, radius: 12 };
  return {
    textures: { vibes: shape, ring: shape, cometHead: shape, cometTail: shape },
    layers: createLayers(new Container()),
  } as unknown as RenderContext;
}

function vibe(id: number, x: number, flown: number): PickupState {
  return { id, kind: 'vibes', amount: 1, ticksLeft: 100, x, y: 50, prevX: x - flown, prevY: 50 };
}

function stateWith(tick: number, ...pickups: PickupState[]) {
  const state = createFixtureState({ enemies: 0, projectiles: 0 });
  state.tick = tick;
  state.pickups = pickups;
  return state;
}

const shown = (layer: Container) => layer.children.filter((child) => child.visible);

describe('pickups', () => {
  it('tighten a gold circle on the landing spot of a lobbed vibe, not in calm mode', () => {
    const ctx = context();
    const frame = createFrame();
    const family = createPickups(ctx);
    const flight = { ticksLeft: 12, ticks: 24, fromX: 0, fromY: 50 };
    const state = stateWith(10, { ...vibe(1, 300, 0), flight });

    family.update(state, 0, frame);

    const [, body, mark] = ctx.layers.pickups.children;
    expect(mark).toMatchObject({ visible: true, x: 300, y: 50, tint: frame.palette.or });
    expect(body?.x).toBe(150);
    expect(shown(ctx.layers.fx)).toHaveLength(0);

    frame.calm = true;
    family.update(state, 0, frame);

    expect(mark?.visible).toBe(false);
    expect(body?.x).toBe(300);
  });

  it('trail gold then turquoise behind the vibes in flight only', () => {
    const ctx = context();
    const frame = createFrame();
    const family = createPickups(ctx);

    family.update(stateWith(10, vibe(1, 100, 0), vibe(2, 300, SPEED)), 0.5, frame);

    const trail = shown(ctx.layers.fx) as unknown as { tint: number; x: number }[];
    expect(trail.map((part) => part.tint)).toEqual([frame.palette.or, frame.palette.turquoise]);
    expect(trail.map((part) => part.x)).toEqual([294, 294]);
  });

  it('grow their trail with the flight, up to its full length', () => {
    const ctx = context();
    const frame = createFrame();
    const family = createPickups(ctx);
    const length = () => (shown(ctx.layers.fx)[0]?.scale.x ?? Number.NaN) * COMET_LENGTH;

    family.update(stateWith(10, vibe(1, 300, SPEED)), 0.5, frame);
    const leaving = length();
    family.update(stateWith(30, vibe(1, 540, SPEED)), 0, frame);

    expect(leaving).toBeCloseTo(SPEED * 0.5);
    expect(length()).toBeCloseTo(SPEED * TRAIL_STEPS);
  });

  it('point their star along the flight, stretched, and let it spin again at rest', () => {
    const ctx = context();
    const frame = createFrame();
    const family = createPickups(ctx);
    const star = () => shown(ctx.layers.pickups)[0];

    family.update(stateWith(10, vibe(1, 300, -SPEED)), 0, frame);
    family.update(stateWith(30, vibe(1, 60, -SPEED)), 0, frame);
    const flying = star();
    const heading = flying?.rotation;
    const stretch = (flying?.scale.x ?? 0) / (flying?.scale.y ?? 1);
    family.update(stateWith(31, vibe(1, 60, 0)), 0, frame);

    expect(heading).toBeCloseTo(Math.PI);
    expect(stretch).toBeCloseTo(1.55 / 0.72);
    expect(star()?.scale.x).toBe(star()?.scale.y);
    expect(shown(ctx.layers.fx)).toEqual([]);
  });

  it('keep a short trail and a round star in calm mode', () => {
    const ctx = context();
    const frame = createFrame();
    frame.calm = true;
    const family = createPickups(ctx);

    family.update(stateWith(10, vibe(1, 300, SPEED)), 0, frame);
    family.update(stateWith(30, vibe(1, 540, SPEED)), 0, frame);

    const star = shown(ctx.layers.pickups)[0];
    expect((shown(ctx.layers.fx)[0]?.scale.x ?? 0) * COMET_LENGTH).toBeCloseTo(
      SPEED * CALM_TRAIL_STEPS,
    );
    expect(star?.scale.x).toBe(star?.scale.y);
    expect(star?.rotation).toBe(0);
  });
});
