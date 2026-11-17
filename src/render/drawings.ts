import type { Container, TextureSource } from 'pixi.js';
import type { Later } from './paint';
import { createBagLook } from './look-bag';
import { createParasolLook } from './look-parasol';
import { createPoiLook } from './look-poi';
import type { Look, Spawn } from './player-look';
import type { Textures } from './textures';
import { type LookTextures, PLAYER_LOOKS, type PlayerLook } from './textures-players';

export interface ClassDrawing {
  readonly classId: string;
  paint(density: number): PaintedDrawing;
}

export interface PaintedDrawing extends LookTextures {
  readonly source: TextureSource;
  create(bodies: Container, glow: Container, textures: Textures, spawn: Spawn): Look;
}

export type Drawings = ReadonlyMap<string, Later<PaintedDrawing>>;

export interface Drawn {
  readonly textures: LookTextures;
  readonly make: (body: Container) => Look;
}

const LOOKS: ReadonlyMap<string, PlayerLook> = new Map(Object.entries(PLAYER_LOOKS));

export function checkDrawings(
  classes: readonly { readonly id: string }[],
  drawings: Drawings,
): void {
  for (const { id } of classes) {
    if (!LOOKS.has(id) && !drawings.has(id)) {
      throw new Error(`Class "${id}" has no drawing`);
    }
  }
}

// Each player's look is drawn into its own body, which the potion's aura captures alone.
export function createDrawn(
  textures: Textures,
  glow: Container,
  spawn: Spawn,
): (classId: string) => Drawn {
  const t = textures.players;
  const makers: Readonly<Record<PlayerLook, (body: Container) => Look>> = {
    poi: (body) => createPoiLook(body, textures, spawn),
    bag: (body) => createBagLook(body, textures, spawn),
    parasol: (body) => createParasolLook(body, glow, textures, spawn),
  };
  const drawn = new Map<string, Drawn>();

  function drawingOf(classId: string): Drawn {
    const kind = LOOKS.get(classId);
    if (kind !== undefined) {
      return { textures: t.looks[kind], make: makers[kind] };
    }
    const painted = t.drawings.get(classId)?.get();
    if (painted === undefined) {
      throw new Error(`Class "${classId}" has no drawing`);
    }
    return { textures: painted, make: (body) => painted.create(body, glow, textures, spawn) };
  }

  return (classId) => {
    let found = drawn.get(classId);
    if (found === undefined) {
      found = drawingOf(classId);
      drawn.set(classId, found);
    }
    return found;
  };
}
