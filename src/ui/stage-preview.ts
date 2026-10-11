import type { DecorId } from '../data/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

// The main stage: a geodesic dome by the lake, at night.
const LAKE = `
  <rect width="160" height="90" fill="#060a1c"/>
  <circle cx="132" cy="18" r="6" fill="#ffe9b0" opacity="0.85"/>
  <g fill="#3fd0c9" opacity="0.55"><circle cx="20" cy="14" r="1"/><circle cx="52" cy="26" r="1"/><circle cx="104" cy="12" r="1"/><circle cx="146" cy="40" r="1"/></g>
  <rect y="64" width="160" height="26" fill="#0d2a48"/>
  <path d="M52 70 h56 M58 75 h44" stroke="#ffd27a" stroke-width="1.4" stroke-linecap="round" opacity="0.28"/>
  <path d="M46 64 a34 34 0 0 1 68 0 z" fill="#ffd27a" fill-opacity="0.14" stroke="#d9a441" stroke-width="2" stroke-linejoin="round"/>
  <path d="M46 64 L63 48 L80 64 L97 48 L114 64 M63 48 L80 33 L97 48 M80 33 V64" fill="none" stroke="#ffd27a" stroke-width="1.2" stroke-linejoin="round"/>
  <circle cx="80" cy="64" r="3.5" fill="#ffd27a"/>`;

const SAND = '#211b2e';
const FLOOR = '#322840';
const RIDGE = '#463a5a';
const WOOD = '#8a6038';
const GARLAND = '#ffd27a';
const GIANT_COLORS = ['#ff6fa8', '#3fd0c9', '#d9a441', '#7cf2b0'];
const RIBS = 24;

const GIANT_CAP = 'M462 -64 C510 -66 545 -36 545 0 C545 36 510 66 462 64 C454 30 454 -30 462 -64 Z';
const GIANT_GILLS = 'M470 -46 C504 -46 527 -26 527 0 C527 26 504 46 470 46';
const GIANT_TORSO =
  'M420 -10 C412 -12 410 -30 398 -32 C372 -36 352 -24 332 -18 L332 18 C352 24 372 36 398 32 C410 30 412 12 420 10 Z';
const GIANT_ARMS = 'M398 -32 C432 -120 392 -238 297 -297 M398 32 C432 120 392 238 297 297';
const GIANT_ROOTS = 'M332 -14 C318 -26 310 -40 294 -50 M332 0 H292 M332 14 C318 26 310 40 294 50';

// A giant faces away from the stage along its diagonal; its hands meet its neighbours' above an entrance.
function giant(color: string, degrees: number): string {
  return `<g transform="rotate(${String(degrees)})" fill="${color}" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
    <g fill="none" stroke-width="34" opacity="0.16"><path d="${GIANT_ARMS}"/><path d="${GIANT_CAP}"/></g>
    <path d="${GIANT_ARMS}" fill="none" stroke-width="11"/>
    <path d="${GIANT_ROOTS}" fill="none" stroke-width="7"/>
    <path d="${GIANT_TORSO}" fill-opacity="0.22" stroke-width="9"/>
    <ellipse cx="438" rx="20" ry="18" fill-opacity="0.35" stroke-width="8"/>
    <path d="${GIANT_CAP}" fill-opacity="0.32" stroke-width="11"/>
    <path d="${GIANT_GILLS}" fill="none" stroke-width="6" opacity="0.75"/>
    <g stroke="none"><circle cx="514" cy="-28" r="9"/><circle cx="518" cy="22" r="8"/><circle cx="490" cy="-4" r="7"/><circle cx="297" cy="-297" r="15"/><circle cx="297" cy="297" r="15"/></g>
  </g>`;
}

function mushroom([x, y, size, tint]: readonly [number, number, number, number]): string {
  const color = GIANT_COLORS[tint] ?? GARLAND;
  return `<circle cx="${String(x)}" cy="${String(y)}" r="${String(size * 1.9)}" fill="${color}" opacity="0.18"/>
    <circle cx="${String(x)}" cy="${String(y)}" r="${String(size)}" fill="${color}"/>
    <circle cx="${String(x - size * 0.3)}" cy="${String(y - size * 0.3)}" r="${String(size * 0.3)}" fill="#fffaeb" opacity="0.85"/>`;
}

const MUSHROOMS: readonly (readonly [number, number, number, number])[] = [
  [-560, -170, 24, 0],
  [-520, -130, 16, 1],
  [-600, 210, 20, 2],
  [-555, 180, 15, 0],
  [560, -200, 22, 3],
  [600, -165, 15, 2],
  [545, 175, 24, 1],
  [590, 215, 16, 3],
  [-345, -60, 15, 1],
  [345, 60, 15, 0],
  [-60, 350, 14, 3],
  [60, -350, 14, 2],
  [-720, 0, 18, 3],
  [725, -20, 18, 0],
];

function polar(radius: number, angle: number): string {
  return `${(radius * Math.cos(angle)).toFixed(1)} ${(radius * Math.sin(angle)).toFixed(1)}`;
}

function rib(index: number): number {
  return (index * 2 * Math.PI) / RIBS;
}

const RIB_PATH = Array.from(
  { length: RIBS },
  (_, index) => `M${polar(60, rib(index))} L${polar(298, rib(index))}`,
).join(' ');

// A garland hangs from rib to rib, sagging towards the centre.
function garland(radius: number): string {
  const swags = Array.from(
    { length: RIBS },
    (_, index) => `Q${polar(radius - 34, rib(index + 0.5))} ${polar(radius, rib(index + 1))}`,
  ).join(' ');
  return `M${polar(radius, 0)} ${swags}`;
}

const DUNES = [360, 430, 500, 570, 640, 710, 780, 850, 920]
  .map((radius) => `<circle r="${String(radius)}"/>`)
  .join('');

const PETALS = Array.from(
  { length: 8 },
  (_, index) => `<ellipse cy="-18" rx="8" ry="18" transform="rotate(${String(index * 45)})"/>`,
).join('');

// The Dome at night, from above, in the mock-up's units: a see-through dome of ribs and garlands on the sand, and
// the four giants at its diagonals, their backs to it, holding hands above the four entrances.
const DOME = `
  <rect width="160" height="90" fill="${SAND}"/>
  <g transform="translate(80 45) scale(0.1)">
    <g fill="none" stroke="${RIDGE}" stroke-width="6" opacity="0.7">${DUNES}</g>
    <path d="M0 -460 V460 M-820 0 H820" stroke="${FLOOR}" stroke-width="64" opacity="0.8"/>
    ${MUSHROOMS.map(mushroom).join('')}
    ${GIANT_COLORS.map((color, index) => giant(color, -135 + index * 90)).join('')}
    <circle r="314" fill="none" stroke="#7cf2b0" stroke-width="6" stroke-dasharray="36 22 8 22" opacity="0.5"/>
    <circle r="298" fill="${FLOOR}"/>
    <path d="${RIB_PATH}" stroke="${WOOD}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
    <g fill="none" stroke="${GARLAND}" stroke-linecap="round">
      <path d="${garland(270)} ${garland(180)}" stroke-width="3" opacity="0.35"/>
      <path d="${garland(270)} ${garland(180)}" stroke-width="10" stroke-dasharray="0 21" opacity="0.9"/>
    </g>
    <circle r="298" fill="none" stroke="${WOOD}" stroke-width="7" opacity="0.85"/>
    <circle r="120" fill="${GARLAND}" opacity="0.12"/>
    <g fill="none" stroke="${GARLAND}" stroke-width="5">${PETALS}</g>
    <circle r="50" fill="none" stroke="#d9a441" stroke-width="10" stroke-dasharray="248 66" transform="rotate(-90)"/>
    <circle r="12" fill="${GARLAND}"/>
  </g>`;

const DAWN = {
  grass: '#cdb39e',
  grassHigh: '#dcc3ad',
  sand: '#e8d0b4',
  sandLight: '#f5e4cc',
  contour: '#b2937c',
  tree: '#6c7a58',
  treeLight: '#8c9a70',
  cushion: '#c43a40',
  canopy: '#e2a66a',
  rope: '#8a6a50',
  sun: '#ffd8a0',
  gold: '#a8781f',
  core: '#c98a12',
};

type Spot = readonly [number, number];

function xy([x, y]: Spot): string {
  return `${x.toFixed(1)} ${y.toFixed(1)}`;
}

// The arena's almonds, as in render/ambyss-layout: two circle arcs meeting at the east and west tips.
function almond(halfWidth: number, halfHeight: number) {
  const radius = (halfWidth * halfWidth + halfHeight * halfHeight) / (2 * halfHeight);
  const spread = Math.asin(halfWidth / radius);
  const arc = `A${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 1`;
  return {
    path: `M${String(-halfWidth)} 0 ${arc} ${String(halfWidth)} 0 ${arc} ${String(-halfWidth)} 0 Z`,
    edge(t: number, north: boolean): Spot {
      const swing = -spread + 2 * spread * t;
      const angle = north ? -Math.PI / 2 + swing : Math.PI / 2 - swing;
      const center = north ? radius - halfHeight : halfHeight - radius;
      return [radius * Math.cos(angle), center + radius * Math.sin(angle)];
    },
  };
}

const MASTS: readonly Spot[] = [
  [-213, 0],
  [213, 0],
];

// The hill rises in terraces towards the floor, each edged by a contour line.
function terraces(filled: boolean): string {
  return [8, 7, 6, 5, 4, 3, 2, 1, 0]
    .map((step) => {
      const fill = !filled || step > 5 ? 'none' : step > 2 ? DAWN.grassHigh : DAWN.sand;
      return `<ellipse cx="${String(step * 6)}" cy="${String(step * 5)}" rx="${String(480 + step * 72)}" ry="${String(306 + step * 65)}" fill="${fill}"/>`;
    })
    .join('');
}

const TREES: readonly (readonly [number, number, number])[] = [
  [-660, -400, 34],
  [-600, -432, 26],
  [-566, -378, 30],
  [-650, -346, 22],
  [604, -408, 32],
  [656, -366, 26],
  [584, -356, 22],
  [-624, 418, 30],
  [-562, 440, 26],
  [-596, 382, 22],
  [560, 402, 30],
  [622, 430, 34],
  [660, 376, 24],
  [596, 356, 22],
  [-10, -452, 26],
  [42, -436, 22],
  [-74, 448, 28],
  [-24, 436, 22],
];

function tree([x, y, size]: readonly [number, number, number]): string {
  const at = (dx: number, dy: number) => `cx="${String(x + dx)}" cy="${String(y + dy)}"`;
  return `<circle ${at(-16, 3)} r="${String(size)}" fill="#000" opacity="0.2"/>
    <circle ${at(0, 0)} r="${String(size)}" fill="${DAWN.tree}" stroke="#000" stroke-opacity="0.25" stroke-width="2"/>
    <circle ${at(-size * 0.25, -size * 0.25)} r="${String(size * 0.42)}" fill="${DAWN.treeLight}" opacity="0.6"/>
    <circle ${at(size * 0.22, size * 0.18)} r="${String(size * 0.34)}" fill="${DAWN.treeLight}" opacity="0.5"/>`;
}

// Red cushions in curved rows facing the core, with an aisle along each axis.
const CUSHIONS = [0.44, 0.58, 0.72, 0.86]
  .flatMap((ring) => {
    const row = almond(400 * ring, 230 * ring);
    const count = Math.round((400 * ring) / 14);
    return [true, false].flatMap((north) =>
      Array.from({ length: count }, (_, index) => row.edge((index + 0.5) / count, north)),
    );
  })
  .filter(([x, y]) => Math.abs(x) > 24 && Math.abs(y) > 18)
  .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8"/>`)
  .join('');

const CANOPY_ALMOND = almond(440, 255);
const ANCHORS: readonly Spot[] = [
  [-440, 0] as const,
  [440, 0] as const,
  ...[true, false].flatMap((north) =>
    [1, 2, 3, 4, 5, 6].map((index) => CANOPY_ALMOND.edge(index / 7, north)),
  ),
].sort(([ax, ay], [bx, by]) => Math.atan2(ay, ax) - Math.atan2(by, bx));

// The canopy's edge sags between its anchors, towards the core.
const CANOPY = ANCHORS.map((anchor, index) => {
  const next = ANCHORS[(index + 1) % ANCHORS.length] ?? anchor;
  const sag: Spot = [((anchor[0] + next[0]) / 2) * 0.84, ((anchor[1] + next[1]) / 2) * 0.84];
  return `${index === 0 ? `M${xy(anchor)} ` : ''}Q${xy(sag)} ${xy(next)}`;
}).join(' ');

const SEAMS = ANCHORS.map(([x, y]) => {
  const [mx, my] = (x < 0 ? MASTS[0] : MASTS[1]) ?? [0, 0];
  return `M${xy([mx, my])} Q${xy([(mx + x) / 2, (my + y) / 2 + (y < 0 ? 14 : -14)])} ${xy([x, y])}`;
}).join(' ');

// Two guy ropes per anchor, splayed outwards to their pegs in the slope.
const GUYS = ANCHORS.flatMap((anchor) =>
  [-0.12, 0.12].map((splay) => {
    const angle = Math.atan2(anchor[1] * 1.6, anchor[0]) + splay;
    return {
      anchor,
      peg: [anchor[0] + 80 * Math.cos(angle), anchor[1] + 80 * Math.sin(angle)] as const,
      angle,
    };
  }),
);
const ROPES = GUYS.map(({ anchor, peg }) => `M${xy(anchor)} L${xy(peg)}`).join(' ');
const PEGS = GUYS.map(
  ({ peg, angle }) =>
    `<rect x="-7" y="-7" width="14" height="14" rx="3" transform="translate(${xy(peg)}) rotate(${((angle * 180) / Math.PI).toFixed(0)})"/>`,
).join('');

const RAYS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6;
  const reach = index % 2 === 0 ? 34 : 27;
  return `M${xy([18 * Math.cos(angle), 18 * Math.sin(angle)])} L${xy([reach * Math.cos(angle), reach * Math.sin(angle)])}`;
}).join(' ');

// Cosmic streaks fall from the north-east, brightening towards their head.
const STREAKS = (
  [
    [690, -440, 520, '#1f8a84'],
    [800, -250, 360, '#6b3fd0'],
    [480, -455, 290, '#b8246a'],
  ] as const
)
  .map(([x, y, length, color]) => {
    const along = (share: number): Spot => [
      x + share * length * Math.cos(Math.PI * 0.8),
      y + share * length * Math.sin(Math.PI * 0.8),
    ];
    const head = along(1);
    return `<g stroke="${color}" fill="${color}">
      <path d="M${xy([x, y])} L${xy(along(0.4))}" stroke-width="5" opacity="0.25"/>
      <path d="M${xy(along(0.4))} L${xy(along(0.75))}" stroke-width="6" opacity="0.5"/>
      <path d="M${xy(along(0.75))} L${xy(head)}" stroke-width="7" opacity="0.85"/>
      <circle cx="${head[0].toFixed(1)}" cy="${head[1].toFixed(1)}" r="7" stroke="none"/>
    </g>`;
  })
  .join('');

// Soft light without a filter or a gradient, whose ids would clash between previews: thin, faint, nested layers.
function glow(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  opacity: number,
): string {
  const layers = [1, 0.84, 0.68, 0.52, 0.36, 0.2]
    .map(
      (share) =>
        `<ellipse cx="${String(cx)}" cy="${String(cy)}" rx="${String(rx * share)}" ry="${String(ry * share)}"/>`,
    )
    .join('');
  return `<g fill="${color}" fill-opacity="${String(opacity)}">${layers}</g>`;
}

// Ambyss at dawn, from above, in the arena's units: the hill's terraces lit from the east, the almond floor and its
// rows of red cushions, the see-through canopy on its two masts and guy ropes, the sun core and cosmic streaks.
const AMBYSS = `
  <rect width="160" height="90" fill="${DAWN.grass}"/>
  <g transform="translate(80 45) scale(0.1)">
    ${terraces(true)}
    ${glow(760, -30, 520, 680, DAWN.sun, 0.09)}
    <g stroke="${DAWN.contour}" stroke-width="6" opacity="0.8">${terraces(false)}</g>
    <path d="M-400 0 C-540 12 -560 58 -830 84 M400 0 C540 -12 556 -46 830 -60" fill="none" stroke="${DAWN.sandLight}" stroke-width="28" stroke-linecap="round" opacity="0.6"/>
    ${TREES.map(tree).join('')}
    <path d="${almond(400, 230).path}" fill="${DAWN.sandLight}" stroke="${DAWN.sand}" stroke-width="14"/>
    <g fill="${DAWN.cushion}" stroke="#000" stroke-opacity="0.3" stroke-width="1.5">${CUSHIONS}</g>
    <path d="${ROPES}" stroke="${DAWN.rope}" stroke-width="4" opacity="0.85"/>
    <g fill="${DAWN.rope}" stroke="#000" stroke-opacity="0.35" stroke-width="2">${PEGS}</g>
    <path d="${CANOPY}" fill="${DAWN.rope}" opacity="0.12" transform="translate(12 14)"/>
    <path d="${CANOPY}" fill="${DAWN.canopy}" fill-opacity="0.3"/>
    <g fill="none" stroke="${DAWN.rope}" stroke-width="3.5" opacity="0.55"><path d="${SEAMS}"/><path d="M-213 0 H213"/></g>
    <path d="${CANOPY}" fill="none" stroke="${DAWN.rope}" stroke-width="6" opacity="0.9"/>
    ${MASTS.map(([x]) => `<circle cx="${String(x)}" r="16" fill="${DAWN.rope}" stroke="#000" stroke-opacity="0.4" stroke-width="3"/><circle cx="${String(x)}" r="6" fill="${DAWN.core}"/>`).join('')}
    ${glow(0, 0, 130, 130, DAWN.core, 0.05)}
    <circle r="50" fill="none" stroke="${DAWN.gold}" stroke-width="8" stroke-dasharray="248 66" transform="rotate(-90)"/>
    <circle r="40" fill="none" stroke="${DAWN.gold}" stroke-width="2.5"/>
    <path d="${RAYS}" stroke="${DAWN.core}" stroke-width="4.5" stroke-linecap="round"/>
    <circle r="12" fill="${DAWN.core}"/>
    <g fill="none" stroke-linecap="round">${STREAKS}</g>
  </g>`;

const PREVIEWS: Readonly<Record<DecorId, string>> = { lake: LAKE, dome: DOME, ambyss: AMBYSS };

// A small picture of a stage, drawn by the interface for the picker and the lobby.
export function stagePreview(decor: DecorId): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 160 90');
  svg.setAttribute('class', 'ui-stage__preview');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = PREVIEWS[decor];
  return svg;
}
