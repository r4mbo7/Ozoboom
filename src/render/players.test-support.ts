import { Container, Texture } from 'pixi.js';
import { lightAt, paletteAt } from '../shared/palette';
import type { PlayerState } from '../sim/state';
import type { RenderContext } from './context';
import { createFrame } from './frame';
import type { Layers } from './layers';
import { createPixiPalette, writePixiPalette } from './palette';
import type { NameLabel } from './textures-names';
import type { Shape } from './textures';
import type { LookTextures, PlayerTextures } from './textures-players';

function shape(): Shape {
  return { texture: Texture.EMPTY, radius: 32 };
}

function lookTextures(): LookTextures {
  return { object: shape(), downed: shape(), extent: 40, height: 1, shadow: shape() };
}

export const BODIES = 1;
export const MARKS = 2;

export function createContext(): { ctx: RenderContext; players: Container } {
  const players = new Container();
  const layers = { players, glow: new Container(), fx: new Container() } as unknown as Layers;
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
      looks: { poi: lookTextures(), bag: lookTextures(), parasol: lookTextures() },
      poi: { arm: shape(), ball: shape(), strandRoot: shape(), strandTip: shape(), bead: shape() },
      bag: {
        torso: shape(),
        hands: shape(),
        hat: shape(),
        pack: shape(),
        mat: shape(),
        mug: shape(),
      },
      parasol: { sneaker: shape(), pompom: shape() },
      source: Texture.EMPTY.source,
    } satisfies PlayerTextures,
  };
  const ctx = {
    textures,
    layers,
    options: { calmMode: false },
    classTokens: new Map([
      ['mage', 'mage'],
      ['tank', 'tank'],
    ]),
  } as unknown as RenderContext;
  return { ctx, players };
}

export function player(overrides: Partial<PlayerState> = {}): PlayerState {
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
    upgrades: [],
    modifiers: {},
    downed: false,
    ...overrides,
  };
}

export function frameAt(fraction: number) {
  const frame = createFrame();
  frame.fraction = fraction;
  frame.light = lightAt(fraction);
  frame.palette = createPixiPalette();
  writePixiPalette(frame.palette, paletteAt(fraction));
  return frame;
}
