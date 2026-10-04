import { describe, expect, it } from 'vitest';
import { ARENA_MARGIN, VIEW_HEIGHT, frameCamera, screenToWorld, worldToScreen } from './camera';

const arena = { width: 1600, height: 1000 };

describe('camera', () => {
  it('centers on the focus when it is far from the edges', () => {
    const camera = frameCamera({ x: 800, y: 500 }, arena, 1280, 800);

    expect(camera.centerX).toBe(800);
    expect(camera.centerY).toBe(500);
    expect(worldToScreen(camera, { x: 800, y: 500 })).toEqual({ x: 640, y: 400 });
  });

  it('stops at the arena edges, margin included', () => {
    const camera = frameCamera({ x: -500, y: 5000 }, arena, 1280, 800);

    const topLeft = screenToWorld(camera, { x: 0, y: 0 });
    const bottomRight = screenToWorld(camera, { x: 1280, y: 800 });

    expect(topLeft.x).toBeCloseTo(-ARENA_MARGIN, 6);
    expect(bottomRight.y).toBeCloseTo(arena.height + ARENA_MARGIN, 6);
  });

  it('centers the arena on an axis wider than the arena', () => {
    const camera = frameCamera({ x: 100, y: 100 }, arena, 3200, 800);

    expect(camera.centerX).toBe(arena.width / 2);
  });

  it('keeps the vertical world extent when the screen is resized', () => {
    const small = frameCamera({ x: 800, y: 500 }, arena, 640, 360);
    const large = frameCamera({ x: 800, y: 500 }, arena, 1920, 1080);

    for (const camera of [small, large]) {
      const top = screenToWorld(camera, { x: 0, y: 0 });
      const bottom = screenToWorld(camera, { x: 0, y: camera.screenHeight });
      expect(bottom.y - top.y).toBeCloseTo(VIEW_HEIGHT, 6);
    }
  });

  it('inverts worldToScreen with screenToWorld to within 0.01 unit', () => {
    const cameras = [
      frameCamera({ x: 800, y: 500 }, arena, 1280, 800),
      frameCamera({ x: 13.7, y: 991.2 }, arena, 390, 844),
      frameCamera({ x: 1599, y: 0.5 }, arena, 2560, 1080),
    ];
    const points = [
      { x: 0, y: 0 },
      { x: 1600, y: 1000 },
      { x: 412.345, y: 77.89 },
      { x: -40, y: 1040 },
    ];

    for (const camera of cameras) {
      for (const point of points) {
        const back = screenToWorld(camera, worldToScreen(camera, point));
        expect(Math.abs(back.x - point.x)).toBeLessThan(0.01);
        expect(Math.abs(back.y - point.y)).toBeLessThan(0.01);
      }
    }
  });
});
