import { clamp } from '../shared/scalar';
import type { Arena, Vec2 } from '../sim/state';

const VIEW_HEIGHT = 720;
// A phone in landscape, 390 pixels high, shows 515 units instead of 720: its players stay readable.
const MIN_SCALE = 390 / 515;
const GROUP_MARGIN = 140;
const MIN_SCALE_SHARE = 0.6;
const EASE_TICKS = 10;
const SETTLED_PIXELS = 0.5;
const SETTLED_SCALE = 0.001;

export interface Camera {
  readonly centerX: number;
  readonly centerY: number;
  readonly scale: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function baseScale(screenHeight: number): number {
  return Math.max(Math.max(screenHeight, 1) / VIEW_HEIGHT, MIN_SCALE);
}

function place(
  x: number,
  y: number,
  scale: number,
  arena: Arena,
  screenWidth: number,
  screenHeight: number,
): Camera {
  return {
    centerX: clampAxis(x, screenWidth / scale, arena.width),
    centerY: clampAxis(y, Math.max(screenHeight, 1) / scale, arena.height),
    scale,
    screenWidth,
    screenHeight,
  };
}

export function frameCamera(
  focus: Vec2,
  arena: Arena,
  screenWidth: number,
  screenHeight: number,
  viewHeight?: number,
): Camera {
  const scale =
    viewHeight === undefined ? baseScale(screenHeight) : Math.max(screenHeight, 1) / viewHeight;
  return place(focus.x, focus.y, scale, arena, screenWidth, screenHeight);
}

export function frameBounds(
  bounds: Bounds,
  arena: Arena,
  screenWidth: number,
  screenHeight: number,
): Camera {
  const base = baseScale(screenHeight);
  const width = bounds.maxX - bounds.minX + 2 * GROUP_MARGIN;
  const height = bounds.maxY - bounds.minY + 2 * GROUP_MARGIN;
  const fit = Math.min(Math.max(screenWidth, 1) / width, Math.max(screenHeight, 1) / height);
  const filled = Math.max(
    Math.max(screenWidth, 1) / arena.width,
    Math.max(screenHeight, 1) / arena.height,
  );
  const scale = clamp(Math.max(fit, filled), base * MIN_SCALE_SHARE, base);
  return place(
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minY + bounds.maxY) / 2,
    scale,
    arena,
    screenWidth,
    screenHeight,
  );
}

export function easeCamera(from: Camera, to: Camera, ticks: number): Camera {
  const share = 1 - Math.exp(-Math.max(ticks, 0) / EASE_TICKS);
  return {
    centerX: from.centerX + (to.centerX - from.centerX) * share,
    centerY: from.centerY + (to.centerY - from.centerY) * share,
    scale: from.scale + (to.scale - from.scale) * share,
    screenWidth: to.screenWidth,
    screenHeight: to.screenHeight,
  };
}

export function isSettled(from: Camera, to: Camera): boolean {
  return (
    Math.abs(from.centerX - to.centerX) * to.scale < SETTLED_PIXELS &&
    Math.abs(from.centerY - to.centerY) * to.scale < SETTLED_PIXELS &&
    Math.abs(from.scale / to.scale - 1) < SETTLED_SCALE
  );
}

// A glide between framings or a shake would otherwise reveal the edge of the arena.
export function centerInArena(
  camera: Camera,
  arena: Arena,
  x: number,
  y: number,
  out: { x: number; y: number },
): void {
  const { scale, screenWidth, screenHeight } = camera;
  out.x = clampAxis(x, screenWidth / scale, arena.width);
  out.y = clampAxis(y, Math.max(screenHeight, 1) / scale, arena.height);
}

function clampAxis(value: number, extent: number, size: number): number {
  return extent >= size ? size / 2 : clamp(value, extent / 2, size - extent / 2);
}

export interface EdgeMarker {
  x: number;
  y: number;
  angle: number;
}

export function edgeMarker(camera: Camera, point: Vec2, inset: number, out: EdgeMarker): boolean {
  const { screenWidth, screenHeight, scale } = camera;
  const x = (point.x - camera.centerX) * scale + screenWidth / 2;
  const y = (point.y - camera.centerY) * scale + screenHeight / 2;
  if (x >= 0 && x <= screenWidth && y >= 0 && y <= screenHeight) {
    return false;
  }
  const dx = x - screenWidth / 2;
  const dy = y - screenHeight / 2;
  const reach = Math.min(
    dx === 0 ? Infinity : (screenWidth / 2 - inset) / Math.abs(dx),
    dy === 0 ? Infinity : (screenHeight / 2 - inset) / Math.abs(dy),
  );
  out.x = screenWidth / 2 + dx * reach;
  out.y = screenHeight / 2 + dy * reach;
  out.angle = Math.atan2(dy, dx);
  return true;
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
