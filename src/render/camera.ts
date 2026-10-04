import type { Arena, Vec2 } from '../sim/state';

export const VIEW_HEIGHT = 720;
export const ARENA_MARGIN = 48;

export interface Camera {
  readonly centerX: number;
  readonly centerY: number;
  readonly scale: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
}

export function frameCamera(
  focus: Vec2,
  arena: Arena,
  screenWidth: number,
  screenHeight: number,
): Camera {
  const scale = Math.max(screenHeight, 1) / VIEW_HEIGHT;
  return {
    centerX: clampAxis(focus.x, screenWidth / scale / 2, arena.width),
    centerY: clampAxis(focus.y, VIEW_HEIGHT / 2, arena.height),
    scale,
    screenWidth,
    screenHeight,
  };
}

function clampAxis(value: number, halfExtent: number, size: number): number {
  const low = halfExtent - ARENA_MARGIN;
  const high = size + ARENA_MARGIN - halfExtent;
  return low > high ? size / 2 : Math.min(Math.max(value, low), high);
}

export function worldToScreen(camera: Camera, point: Vec2): Vec2 {
  return {
    x: (point.x - camera.centerX) * camera.scale + camera.screenWidth / 2,
    y: (point.y - camera.centerY) * camera.scale + camera.screenHeight / 2,
  };
}

export function screenToWorld(camera: Camera, point: Vec2): Vec2 {
  return {
    x: (point.x - camera.screenWidth / 2) / camera.scale + camera.centerX,
    y: (point.y - camera.screenHeight / 2) / camera.scale + camera.centerY,
  };
}
