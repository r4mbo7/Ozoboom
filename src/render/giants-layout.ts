import { DOME_SCALE as SCALE, SPEAKER_REACH } from '../data/sets';
import type { ObstacleDefinition, SetDefinition } from '../data/types';
import type { Vec2 } from '../shared/vec';

export interface GiantArm {
  readonly stones: readonly ObstacleDefinition[];
}

export interface GiantLayout {
  readonly angle: number;
  readonly arms: readonly [GiantArm, GiantArm];
}

export interface ArmPath {
  // Shoulder, the stones the arm runs over, then the hand on the entrance axis.
  readonly points: readonly Vec2[];
  // Stones nearer the giant's axis than its shoulder: they lie under the torso.
  readonly underTorso: readonly ObstacleDefinition[];
}

const TAU = Math.PI * 2;
const CROWN_MARGIN = 1.15;
const DIAGONALS = [-0.75, -0.25, 0.25, 0.75].map((turn) => turn * Math.PI);
export const SHOULDER = { x: 398, y: 32 } as const;
const HAND_REACH = 420 * SCALE;

function wrap(angle: number): number {
  return ((((angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

// The crown is the nearest ring of obstacles to the core; what lies beyond it are the giants' arm stones. Each stone
// goes to the nearest diagonal, on the side of it that its angle falls, and an arm lists its stones from the body out.
export function layGiants(obstacles: readonly ObstacleDefinition[], center: Vec2): GiantLayout[] {
  const polar = obstacles.map((stone) => ({
    stone,
    distance: Math.hypot(stone.x - center.x, stone.y - center.y),
    angle: Math.atan2(stone.y - center.y, stone.x - center.x),
  }));
  const crown = Math.min(...polar.map(({ distance }) => distance));
  const arms = polar.filter(({ distance }) => distance > crown * CROWN_MARGIN);
  return DIAGONALS.map((angle) => {
    const sides: [typeof arms, typeof arms] = [[], []];
    for (const entry of arms) {
      const offset = wrap(entry.angle - angle);
      if (Math.abs(offset) < Math.PI / 4) {
        sides[offset <= 0 ? 0 : 1].push({ ...entry, angle: Math.abs(offset) });
      }
    }
    const [left, right] = sides.map((side) => ({
      stones: side.sort((a, b) => a.angle - b.angle).map(({ stone }) => stone),
    }));
    return { angle, arms: [left ?? { stones: [] }, right ?? { stones: [] }] };
  });
}

// The arm leaves the shoulder, runs over its stones and ends on the entrance axis, as far out as its last stone:
// there it meets the hand of the neighbouring giant.
export function armPath(giant: GiantLayout, center: Vec2, arm: 0 | 1): ArmPath {
  const side = arm === 0 ? -1 : 1;
  const polar = (radius: number, angle: number): Vec2 => ({
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  });
  const shoulderOffset = Math.atan2(SHOULDER.y, SHOULDER.x);
  const shoulder = polar(
    Math.hypot(SHOULDER.x, SHOULDER.y) * SCALE,
    giant.angle + side * shoulderOffset,
  );
  const offset = (stone: Vec2): number =>
    Math.abs(wrap(Math.atan2(stone.y - center.y, stone.x - center.x) - giant.angle));
  const { stones } = giant.arms[arm];
  const along = stones.filter((stone) => offset(stone) > shoulderOffset);
  const last = along.at(-1);
  const reach = last === undefined ? HAND_REACH : Math.hypot(last.x - center.x, last.y - center.y);
  const hand = polar(reach, giant.angle + (side * Math.PI) / 4);
  return {
    points: [shoulder, ...along.map(({ x, y }) => ({ x, y })), hand],
    underTorso: stones.filter((stone) => offset(stone) <= shoulderOffset),
  };
}

export interface Disc extends Vec2 {
  readonly radius: number;
}

// What the mushroom clusters keep off: the obstacles, and each speaker as far as its drawing reaches.
export function keepClear(set: SetDefinition): Disc[] {
  return [
    ...(set.obstacles ?? []),
    ...(set.speakers ?? []).map(({ x, y, radius }) => ({ x, y, radius: radius * SPEAKER_REACH })),
  ];
}

// Mushrooms of a cluster land anywhere in a square of this spread, the largest cap included.
export function clusterReach(spread: number): number {
  return ((spread / 2) * Math.SQRT2 + 13) * SCALE;
}

const CLUSTER_RADIUS = 372 * SCALE;
const CLUSTER_ARC = (24 * Math.PI) / 180;
const NUDGE = (1.5 * Math.PI) / 180;
const MAX_NUDGES = 14;
const GRID = 20 * SCALE;
const GRID_RINGS = 8;

function clearance(at: Vec2, reach: number, avoid: readonly Disc[]): number {
  return Math.min(
    ...avoid.map((disc) => Math.hypot(at.x - disc.x, at.y - disc.y) - disc.radius - reach),
    Infinity,
  );
}

// The first candidate whose cluster clears every disc; when none does, the one that clears them best.
function firstClear(candidates: readonly Vec2[], reach: number, avoid: readonly Disc[]): Vec2 {
  let best = candidates[0] ?? { x: 0, y: 0 };
  let bestClearance = -Infinity;
  for (const candidate of candidates) {
    const room = clearance(candidate, reach, avoid);
    if (room >= 0) {
      return candidate;
    }
    if (room > bestClearance) {
      best = candidate;
      bestClearance = room;
    }
  }
  return best;
}

// Two clusters per giant, a fifteenth of a turn either side of its axis, slid along the arc off any disc to avoid.
export function giantClusters(
  giants: readonly GiantLayout[],
  center: Vec2,
  avoid: readonly Disc[],
  spread: number,
): Vec2[] {
  const reach = clusterReach(spread);
  const nudges = Array.from({ length: MAX_NUDGES * 2 + 1 }, (_, index) =>
    index === 0 ? 0 : (index % 2 === 1 ? 1 : -1) * Math.ceil(index / 2),
  );
  return giants.flatMap((giant) =>
    [-1, 1].map((side) => {
      const around = nudges.map((nudge) => {
        const angle = giant.angle + side * CLUSTER_ARC + nudge * NUDGE;
        return {
          x: center.x + Math.cos(angle) * CLUSTER_RADIUS,
          y: center.y + Math.sin(angle) * CLUSTER_RADIUS,
        };
      });
      return firstClear(around, reach, avoid);
    }),
  );
}

// A corner cluster keeps its spot unless a disc covers it: then the nearest clear spot on a grid around it.
export function clearSpot(at: Vec2, spread: number, avoid: readonly Disc[]): Vec2 {
  const around: Vec2[] = [];
  for (let dy = -GRID_RINGS; dy <= GRID_RINGS; dy += 1) {
    for (let dx = -GRID_RINGS; dx <= GRID_RINGS; dx += 1) {
      around.push({ x: at.x + dx * GRID, y: at.y + dy * GRID });
    }
  }
  around.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
  return firstClear(around, clusterReach(spread), avoid);
}
