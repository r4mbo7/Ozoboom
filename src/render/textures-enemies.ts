import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import {
  FACES,
  FACE_RADIUS,
  NEUTRAL,
  NEUTRAL_FACE,
  drowsyZ,
  smile,
  type Face,
  type Pose,
} from './faces';
import type { Ctx, Shape } from './paint';

const CELL = 144;
const BOSS_SCALE = 2;

export interface Mask {
  readonly face: Face;
  readonly awake: readonly Texture[];
  readonly asleep: Texture;
  readonly down: Texture;
  // Pixels of the texture between the center and the edge of the body: the sprite scales by it.
  readonly radius: number;
}

export interface MaskSet {
  readonly masks: ReadonlyMap<string, Mask>;
  readonly neutral: Mask;
  readonly smile: Shape;
  readonly bossSmile: Shape;
  readonly drowsy: Shape;
  destroy(): void;
}

interface Cell {
  readonly draw: (ctx: Ctx) => void;
}

// One canvas for a whole family: one texture source, so that hundreds of masks batch together.
function atlas(cells: readonly Cell[], cell: number, scale: number): Texture[] {
  const columns = Math.ceil(Math.sqrt(cells.length));
  const rows = Math.ceil(cells.length / columns);
  const canvas = document.createElement('canvas');
  canvas.width = columns * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context is unavailable');
  }
  cells.forEach(({ draw }, index) => {
    ctx.save();
    ctx.translate(
      (index % columns) * cell + cell / 2,
      Math.floor(index / columns) * cell + cell / 2,
    );
    ctx.scale(scale, scale);
    draw(ctx);
    ctx.restore();
  });
  const source = new CanvasSource({ resource: canvas, autoGenerateMipmaps: true });
  return cells.map(
    (_, index) =>
      new Texture({
        source,
        frame: new Rectangle(
          (index % columns) * cell,
          Math.floor(index / columns) * cell,
          cell,
          cell,
        ),
      }),
  );
}

function poseCells(face: Face): Cell[] {
  const awake = Array.from({ length: face.frames }, (_, index): Cell => ({
    draw: (ctx) => {
      face.draw(ctx, { t: index / face.frames, asleep: false, down: false });
    },
  }));
  const still = (pose: Pose): Cell => ({
    draw: (ctx) => {
      face.draw(ctx, pose);
    },
  });
  return [
    ...awake,
    still({ t: 0, asleep: true, down: false }),
    still({ t: 0, asleep: false, down: true }),
  ];
}

export function createMasks(): MaskSet {
  const entries: [string, Face][] = [[NEUTRAL, NEUTRAL_FACE], ...Object.entries(FACES)];
  const small = entries.filter(([, face]) => !face.boss);
  const large = entries.filter(([, face]) => face.boss);

  const smallCells = [
    ...small.flatMap(([, face]) => poseCells(face)),
    { draw: smile },
    { draw: drowsyZ },
  ];
  const largeCells = [...large.flatMap(([, face]) => poseCells(face)), { draw: smile }];
  const smallTextures = atlas(smallCells, CELL, 1);
  const largeTextures = atlas(largeCells, CELL * BOSS_SCALE, BOSS_SCALE);

  const masks = new Map<string, Mask>();
  const take = (textures: Texture[], list: [string, Face][], scale: number) => {
    let at = 0;
    for (const [id, face] of list) {
      const awake = textures.slice(at, at + face.frames);
      const asleep = textures[at + face.frames];
      const down = textures[at + face.frames + 1];
      at += face.frames + 2;
      if (asleep === undefined || down === undefined) {
        throw new Error(`Mask "${id}" is missing a pose`);
      }
      masks.set(id, { face, awake, asleep, down, radius: FACE_RADIUS * scale });
    }
    return at;
  };
  const smallEnd = take(smallTextures, small, 1);
  const largeEnd = take(largeTextures, large, BOSS_SCALE);
  const neutral = masks.get(NEUTRAL);
  const smileTexture = smallTextures[smallEnd];
  const drowsyTexture = smallTextures[smallEnd + 1];
  const bossSmileTexture = largeTextures[largeEnd];
  if (
    neutral === undefined ||
    smileTexture === undefined ||
    drowsyTexture === undefined ||
    bossSmileTexture === undefined
  ) {
    throw new Error('Mask atlas is missing a texture');
  }
  masks.delete(NEUTRAL);
  return {
    masks,
    neutral,
    smile: { texture: smileTexture, radius: FACE_RADIUS },
    bossSmile: { texture: bossSmileTexture, radius: FACE_RADIUS * BOSS_SCALE },
    drowsy: { texture: drowsyTexture, radius: 9 },
    destroy() {
      for (const texture of [...smallTextures, ...largeTextures]) {
        texture.destroy(false);
      }
      smallTextures[0]?.source.destroy();
      largeTextures[0]?.source.destroy();
    },
  };
}
