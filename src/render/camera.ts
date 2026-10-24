import type { Arena, Vec2 } from '../sim/state';

export const VIEW_HEIGHT = 720;
// Screen pixels per world unit at the least: a phone in landscape, 390 pixels high, shows 515 units
// instead of 720, so that its players are not drawn too small to read.
export const MIN_SCALE = 390 / 515;
export const GROUP_MARGIN = 140;
export const MIN_SCALE_SHARE = 0.6;
export const EASE_TICKS = 10;
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

// `viewHeight` is the height of world an inset shows; the game's own view is the usual one.
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

// Frames a box, margin included, backing off down to MIN_SCALE_SHARE of the usual scale, and never past
// the scale at which the arena fills the screen.
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
  const scale = Math.min(base, Math.max(base * MIN_SCALE_SHARE, fit, filled));
  return place(
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minY + bounds.maxY) / 2,
    scale,
    arena,
    screenWidth,
    screenHeight,
  );
}

// Glides from one camera to the next at the same pace whatever the frame rate.
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

// The view's center nearest (x, y) that shows nothing past the arena, or its middle on an axis the screen
// is larger than: a glide between framings or a shake may otherwise reveal the edge.
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
  return extent >= size ? size / 2 : Math.min(Math.max(value, extent / 2), size - extent / 2);
}

export interface EdgeMarker {
  x: number;
  y: number;
  angle: number;
}

// Where the arrow toward an off-screen point sits: on the ray from the screen center, `inset` pixels
// inside the border. False when the point is on screen.
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
