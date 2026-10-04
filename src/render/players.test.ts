import { Container, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import { lightAt, paletteAt } from '../shared/palette';
import type { PlayerState, SimState } from '../sim/state';
import type { RenderContext } from './context';
import { createFrame } from './frame';
import type { Layers } from './layers';
import { createPixiPalette, writePixiPalette } from './palette';
import { contourAlpha, createPlayers, parasolAngle, poiAngle } from './players';
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
