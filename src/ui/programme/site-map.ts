import { nextFloat, seedRng } from '../../shared/prng';

// The festival site printed on the Map tab (.lavish/programme, map A): the Main stage and Ambyss on
// the shore of the pink lake in the west, the Dome and Pumpui away from it in the east. Garland lanes
// join the Main stage, the Dome and Pumpui; Ambyss's only path is the lake trail along the west shore
// to the Main stage.

export type Point = readonly [number, number];

// The map's own units: its paper, and the radius of a stage's medallion.
const SITE = { width: 256, height: 284, stop: 18 } as const;
// The frame printed around the paper.
const MARGIN = 4;

// Where each stage lies, in the Map tab's order: the Main stage, the Dome, Ambyss, Pumpui.
export const SITE_STOPS: readonly Point[] = [
  [80, 66],
  [186, 214],
  [64, 226],
  [204, 112],
];

interface SitePath {
  readonly from: number;
  readonly to: number;
  // As the walks between two stages: the lake trail to and from Ambyss, the garland lane elsewhere.
  readonly look: 'lane' | 'trail';
  // From the edge of its first stop to the edge of its last.
  readonly curve: readonly [Point, Point, Point, Point];
}

export const SITE_PATHS: readonly SitePath[] = [
  {
    from: 0,
    to: 3,
    look: 'lane',
    curve: [
      [88.5, 50.1],
      [102, 25],
      [204, 30],
      [204, 94],
    ],
  },
  {
    from: 3,
    to: 1,
    look: 'lane',
    curve: [
      [222, 112],
      [252, 124],
      [246, 210],
      [204, 214],
    ],
  },
  {
    from: 0,
    to: 2,
    look: 'trail',
    curve: [
      [62.1, 64.1],
      [-10.9, 146.5],
      [9.6, 209],
      [57, 209.4],
    ],
  },
  {
    from: 0,
    to: 1,
    look: 'lane',
    curve: [
      [97.9, 67.6],
      [140, 72],
      [152, 140],
      [186, 196],
    ],
  },
];

const SAMPLES = 48;

function cubic(curve: SitePath['curve'], s: number): Point {
  const u = 1 - s;
  const at = (k: 0 | 1) =>
    u * u * u * curve[0][k] +
    3 * u * u * s * curve[1][k] +
    3 * u * s * s * curve[2][k] +
    s * s * s * curve[3][k];
  return [at(0), at(1)];
}

const curveLine = (path: SitePath): Point[] =>
  Array.from({ length: SAMPLES + 1 }, (_, k) => cubic(path.curve, k / SAMPLES));

function stopAt(index: number): Point {
  const stop = SITE_STOPS[index];
  if (stop === undefined) {
    throw new Error(`The site map has no stage ${String(index)}`);
  }
  return stop;
}

export function lengthOf(line: readonly Point[]): number {
  let length = 0;
  for (let k = 1; k < line.length; k++) {
    const [x0, y0] = line[k - 1] ?? [0, 0];
    const [x1, y1] = line[k] ?? [0, 0];
    length += Math.hypot(x1 - x0, y1 - y0);
  }
  return length;
}

// A path from the centre of its first stage to the centre of its last, as the pin walks it.
const WALKS = SITE_PATHS.map((path) => [stopAt(path.from), ...curveLine(path), stopAt(path.to)]);

// The shortest way along the paths from a stage to another.
export function route(from: number, to: number): Point[] {
  const ways = new Map<number, Point[]>([[from, [stopAt(from)]]]);
  let changed = true;
  while (changed) {
    changed = false;
    SITE_PATHS.forEach((path, index) => {
      const walk = WALKS[index] ?? [];
      for (const [start, end, line] of [
        [path.from, path.to, walk],
        [path.to, path.from, [...walk].reverse()],
      ] as const) {
        const way = ways.get(start);
        if (way === undefined) {
          continue;
        }
        const longer = [...way, ...line.slice(1)];
        const known = ways.get(end);
        if (known === undefined || lengthOf(longer) < lengthOf(known) - 1e-6) {
          ways.set(end, longer);
          changed = true;
        }
      }
    });
  }
  return ways.get(to) ?? [stopAt(to)];
}

// The point a share of the way along a line.
export function pointAlong(line: readonly Point[], share: number): Point {
  const goal = lengthOf(line) * Math.min(1, Math.max(0, share));
  let walked = 0;
  for (let k = 1; k < line.length; k++) {
    const [x0, y0] = line[k - 1] ?? [0, 0];
    const [x1, y1] = line[k] ?? [0, 0];
    const step = Math.hypot(x1 - x0, y1 - y0);
    if (walked + step >= goal && step > 0) {
      const u = (goal - walked) / step;
      return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
    }
    walked += step;
  }
  return line[line.length - 1] ?? [0, 0];
}

const smooth = (k: number) => k * k * (3 - 2 * k);

// Where the pin's tip stands for a point of its walk: on a medallion's top near a stage, rising and
// falling as it leaves and reaches one.
export function pinTip([x, y]: Point): Point {
  const nearest = Math.min(...SITE_STOPS.map(([sx, sy]) => Math.hypot(x - sx, y - sy)));
  const near = smooth(Math.min(1, Math.max(0, 1 - (nearest - 2) / (SITE.stop + 6))));
  return [x, y - (SITE.stop - 3) * near];
}

// A point of the map as shares of the printed sheet, its frame included.
export function shareOf([x, y]: Point): Point {
  return [(x + MARGIN) / (SITE.width + 2 * MARGIN), (y + MARGIN) / (SITE.height + 2 * MARGIN)];
}

export const SITE_RATIO = (SITE.width + 2 * MARGIN) / (SITE.height + 2 * MARGIN);

// ---- The printed sheet: muted inks on the dark paper.

const n = (value: number) => value.toFixed(1);
const xy = ([x, y]: Point) => `${n(x)} ${n(y)}`;
const polyline = (line: readonly Point[]) => `M${line.map(xy).join('L')}`;

interface Mark {
  readonly at: Point;
  // The unit normal of the line there.
  readonly normal: Point;
}

// A mark every `step` along a line, from half a step in.
function every(line: readonly Point[], step: number): Mark[] {
  const marks: Mark[] = [];
  let carry = step / 2;
  for (let k = 1; k < line.length; k++) {
    const [x0, y0] = line[k - 1] ?? [0, 0];
    const [x1, y1] = line[k] ?? [0, 0];
    const length = Math.hypot(x1 - x0, y1 - y0);
    const normal: Point = [-(y1 - y0) / length, (x1 - x0) / length];
    while (carry <= length) {
      const u = carry / length;
      marks.push({ at: [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u], normal });
      carry += step;
    }
    carry -= length;
  }
  return marks;
}

function offset(line: readonly Point[], by: number): Point[] {
  return line.map(([x, y], k) => {
    const j = Math.min(k, line.length - 2);
    const [x0, y0] = line[j] ?? [0, 0];
    const [x1, y1] = line[j + 1] ?? [0, 0];
    const length = Math.hypot(x1 - x0, y1 - y0);
    return [x - ((y1 - y0) / length) * by, y + ((x1 - x0) / length) * by];
  });
}

// A closed blob through the midpoints of its outline.
function blob(outline: readonly Point[]): string {
  const at = (k: number) => outline[k % outline.length] ?? [0, 0];
  const middle = (k: number): Point => [
    (at(k)[0] + at(k + 1)[0]) / 2,
    (at(k)[1] + at(k + 1)[1]) / 2,
  ];
  let d = `M${xy(middle(0))}`;
  for (let k = 1; k <= outline.length; k++) {
    d += `Q${xy(at(k))} ${xy(middle(k))}`;
  }
  return `${d}Z`;
}

function ring(
  count: number,
  center: Point,
  radius: Point,
  wobble: (angle: number) => number,
): Point[] {
  return Array.from({ length: count }, (_, k) => {
    const angle = (k / count) * 2 * Math.PI;
    const w = wobble(angle);
    return [
      center[0] + radius[0] * w * Math.cos(angle),
      center[1] + radius[1] * w * Math.sin(angle),
    ];
  });
}

const LAKE_CENTER: Point = [76, 156];
// The lake's shore.
export const SITE_LAKE = ring(
  48,
  LAKE_CENTER,
  [48, 44],
  (a) => 1 + 0.07 * Math.sin(3 * a + 1.2) + 0.04 * Math.sin(5 * a + 0.4),
);
// Pumpui's beach, the dots of its sand a little inside its edge.
const SAND_CENTER: Point = [218, 116];
const SAND_RADII: Point = [36, 54];
const SAND = ring(48, SAND_CENTER, SAND_RADII, (a) => 1 + 0.05 * Math.sin(3 * a));

const TREES: readonly (readonly [number, number, number])[] = [
  [6, 8, 13],
  [26, 4, 11],
  [46, 10, 9],
  [4, 30, 11],
  [20, 24, 7],
  [6, 56, 10],
  [2, 80, 8],
  [4, 104, 7],
  [6, 280, 13],
  [26, 284, 10],
  [4, 256, 10],
  [46, 286, 8],
  [16, 236, 6],
  [108, 272, 9],
  [124, 283, 7],
  [92, 286, 6],
  [218, 270, 6],
  [246, 282, 9],
  [232, 288, 7],
  [130, 8, 6],
  [146, 4, 5],
];

const PENNANTS = ['#b75d5a', '#5f72b4', '#c7a052'];

function scattered(seed: number, count: number, inside: (point: Point) => Point): Point[] {
  const rng = seedRng(seed);
  return Array.from({ length: count }, () => inside([nextFloat(rng), nextFloat(rng)]));
}

function meadow(): string {
  const grass = scattered(31, 60, ([u, v]) => [u * SITE.width, v * SITE.height])
    .map(([x, y]) => `M${n(x - 1.4)} ${n(y - 2)}L${xy([x, y])}L${n(x + 1.4)} ${n(y - 2)}`)
    .join('');
  return (
    `<rect width="${String(SITE.width)}" height="${String(SITE.height)}" fill="#3f6a4f" opacity="0.55"/>` +
    `<path d="${grass}" fill="none" stroke="rgb(120 170 130 / 0.2)" stroke-width="0.7"/>`
  );
}

function sand(): string {
  const dots = scattered(7, 140, ([u, v]): Point => [
    SAND_CENTER[0] + (u * 2 - 1) * SAND_RADII[0],
    SAND_CENTER[1] + (v * 2 - 1) * SAND_RADII[1],
  ]).filter(
    ([x, y]) =>
      ((x - SAND_CENTER[0]) / SAND_RADII[0]) ** 2 + ((y - SAND_CENTER[1]) / SAND_RADII[1]) ** 2 <
      0.8,
  );
  return (
    `<path d="${blob(SAND)}" fill="rgb(176 142 96 / 0.3)" stroke="rgb(217 164 65 / 0.35)" stroke-width="0.7"/>` +
    `<g fill="rgb(232 200 150 / 0.35)">${dots.map(([x, y]) => `<circle cx="${n(x)}" cy="${n(y)}" r="0.55"/>`).join('')}</g>`
  );
}

function lake(): string {
  const contour = SITE_LAKE.map(([x, y]): Point => [
    LAKE_CENTER[0] + (x - LAKE_CENTER[0]) * 0.8,
    LAKE_CENTER[1] + (y - LAKE_CENTER[1]) * 0.76,
  ]);
  const ripples = [0, 1, 2, 3]
    .map((k) => {
      const x = LAKE_CENTER[0] - 26 + k * 13;
      const y = LAKE_CENTER[1] - 12 + ((k * 7) % 4) * 6 + (k % 2) * 4;
      return `M${n(x)} ${n(y)}h8`;
    })
    .join('');
  return (
    `<defs><radialGradient id="ui-programme-lake" cx="0.45" cy="0.42" r="0.6">` +
    `<stop offset="0" stop-color="#b06a8c"/><stop offset="1" stop-color="#6e3a62"/></radialGradient></defs>` +
    `<path d="${blob(SITE_LAKE)}" fill="url(#ui-programme-lake)" stroke="rgb(232 192 106 / 0.7)" stroke-width="1"/>` +
    `<path d="${blob(contour)}" fill="none" stroke="rgb(246 200 222 / 0.22)" stroke-width="0.6"/>` +
    `<path d="${ripples}" stroke="#f6d4e4" stroke-width="0.7" opacity="0.4"/>`
  );
}

function trail(line: readonly Point[]): string {
  const dots = every(line, 4.5)
    .map(({ at: [x, y], normal: [nx, ny] }, k) => {
      const out = (((k * 37) % 7) / 7 - 0.5) * 3;
      return `<circle cx="${n(x + nx * out)}" cy="${n(y + ny * out)}" r="${n(0.6 + (k % 3) * 0.25)}"/>`;
    })
    .join('');
  return (
    `<path d="${polyline(line)}" fill="none" stroke="rgb(217 164 65 / 0.35)" stroke-width="6.6"/>` +
    `<path d="${polyline(line)}" fill="none" stroke="#5d4c43" stroke-width="5.4"/>` +
    `<g fill="rgb(214 190 150 / 0.55)">${dots}</g>`
  );
}

function lane(line: readonly Point[]): string {
  const planks = every(line, 3.2)
    .map(
      ({ at: [x, y], normal: [nx, ny] }) =>
        `M${n(x - nx * 3.4)} ${n(y - ny * 3.4)}L${n(x + nx * 3.4)} ${n(y + ny * 3.4)}`,
    )
    .join('');
  let sides = '';
  for (const side of [-1, 1]) {
    const by = 6.4 * side;
    sides += `<path d="${polyline(offset(line, by))}" fill="none" stroke="rgb(232 192 106 / 0.45)" stroke-width="0.5"/>`;
    sides += every(line, 7.5)
      .map(({ at: [x, y], normal: [nx, ny] }, k) => {
        const bx = x + nx * by;
        const by2 = y + ny * by;
        const color = PENNANTS[(k + (side > 0 ? 1 : 0)) % PENNANTS.length] ?? '';
        const corners: Point[] = [
          [bx + ny * 1.6, by2 - nx * 1.6],
          [bx - ny * 1.6, by2 + nx * 1.6],
          [bx - nx * side * 3, by2 - ny * side * 3],
        ];
        return `<path d="M${corners.map(xy).join('L')}Z" fill="${color}"/>`;
      })
      .join('');
  }
  return (
    `<path d="${polyline(line)}" fill="none" stroke="rgb(217 164 65 / 0.55)" stroke-width="9"/>` +
    `<path d="${polyline(line)}" fill="none" stroke="#4a3a33" stroke-width="7.4"/>` +
    `<path d="${planks}" stroke="#34282a" stroke-width="0.6"/>` +
    sides
  );
}

function forest(): string {
  return TREES.map(
    ([x, y, r]) =>
      `<circle cx="${String(x)}" cy="${String(y)}" r="${String(r)}" fill="#1d3a30" stroke="rgb(217 164 65 / 0.16)" stroke-width="0.6"/>` +
      `<circle cx="${n(x - r * 0.28)}" cy="${n(y - r * 0.3)}" r="${n(r * 0.5)}" fill="#284d3c"/>`,
  ).join('');
}

function compass([x, y]: Point): string {
  return (
    `<circle cx="${String(x)}" cy="${String(y)}" r="7" fill="none" stroke="rgb(217 164 65 / 0.5)" stroke-width="0.7"/>` +
    `<path d="M${String(x)} ${String(y - 10)}L${n(x + 2.6)} ${String(y)}L${String(x)} ${String(y + 10)}L${n(x - 2.6)} ${String(y)}Z" fill="none" stroke="rgb(232 192 106 / 0.7)" stroke-width="0.7"/>` +
    `<path d="M${String(x)} ${String(y - 10)}L${n(x + 2.6)} ${String(y)}L${n(x - 2.6)} ${String(y)}Z" fill="rgb(232 192 106 / 0.75)"/>` +
    `<text x="${String(x)}" y="${String(y - 13)}" text-anchor="middle" fill="rgb(232 192 106 / 0.8)" font-size="7" font-family="var(--font-title)">N</text>`
  );
}

// Everything but the stages, which the screen lays over it as buttons.
export function siteTerrain(): string {
  const { width, height } = SITE;
  const lines = SITE_PATHS.map(curveLine);
  const paths = (look: SitePath['look'], draw: (line: readonly Point[]) => string) =>
    SITE_PATHS.map((path, k) => (path.look === look ? draw(lines[k] ?? []) : '')).join('');
  return (
    `<defs><clipPath id="ui-programme-site"><rect width="${String(width)}" height="${String(height)}" rx="6"/></clipPath></defs>` +
    `<g clip-path="url(#ui-programme-site)">${meadow()}${sand()}${lake()}${paths('trail', trail)}${paths('lane', lane)}${forest()}${compass([232, 26])}</g>` +
    `<rect width="${String(width)}" height="${String(height)}" rx="6" fill="none" stroke="rgb(217 164 65 / 0.55)" stroke-width="0.9"/>` +
    `<rect x="-3" y="-3" width="${String(width + 6)}" height="${String(height + 6)}" rx="8" fill="none" stroke="rgb(217 164 65 / 0.2)" stroke-width="0.7"/>`
  );
}

export const SITE_VIEW_BOX = `${String(-MARGIN)} ${String(-MARGIN)} ${String(SITE.width + 2 * MARGIN)} ${String(SITE.height + 2 * MARGIN)}`;
