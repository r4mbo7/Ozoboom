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

// A small picture of a stage, drawn by the interface for the picker and the lobby.
export function stagePreview(decor: DecorId): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 160 90');
  svg.setAttribute('class', 'ui-stage__preview');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = decor === 'dome' ? DOME : LAKE;
  return svg;
}
