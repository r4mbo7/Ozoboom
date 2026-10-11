import { rotate, unitFromAngle } from '../shared/angle';
import { DEFAULT_BPM, TICKS_PER_BAR, tempoOf } from '../shared/tempo';
import type { ObstacleDefinition, SetDefinition } from './types';

const MAIN_STAGE: SetDefinition = {
  id: 'soiree-v0',
  name: "La soirée d'ouverture",
  style: 'Psytrance full-on',
  bpm: DEFAULT_BPM,
  trackIds: ['soiree-ouverture', 'brume-du-lac', 'grenouille-acide', 'goa-des-etoiles'],
  arena: { width: 1600, height: 1000 },
  core: { radius: 56, maxHp: 500 },
  handSize: 2,
  startingHand: ['caisson-de-basse'],
  loot: { everyBars: 12, lifetimeBars: 16, radius: 16, first: 'caisson-de-basse' },
  maxTraps: 6,
  levelCurve: { baseVibes: 5, vibesPerLevel: 4 },
  pickups: { lifetimeTicks: 8 * TICKS_PER_BAR, speed: 12 },
  weaponSlots: 3,
  reviveBars: 1,
  coreRepairPerBar: 85,
  perPlayer: { spawnMul: 0.8, enemyHpMul: 0.5 },
  sidedWaves: { everyBars: 8, chance: 0.4, randomShare: 0.2 },
  speakers: [
    {
      id: 'dome-chill',
      name: 'Le Dôme chill',
      description: 'Une brume qui soigne tout ce qui danse autour.',
      x: 800,
      y: 120,
      radius: 40,
      plugBars: 2,
      aura: { kind: 'mist', slowFactor: 1, healPerBar: 6, radius: 160 },
      unlocksWeaponId: 'assiettes-chinoises',
    },
    {
      id: 'foret',
      name: 'La Forêt',
      description: 'Frappes boisées et oiseaux : les bad vibes y ralentissent.',
      x: 1430,
      y: 500,
      radius: 40,
      plugBars: 2,
      aura: { kind: 'mist', slowFactor: 0.6, healPerBar: 0, radius: 160 },
      unlocksWeaponId: 'monocycle',
    },
    {
      id: 'sub',
      name: 'Le Sub',
      description: 'Une onde de choc sur chaque kick.',
      x: 420,
      y: 500,
      radius: 40,
      plugBars: 2,
      aura: { kind: 'shockwave', damage: 8, radius: 140, knockback: 30 },
      unlocksWeaponId: 'totem',
    },
    {
      id: 'cercle-acid',
      name: 'Le Cercle acid',
      description: 'Il marque les bad vibes qui viennent y danser.',
      x: 800,
      y: 880,
      radius: 40,
      plugBars: 2,
      aura: { kind: 'lure', radius: 150, markedDamageMul: 1.5 },
      unlocksWeaponId: 'baton-du-diable',
    },
  ],
  tiers: [
    {
      buildupPhrases: 4,
      breakBars: 4,
      bossId: 'couvre-feu',
      spawns: [
        { enemyId: 'random', everyBars: 4, count: 4, fromPhrase: 0 },
        { enemyId: 'desagreable', everyBars: 2, count: 2, fromPhrase: 0 },
        { enemyId: 'desagreable', everyBars: 2, count: 1, fromPhrase: 1 },
        { enemyId: 'meprisant', everyBars: 8, count: 1, fromPhrase: 1 },
        { enemyId: 'random', everyBars: 4, count: 2, fromPhrase: 2 },
        { enemyId: 'male-alpha', everyBars: 8, count: 1, fromPhrase: 2 },
        { enemyId: 'desagreable', everyBars: 1, count: 1, fromPhrase: 3 },
        { enemyId: 'collant', everyBars: 4, count: 1, fromPhrase: 3 },
      ],
      dropSpawns: [
        { enemyId: 'random', everyBars: 4, count: 7, fromPhrase: 0 },
        { enemyId: 'desagreable', everyBars: 1, count: 3, fromPhrase: 0 },
        { enemyId: 'meprisant', everyBars: 8, count: 1, fromPhrase: 0 },
        { enemyId: 'male-alpha', everyBars: 8, count: 1, fromPhrase: 0 },
        { enemyId: 'collant', everyBars: 4, count: 1, fromPhrase: 0 },
      ],
    },
    {
      buildupPhrases: 4,
      breakBars: 4,
      bossId: 'batterie-a-plat',
      spawns: [
        { enemyId: 'desagreable', everyBars: 1, count: 2, fromPhrase: 0 },
        { enemyId: 'random', everyBars: 2, count: 4, fromPhrase: 0 },
        { enemyId: 'intolerant', everyBars: 8, count: 1, fromPhrase: 0 },
        { enemyId: 'arnaqueur', everyBars: 4, count: 1, fromPhrase: 0 },
        { enemyId: 'meprisant', everyBars: 4, count: 1, fromPhrase: 1 },
        { enemyId: 'male-alpha', everyBars: 8, count: 1, fromPhrase: 1 },
        { enemyId: 'fatigue', everyBars: 8, count: 1, fromPhrase: 1 },
        { enemyId: 'random', everyBars: 2, count: 4, fromPhrase: 2 },
        { enemyId: 'filmeur', everyBars: 8, count: 1, fromPhrase: 2 },
        { enemyId: 'bavard', everyBars: 8, count: 1, fromPhrase: 2 },
        { enemyId: 'desagreable', everyBars: 1, count: 2, fromPhrase: 3 },
        { enemyId: 'male-alpha', everyBars: 4, count: 1, fromPhrase: 3 },
        { enemyId: 'zombie', everyBars: 8, count: 1, fromPhrase: 3 },
      ],
      dropSpawns: [
        { enemyId: 'desagreable', everyBars: 1, count: 5, fromPhrase: 0 },
        { enemyId: 'random', everyBars: 2, count: 9, fromPhrase: 0 },
        { enemyId: 'intolerant', everyBars: 8, count: 1, fromPhrase: 0 },
        { enemyId: 'meprisant', everyBars: 4, count: 1, fromPhrase: 0 },
        { enemyId: 'male-alpha', everyBars: 4, count: 2, fromPhrase: 0 },
        { enemyId: 'filmeur', everyBars: 8, count: 1, fromPhrase: 0 },
        { enemyId: 'zombie', everyBars: 8, count: 1, fromPhrase: 0 },
      ],
      bystanderSpawns: [
        { bystanderId: 'festivalier-en-detresse', everyBars: 4, count: 1, fromPhrase: 0 },
      ],
    },
  ],
};

const DOME_TICKS_PER_BEAT = 18;

interface Point {
  x: number;
  y: number;
}

interface CrownShape {
  center: Point;
  radius: number;
  posts: number;
  postRadius: number;
  openEvery: number;
}

interface ArmsShape {
  center: Point;
  giants: number;
  firstGiantRadians: number;
  curve: readonly [Point, Point, Point, Point];
  stoneRadius: number;
  gap: number;
  stonesPerSide: number;
}

// Posts on a circle, skipping every openEvery-th one: those gaps are the entrances.
function crownObstacles(shape: CrownShape): ObstacleDefinition[] {
  const obstacles: ObstacleDefinition[] = [];
  for (let i = 1; i < shape.posts; i++) {
    if (i % shape.openEvery === 0) {
      continue;
    }
    const unit = unitFromAngle((i * 2 * Math.PI) / shape.posts);
    obstacles.push({
      x: Math.round(shape.center.x + shape.radius * unit.x),
      y: Math.round(shape.center.y + shape.radius * unit.y),
      radius: shape.postRadius,
    });
  }
  return obstacles;
}

const ARM_SAMPLES = 400;

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
}

function bezierAt([p0, p1, p2, p3]: ArmsShape['curve'], t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

// Stones one chord apart along the curve, the first one on the giant's axis at the curve's start
// distance, then stonesPerSide on each side of the axis (the curve and its mirror image).
function armStones(shape: ArmsShape): Point[] {
  const chord = 2 * shape.stoneRadius + shape.gap;
  const curve = Array.from({ length: ARM_SAMPLES + 1 }, (_, i) =>
    bezierAt(shape.curve, i / ARM_SAMPLES),
  );
  const stones: Point[] = [];
  let last: Point = { x: shape.curve[0].x, y: 0 };
  let next = 1;
  while (stones.length < shape.stonesPerSide) {
    const from = curve[next - 1];
    const to = curve[next];
    if (from === undefined || to === undefined) {
      throw new Error('arm curve is too short for its stones');
    }
    const before = distance(from, last);
    const after = distance(to, last);
    if (after < chord) {
      next++;
      continue;
    }
    const along = (chord - before) / (after - before);
    last = { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along };
    stones.push(last);
  }
  return stones;
}

// Each giant holds one arm either side of its axis, listed mirrored side first.
function armsObstacles(shape: ArmsShape): ObstacleDefinition[] {
  const stones = armStones(shape);
  const axisStone = { x: shape.curve[0].x, y: 0 };
  const obstacles: ObstacleDefinition[] = [];
  for (let giant = 0; giant < shape.giants; giant++) {
    const radians = shape.firstGiantRadians + (giant * 2 * Math.PI) / shape.giants;
    const place = (point: Point): ObstacleDefinition => {
      const world = rotate(point, radians);
      return {
        x: Math.round(shape.center.x + world.x),
        y: Math.round(shape.center.y + world.y),
        radius: shape.stoneRadius,
      };
    };
    obstacles.push(place(axisStone));
    for (const side of [-1, 1]) {
      for (const stone of stones) {
        obstacles.push(place({ x: stone.x, y: side * stone.y }));
      }
    }
  }
  return obstacles;
}

// Option F of the Dome mock-up (1200 x 900), scaled by 10/9 around the core. Posts are 24 wide with
// 38 between two of them: the biggest player (18) fits, the heavy bad vibes (20) do not. The four
// axes stay open for a boss (48). Arm stones are 18 wide with the same 38 gaps and stop 70 short of
// each axis, under the joined hands.
const DOME_SCALE = 10 / 9;
const DOME_CENTER = { x: 800, y: 500 };

const DOME_OBSTACLES: readonly ObstacleDefinition[] = [
  ...crownObstacles({
    center: DOME_CENTER,
    radius: 330,
    posts: 24,
    postRadius: 24,
    openEvery: 6,
  }),
  ...armsObstacles({
    center: DOME_CENTER,
    giants: 4,
    firstGiantRadians: (-3 * Math.PI) / 4,
    curve: [
      { x: 398 * DOME_SCALE, y: -32 * DOME_SCALE },
      { x: 432 * DOME_SCALE, y: -120 * DOME_SCALE },
      { x: 392 * DOME_SCALE, y: -238 * DOME_SCALE },
      { x: 297 * DOME_SCALE, y: -297 * DOME_SCALE },
    ],
    stoneRadius: 18,
    gap: 38,
    stonesPerSide: 4,
  }),
];

const DOME_SPEAKER_SPOTS: Record<string, { x: number; y: number }> = {
  'dome-chill': { x: 800, y: 90 },
  foret: { x: 1210, y: 500 },
  sub: { x: 390, y: 500 },
  'cercle-acid': { x: 800, y: 910 },
};

const DOME: SetDefinition = {
  ...MAIN_STAGE,
  id: 'dome',
  trackIds: [
    'sous-la-coupole',
    'route-de-la-soie',
    'dub-des-champignons',
    'la-ceremonie',
    'mandala-de-feu',
  ],
  name: 'Le Dome',
  style: 'Downtempo, dub',
  bpm: tempoOf(DOME_TICKS_PER_BEAT).bpm,
  ticksPerBeat: DOME_TICKS_PER_BEAT,
  decor: 'dome',
  obstacles: DOME_OBSTACLES,
  acoustics: { reverbSeconds: 3.6, wet: 0.3 },
  speakers: (MAIN_STAGE.speakers ?? []).map((speaker) => ({
    ...speaker,
    ...DOME_SPEAKER_SPOTS[speaker.id],
  })),
};

export const SETS: readonly SetDefinition[] = [MAIN_STAGE, DOME];
