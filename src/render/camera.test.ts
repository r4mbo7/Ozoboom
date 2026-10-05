import { describe, expect, it } from 'vitest';
import {
  ARENA_MARGIN,
  type Bounds,
  type Camera,
  type EdgeMarker,
  MIN_SCALE_SHARE,
  VIEW_HEIGHT,
  baseScale,
  easeCamera,
  edgeMarker,
  frameBounds,
  frameCamera,
  isSettled,
  screenToWorld,
  worldToScreen,
} from './camera';

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

  it('keeps screenToWorld exact at the usual scale and at the backed-off one', () => {
    const wide = frameBounds({ minX: 100, minY: 100, maxX: 1500, maxY: 900 }, arena, 1280, 800);
    const usual = frameCamera({ x: 700, y: 400 }, arena, 1280, 800);
    const point = { x: 612.25, y: 301.5 };

    expect(wide.scale).toBeLessThan(usual.scale);
    for (const camera of [wide, usual]) {
      const back = screenToWorld(camera, worldToScreen(camera, point));
      expect(Math.abs(back.x - point.x)).toBeLessThan(0.01);
      expect(Math.abs(back.y - point.y)).toBeLessThan(0.01);
    }
  });
});

const wide = { width: 3200, height: 1600 };
const SCREEN = { width: 1280, height: 800 };
const TICK_STEP = 0.25;
const steps = (ticks: number) => Math.round(ticks / TICK_STEP);

function boundsOf(points: readonly { x: number; y: number }[]): Bounds {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function onScreen(camera: Camera, point: { x: number; y: number }): boolean {
  const { x, y } = worldToScreen(camera, point);
  return x >= 0 && x <= camera.screenWidth && y >= 0 && y <= camera.screenHeight;
}

describe('group camera', () => {
  it('backs off no further than the minimum share of the usual scale, and never closer', () => {
    const base = baseScale(SCREEN.height);
    const alone = frameBounds({ minX: 800, minY: 500, maxX: 800, maxY: 500 }, arena, 1280, 800);
    const far = frameBounds({ minX: -48, minY: -48, maxX: 1648, maxY: 1048 }, arena, 1280, 800);
    const middle = frameBounds({ minX: 300, minY: 400, maxX: 1300, maxY: 600 }, arena, 1280, 800);

    expect(alone.scale).toBe(base);
    expect(far.scale).toBeCloseTo(base * MIN_SCALE_SHARE, 9);
    expect(middle.scale).toBeLessThan(base);
    expect(middle.scale).toBeGreaterThan(base * MIN_SCALE_SHARE);
  });

  it('keeps every player on screen at every image while two walk apart, then signals them', () => {
    const speed = 4;
    const left = { x: 1500, y: 800 };
    const right = { x: 1700, y: 800 };
    let camera = frameBounds(boundsOf([left, right]), wide, SCREEN.width, SCREEN.height);
    let signalled = 0;
    let lost = 0;
    const marker: EdgeMarker = { x: 0, y: 0, angle: 0 };

    for (let step = 0; step < steps(500); step += 1) {
      left.x = Math.max(left.x - speed * TICK_STEP, 0);
      right.x = Math.min(right.x + speed * TICK_STEP, wide.width);
      const target = frameBounds(boundsOf([left, right]), wide, SCREEN.width, SCREEN.height);
      camera = easeCamera(camera, target, TICK_STEP);
      const visible = onScreen(camera, left) && onScreen(camera, right);
      const arrows = [left, right].filter((player) => edgeMarker(camera, player, 30, marker));
      if (camera.scale > baseScale(SCREEN.height) * MIN_SCALE_SHARE + 0.01) {
        expect(visible).toBe(true);
        expect(arrows).toHaveLength(0);
      } else if (!visible) {
        lost += 1;
        signalled += arrows.length > 0 ? 1 : 0;
      }
    }

    expect(lost).toBeGreaterThan(0);
    expect(signalled).toBe(lost);
  });

  it('keeps the walkers framed across the arena, not only on the open ground', () => {
    const left = { x: 300, y: 200 };
    const right = { x: 1300, y: 800 };
    let camera = frameBounds(boundsOf([left, right]), arena, SCREEN.width, SCREEN.height);

    for (let step = 0; step < steps(120); step += 1) {
      left.x = Math.max(left.x - 3 * TICK_STEP, 0);
      left.y = Math.max(left.y - 3 * TICK_STEP, 0);
      right.x = Math.min(right.x + 3 * TICK_STEP, arena.width);
      right.y = Math.min(right.y + 3 * TICK_STEP, arena.height);
      camera = easeCamera(
        camera,
        frameBounds(boundsOf([left, right]), arena, SCREEN.width, SCREEN.height),
        TICK_STEP,
      );
      expect(onScreen(camera, left)).toBe(true);
      expect(onScreen(camera, right)).toBe(true);
    }
  });

  it('glides toward its target at the same pace whatever the frame rate', () => {
    const from = frameCamera({ x: 400, y: 300 }, arena, 1280, 800);
    const to = frameCamera({ x: 1000, y: 700 }, arena, 1280, 800);

    let coarse = from;
    for (let step = 0; step < steps(4); step += 1) {
      coarse = easeCamera(coarse, to, TICK_STEP);
    }
    const once = easeCamera(from, to, 4);

    expect(coarse.centerX).toBeCloseTo(once.centerX, 6);
    expect(once.centerX).toBeGreaterThan(from.centerX);
    expect(once.centerX).toBeLessThan(to.centerX);
    expect(easeCamera(from, to, 0)).toEqual(from);
    expect(isSettled(from, to)).toBe(false);
    expect(isSettled(to, to)).toBe(true);
  });

  it('places the arrow on the border, toward the player, and none for a visible one', () => {
    const camera = frameCamera({ x: 800, y: 500 }, arena, 1280, 800);
    const marker: EdgeMarker = { x: 0, y: 0, angle: 0 };

    expect(edgeMarker(camera, { x: 820, y: 510 }, 30, marker)).toBe(false);

    expect(edgeMarker(camera, { x: 5000, y: 500 }, 30, marker)).toBe(true);
    expect(marker.x).toBeCloseTo(1280 - 30, 6);
    expect(marker.y).toBeCloseTo(400, 6);
    expect(marker.angle).toBeCloseTo(0, 6);

    expect(edgeMarker(camera, { x: 800, y: -4000 }, 30, marker)).toBe(true);
    expect(marker.y).toBeCloseTo(30, 6);
    expect(marker.angle).toBeCloseTo(-Math.PI / 2, 6);
  });
});
