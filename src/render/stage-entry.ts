import { clamp01, smoothstep } from '../shared/scalar';
import { BEATS_PER_BAR } from '../shared/tempo';
import type { Container } from 'pixi.js';
import type { Arena, Vec2 } from '../sim/state';
import { type Camera, frameCamera } from './camera';
import type { StageEntry } from './types';

// From high above, the arena about a fifth of the screen's height: a view of about 5000 units.
export const ENTRY_START_ZOOM = 0.14;
const DIVE_POWER = 2.2;
const ROLL_RADIANS = 0.5;
// The share of the dive past which the camera no longer sees beyond the ground's overflow.
const NEAR_FROM = 0.8;

// How far into the second bar, where the camera dives, in shares of it: below 0 before it.
export function diveProgress(entry: StageEntry, now: number): number {
  const bar = BEATS_PER_BAR * entry.beatMs;
  return (now - (entry.landsAt - bar)) / bar;
}

// The share of the second bar the camera has dived, faster and faster: 0 until then, 1 from the landing.
export function diveOf(entry: StageEntry, now: number): number {
  return clamp01(diveProgress(entry, now)) ** DIVE_POWER;
}

// The share of the game's scale the camera shows the arena at.
export function entryZoom(entry: StageEntry, now: number): number {
  return ENTRY_START_ZOOM ** (1 - diveOf(entry, now));
}

// How much of the ground's detail drawn only as far as the game's view reaches shows: none from the
// sky, coming in over the end of the dive, once the camera is too close to see where it ends.
export function nearShown(entry: StageEntry | null | undefined, now: number): number {
  return entry === undefined || entry === null
    ? 1
    : smoothstep(clamp01((diveOf(entry, now) - NEAR_FROM) / (1 - NEAR_FROM)));
}

// How much of what only the game's view has, like the arena's edges, shows: none while the entry
// flies, coming in over the landing's beat, all without an entry.
export function edgesShown(entry: StageEntry | null | undefined, now: number): number {
  return entry === undefined || entry === null ? 1 : clamp01((now - entry.landsAt) / entry.beatMs);
}

// The camera's roll about the screen's centre, which the dive takes back to none.
export function entryRoll(entry: StageEntry, now: number): number {
  return ROLL_RADIANS * (1 - diveOf(entry, now));
}

// The entry while its camera flies, before its landing, and the page time of that frame.
export interface Flight {
  readonly entry: StageEntry;
  readonly now: number;
}

export function flightOf(entry: StageEntry | null | undefined, now: number): Flight | null {
  return entry !== undefined && entry !== null && now < entry.landsAt ? { entry, now } : null;
}

// The game's camera seen from the sky while an entry dives, the arena small in the festival; it
// moves on the page clock, the game waiting on its first tick, so it never eases.
export function divingCamera(camera: Camera, arena: Arena, flight: Flight | null): Camera {
  if (flight === null) {
    return camera;
  }
  const { centerX, centerY, scale, screenWidth, screenHeight } = camera;
  return frameCamera(
    { x: centerX, y: centerY },
    arena,
    screenWidth,
    screenHeight,
    Math.max(screenHeight, 1) / (scale * entryZoom(flight.entry, flight.now)),
  );
}

// The world with the camera's centre in the middle of the screen, rolled about it: unrolled, its
// position is the screen offset of the world's origin, which the trails follow.
export function placeWorld(
  world: Container,
  center: Vec2,
  scale: number,
  width: number,
  height: number,
  roll: number,
): void {
  const x = center.x * scale;
  const y = center.y * scale;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  world.scale.set(scale);
  world.rotation = roll;
  world.position.set(width / 2 - (x * cos - y * sin), height / 2 - (x * sin + y * cos));
}

// A point of the screen turned by the camera's roll about the screen's centre.
export function rollAbout(camera: Camera, point: Vec2, roll: number): Vec2 {
  if (roll === 0) {
    return point;
  }
  const x = point.x - camera.screenWidth / 2;
  const y = point.y - camera.screenHeight / 2;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  return {
    x: camera.screenWidth / 2 + x * cos - y * sin,
    y: camera.screenHeight / 2 + x * sin + y * cos,
  };
}
