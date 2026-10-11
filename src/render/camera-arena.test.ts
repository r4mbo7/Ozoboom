import { describe, expect, it } from 'vitest';
import {
  type Bounds,
  type Camera,
  baseScale,
  centerInArena,
  easeCamera,
  frameBounds,
  frameCamera,
  screenToWorld,
} from './camera';

const arena = { width: 1600, height: 1000 };

function boundsOf(points: readonly { x: number; y: number }[]): Bounds {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

const SCREENS = [
  { width: 640, height: 360 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1080 },
  { width: 3840, height: 1080 },
];
const TOP_LEFT = { x: 0, y: 0 };
const TOP = { x: 800, y: 0 };
const TOP_RIGHT = { x: 1600, y: 0 };
const RIGHT = { x: 1600, y: 500 };
const BOTTOM_RIGHT = { x: 1600, y: 1000 };
const BOTTOM = { x: 800, y: 1000 };
const BOTTOM_LEFT = { x: 0, y: 1000 };
const LEFT = { x: 0, y: 500 };
const SPOTS = [TOP_LEFT, TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT];

function expectInsideArena(camera: Camera, at: { x: number; y: number }): void {
  const topLeft = screenToWorld(camera, { x: 0, y: 0 });
  const bottomRight = screenToWorld(camera, { x: camera.screenWidth, y: camera.screenHeight });
  for (const [low, high, size] of [
    [topLeft.x + at.x - camera.centerX, bottomRight.x + at.x - camera.centerX, arena.width],
    [topLeft.y + at.y - camera.centerY, bottomRight.y + at.y - camera.centerY, arena.height],
  ] as const) {
    if (high - low > size) {
      expect((low + high) / 2).toBeCloseTo(size / 2, 6);
    } else {
      expect(low).toBeGreaterThanOrEqual(-1e-6);
      expect(high).toBeLessThanOrEqual(size + 1e-6);
    }
  }
}

describe('camera inside the arena', () => {
  it('never shows past an edge or a corner, alone, at any screen size', () => {
    for (const screen of SCREENS) {
      for (const spot of SPOTS) {
        const camera = frameCamera(spot, arena, screen.width, screen.height);

        expectInsideArena(camera, { x: camera.centerX, y: camera.centerY });
      }
    }
  });

  it('never shows past an edge or a corner while it frames everyone, at any screen size', () => {
    const groups = [
      ...SPOTS.map((spot) => [spot, { x: (spot.x + 800) / 2, y: (spot.y + 500) / 2 }]),
      [TOP_LEFT, BOTTOM_RIGHT],
      [TOP_RIGHT, BOTTOM_LEFT],
      [TOP, BOTTOM],
      [LEFT, RIGHT],
    ];
    for (const screen of SCREENS) {
      for (const group of groups) {
        const camera = frameBounds(boundsOf(group), arena, screen.width, screen.height);

        expectInsideArena(camera, { x: camera.centerX, y: camera.centerY });
      }
    }
  });

  it('backs off for a group only until the arena fills the screen, unless it is smaller', () => {
    const corners = boundsOf([TOP_LEFT, BOTTOM_RIGHT]);

    for (const screen of SCREENS) {
      const camera = frameBounds(corners, arena, screen.width, screen.height);
      const fit = Math.max(screen.width / arena.width, screen.height / arena.height);

      expect(camera.scale).toBeGreaterThanOrEqual(Math.min(baseScale(screen.height), fit) - 1e-9);
    }
  });

  it('keeps the edge hidden while the screen shakes and while it glides between framings', () => {
    const out = { x: 0, y: 0 };
    for (const screen of SCREENS) {
      const corner = frameCamera(TOP_RIGHT, arena, screen.width, screen.height);
      const group = frameBounds(
        boundsOf([TOP_LEFT, BOTTOM_RIGHT]),
        arena,
        screen.width,
        screen.height,
      );
      const resized = frameCamera(BOTTOM_LEFT, arena, screen.width * 2, screen.height / 2);
      for (const [from, to] of [
        [corner, group],
        [group, corner],
        [resized, corner],
      ] as const) {
        for (let ticks = 0; ticks <= 40; ticks += 1) {
          const camera = easeCamera(from, to, ticks);
          for (const [dx, dy] of [
            [7, 7],
            [-7, -7],
            [7, -7],
            [-7, 7],
          ] as const) {
            centerInArena(
              camera,
              arena,
              camera.centerX + dx / camera.scale,
              camera.centerY + dy / camera.scale,
              out,
            );

            expectInsideArena(camera, out);
          }
        }
      }
    }
  });
});
