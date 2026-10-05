import { Container, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import { lightAt, paletteAt } from '../shared/palette';
import type { PlayerState, SimEvent, SimState } from '../sim/state';
import type { RenderContext } from './context';
import { createFrame } from './frame';
import type { Layers } from './layers';
import { createPixiPalette, writePixiPalette } from './palette';
import { contourAlpha, createPlayers, parasolAngle, poiAngle } from './players';
import type { NameLabel } from './textures-names';
import type { Shape } from './textures';
import type { LookTextures, PlayerTextures } from './textures-players';

const TAU = Math.PI * 2;

function shape(): Shape {
  return { texture: Texture.EMPTY, radius: 32 };
}

function lookTextures(): LookTextures {
  return { object: shape(), downed: shape(), extent: 40, height: 1, shadow: shape() };
}

function createContext(): { ctx: RenderContext; players: Container } {
  const players = new Container();
  const layers = { players, glow: new Container() } as unknown as Layers;
  const textures = {
    halo: shape(),
    ring: shape(),
    pip: shape(),
    names: {
      get: (): NameLabel => ({ fill: Texture.EMPTY, edge: Texture.EMPTY }),
      destroy: () => undefined,
    },
    players: {
      shoulders: shape(),
      head: shape(),
      aim: shape(),
      contour: shape(),
      looks: { poi: lookTextures(), case: lookTextures(), parasol: lookTextures() },
    } satisfies PlayerTextures,
  };
  const ctx = {
    textures,
    layers,
    options: { calmMode: false },
    classTokens: new Map([['mage', 'mage']]),
  } as unknown as RenderContext;
  return { ctx, players };
}

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 0,
    classId: 'mage',
    radius: 14,
    x: 140,
    y: 60,
    prevX: 100,
    prevY: 20,
    hp: 100,
    maxHp: 100,
    speed: 3,
    aim: { x: 1, y: 0 },
    level: 1,
    vibes: 0,
    vibesToNextLevel: 10,
    attackCooldown: 0,
    skillCooldown: 0,
    ultimateReady: false,
    upgrades: [],
    modifiers: {},
    downed: false,
    ...overrides,
  };
}

function frameAt(fraction: number) {
  const frame = createFrame();
  frame.fraction = fraction;
  frame.light = lightAt(fraction);
  frame.palette = createPixiPalette();
  writePixiPalette(frame.palette, paletteAt(fraction));
  return frame;
}

describe('poiAngle', () => {
  it('makes one turn per bar', () => {
    const start = 3 * TICKS_PER_BAR;

    expect(poiAngle(start + TICKS_PER_BAR) - poiAngle(start)).toBeCloseTo(0, 9);
    expect(poiAngle(start + TICKS_PER_BAR / 4)).toBeCloseTo(TAU / 4, 9);
    expect(poiAngle(start + TICKS_PER_BAR / 2)).toBeCloseTo(TAU / 2, 9);
  });

  it('keeps the parasol twice slower than the poi', () => {
    expect(parasolAngle(TICKS_PER_BAR)).toBeCloseTo(TAU / 2, 9);
    expect(parasolAngle(2 * TICKS_PER_BAR + 1)).toBeCloseTo(parasolAngle(1), 9);
  });
});

describe('contourAlpha', () => {
  it('breathes on the beat without ever going dark or jumping', () => {
    const samples = Array.from({ length: TICKS_PER_BEAT * 4 }, (_, index) =>
      contourAlpha(index / 4),
    );

    expect(Math.min(...samples)).toBeGreaterThan(0.25);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    for (let index = 1; index < samples.length; index += 1) {
      expect(Math.abs((samples[index] ?? 0) - (samples[index - 1] ?? 0))).toBeLessThan(0.12);
    }
    expect(contourAlpha(TICKS_PER_BEAT)).toBeCloseTo(contourAlpha(0), 9);
  });
});

describe('createPlayers', () => {
  function drawn(alpha: number, current: PlayerState) {
    const { ctx, players } = createContext();
    const family = createPlayers(ctx);
    const state = { players: [current] } as unknown as SimState;
    family.update(state, alpha, frameAt(0.4));
    const bodies = players.children[1] as Container;
    return bodies.children;
  }

  it('draws the object between the previous and the current position', () => {
    const [, , , , object] = drawn(0.25, player());

    expect(object?.x).toBeCloseTo(110, 9);
    expect(object?.y).toBeCloseTo(30, 9);
  });

  it('lays the object next to the player when downed, as one gray sprite', () => {
    const sprites = drawn(1, player({ downed: true }));
    const visible = sprites.filter((sprite) => sprite.visible);

    expect(visible).toHaveLength(1);
    expect(visible[0]?.x).toBeCloseTo(140, 9);
  });

  it('shows the contour only while invulnerable', () => {
    const contour = (invulnerableTicks: number) => {
      const sprites = drawn(1, player({ invulnerableTicks }));
      return sprites[sprites.length - 1]?.visible;
    };

    expect(contour(0)).toBe(false);
    expect(contour(5)).toBe(true);
  });
});

describe('player names and relève', () => {
  function run(players: PlayerState[], events: SimEvent[] = [], tick = 10) {
    const { ctx, players: root } = createContext();
    const family = createPlayers(ctx);
    const state = { players, tick, events } as unknown as SimState;
    const frame = frameAt(0.4);
    frame.now = tick;
    for (const event of events) {
      family.onEvent?.(event, state, frame);
    }
    family.update(state, 1, frame);
    const containers = root.children.map((child) => child);
    return {
      rings: containers[2] ?? new Container(),
      tags: containers[3] ?? new Container(),
      family,
      state,
      frame,
    };
  }

  it('gives no label to a player without a name, and one to a player with a name', () => {
    const solo = run([player()]);
    const coop = run([player({ name: 'Zoé' })]);

    expect(solo.tags.children.filter((sprite) => sprite.visible)).toHaveLength(0);
    expect(coop.tags.children.filter((sprite) => sprite.visible)).toHaveLength(2);
  });

  it('keeps no label for an empty name', () => {
    const { tags } = run([player({ name: '' })]);

    expect(tags.children.filter((sprite) => sprite.visible)).toHaveLength(0);
  });

  it('fills the relève ring with the reported progress, and only while it is reported', () => {
    const downed = player({ downed: true });
    const reviving: SimEvent = { type: 'playerReviving', playerId: 0, byPlayer: 1, progress: 0.5 };

    const idle = run([downed]);
    const filling = run([downed], [reviving]);
    const [ring] = filling.rings.children as Container[];
    const beads = (ring?.children ?? []).slice(1);

    expect(idle.rings.children.every((child) => !child.visible)).toBe(true);
    expect(ring?.visible).toBe(true);
    expect(beads.filter((bead) => bead.alpha === 1)).toHaveLength(12);
    expect(beads.filter((bead) => bead.alpha === 0)).toHaveLength(12);

    filling.state.tick = 20;
    filling.frame.now = 20;
    filling.family.update(filling.state, 1, filling.frame);
    expect(ring?.visible).toBe(false);
  });

  it('opens a soft halo when the ally is revived, then lets it go', () => {
    const revived: SimEvent = { type: 'playerRevived', playerId: 0 };
    const { state, frame } = run([player()], [revived]);

    const glowAt = (now: number) => {
      const context = createContext();
      const fresh = createPlayers(context.ctx);
      const at = { ...state, tick: 10 };
      frame.now = 10;
      fresh.onEvent?.(revived, at, frame);
      frame.now = now;
      fresh.update(at, 1, frame);
      return context.ctx.layers.glow.children.filter((sprite) => sprite.visible).length;
    };

    expect(glowAt(12)).toBe(2);
    expect(glowAt(10 + 10 * TICKS_PER_BEAT)).toBe(1);
  });
});
