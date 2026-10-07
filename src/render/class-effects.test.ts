import { Container, Texture } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { lightAt, paletteAt } from '../shared/palette';
import type { SimEvent, SimState } from '../sim/state';
import { createClassEffects } from './class-effects';
import type { RenderContext } from './context';
import { FIXTURE_CONTENT, createFixtureState } from './fixture';
import { type Frame, createFrame } from './frame';
import { createLayers } from './layers';
import { BLINK_TICKS } from './motion';
import { writePixiPalette } from './palette';
import type { Shape } from './textures';

const ROADIE = 1;
const CARE = 2;

function frameAt(fraction: number, now = 0, calm = false): Frame {
  const frame = createFrame();
  frame.fraction = fraction;
  frame.now = now;
  frame.calm = calm;
  frame.light = lightAt(fraction);
  writePixiPalette(frame.palette, paletteAt(fraction));
  return frame;
}

function context() {
  const shape: Shape = { texture: Texture.EMPTY, radius: 32 };
  const ctx = {
    textures: {
      halo: shape,
      ring: shape,
      shard: shape,
      vibes: shape,
      classFx: { trail: shape, mandala: shape },
    },
    layers: createLayers(new Container()),
    options: { calmMode: false },
    classTokens: new Map([
      ['mage', 'mage'],
      ['tank', 'tank'],
      ['healer', 'healer'],
    ]),
    skillEffects: new Map(FIXTURE_CONTENT.classes.map((def) => [def.id, def.skill.effect])),
  } as unknown as RenderContext;
  return ctx;
}

function setup() {
  const ctx = context();
  const blink = vi.fn<(id: number, until: number) => void>();
  const family = createClassEffects(ctx, blink);
  const state = createFixtureState({ enemies: 0, projectiles: 0 });
  return { ctx, family, state, blink };
}

function play(
  family: ReturnType<typeof createClassEffects>,
  state: SimState,
  frame: Frame,
  events: SimEvent[],
): void {
  state.events = events;
  for (const event of events) {
    family.onEvent?.(event, state, frame);
  }
  family.update(state, 0, frame);
}

function shown(ctx: RenderContext): number {
  const visible = (container: Container) => container.children.filter((child) => child.visible);
  return visible(ctx.layers.fx).length;
}

describe('charge', () => {
  it('draws a trail behind the one who dashes, and a wave around a nova', () => {
    const { ctx, family, state } = setup();

    play(family, state, frameAt(0.4, 1), [{ type: 'skillUsed', playerId: 0 }]);
    const nova = shown(ctx);
    play(family, state, frameAt(0.4, 2), [{ type: 'skillUsed', playerId: ROADIE }]);

    expect(nova).toBe(2);
    expect(shown(ctx)).toBe(5);
  });

  it('stretches the trail over the dash, whatever the footsteps of the tick before', () => {
    const { ctx, family, state } = setup();
    const roadie = state.players[ROADIE];
    if (roadie === undefined) {
      throw new Error('Fixture has no roadie');
    }
    roadie.prevX = roadie.x - 6;

    play(family, state, frameAt(0.4, 1), [{ type: 'skillUsed', playerId: ROADIE }]);

    const [trail] = ctx.layers.fx.children.filter((child) => child.visible);
    expect((trail?.scale.x ?? 0) * 32).toBeCloseTo(55);
  });

  it('draws an inward ring on a taunt and blinks the bad vibes in reach only', () => {
    const { ctx, family, state, blink } = setup();
    state.enemies = createFixtureState({ enemies: 3, projectiles: 0 }).enemies.slice(0, 3);
    const [near, far, other] = state.enemies;
    if (near === undefined || far === undefined || other === undefined) {
      throw new Error('Fixture lacks enemies');
    }
    Object.assign(near, { x: 100, y: 100, id: 11 });
    Object.assign(far, { x: 900, y: 900, id: 12 });
    Object.assign(other, { x: 150, y: 100, id: 13 });
    state.tick = 40;

    play(family, state, frameAt(0.4, 40), [
      { type: 'taunted', playerId: ROADIE, x: 100, y: 100, radius: 120, count: 2 },
    ]);

    expect(blink.mock.calls).toEqual([
      [11, 40 + BLINK_TICKS],
      [13, 40 + BLINK_TICKS],
    ]);
    expect(shown(ctx)).toBeGreaterThan(0);
  });
});

describe('heal', () => {
  it('widens a ring on the pulse', () => {
    const { ctx, family, state } = setup();

    play(family, state, frameAt(0.4, 1), [{ type: 'skillUsed', playerId: CARE }]);

    expect(shown(ctx)).toBe(2);
  });

  it('reflects on each ally healed, haloes the core, and sprays on a revival', () => {
    const { ctx, family, state } = setup();

    play(family, state, frameAt(0.4, 1), [{ type: 'playerHealed', playerId: 0, amount: 5 }]);
    const reflect = shown(ctx);
    family.reset?.();
    play(family, state, frameAt(0.4, 2), [{ type: 'coreRepaired', amount: 5 }]);
    const core = shown(ctx);
    family.reset?.();
    play(family, state, frameAt(0.4, 3), [{ type: 'playerRevived', playerId: 0 }]);

    expect(reflect).toBe(3);
    expect(core).toBe(2);
    expect(shown(ctx)).toBe(13);
  });

  it('ignores a heal of nothing', () => {
    const { ctx, family, state } = setup();

    play(family, state, frameAt(0.4, 1), [
      { type: 'playerHealed', playerId: 0, amount: 0 },
      { type: 'coreRepaired', amount: 0 },
    ]);

    expect(shown(ctx)).toBe(0);
  });

  it('shows less in the calm mode: lower alpha, fewer shards', () => {
    const night = setup();
    const calm = setup();

    play(night.family, night.state, frameAt(0.4, 1), [{ type: 'playerRevived', playerId: 0 }]);
    play(calm.family, calm.state, frameAt(0.4, 1, true), [{ type: 'playerRevived', playerId: 0 }]);

    const alphas = (ctx: RenderContext) =>
      ctx.layers.fx.children.filter((child) => child.visible).map((child) => child.alpha);
    expect(shown(calm.ctx)).toBeLessThan(shown(night.ctx));
    expect(Math.max(...alphas(calm.ctx))).toBeLessThan(Math.max(...alphas(night.ctx)));
  });

  it('recycles its sprites: a thousand events after warm-up add none', () => {
    const { ctx, family, state } = setup();
    const events: SimEvent[] = [
      { type: 'playerRevived', playerId: 0 },
      { type: 'playerHealed', playerId: 1, amount: 4 },
      { type: 'skillUsed', playerId: ROADIE },
      { type: 'skillUsed', playerId: CARE },
    ];
    for (let tick = 0; tick < 40; tick += 1) {
      play(family, state, frameAt(0.4, tick), events);
    }
    const warm = ctx.layers.fx.children.length;

    for (let tick = 40; tick < 1000; tick += 1) {
      play(family, state, frameAt(0.4, tick), events);
    }

    expect(ctx.layers.fx.children).toHaveLength(warm);
  });
});
