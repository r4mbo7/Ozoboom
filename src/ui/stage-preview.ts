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

const GIANTS = [
  [30, 24],
  [130, 24],
  [30, 66],
  [130, 66],
]
  .map(
    ([x, y]) =>
      `<g transform="translate(${String(x)} ${String(y)})"><ellipse cx="0" cy="-6" rx="10" ry="6" fill="#d96ab5"/><rect x="-3" y="-2" width="6" height="12" rx="3" fill="#3fd0c9"/></g>`,
  )
  .join('');

// The Dome: a round roof on the sand, seen from above, with four giants standing in a ring.
const DOME = `
  <rect width="160" height="90" fill="#e8c88c"/>
  <ellipse cx="80" cy="45" rx="64" ry="38" fill="#d9ad6a" opacity="0.55"/>
  ${GIANTS}
  <circle cx="80" cy="45" r="26" fill="#9a6b3c" stroke="#5c3b1c" stroke-width="2"/>
  <circle cx="80" cy="45" r="17" fill="#b8854c" stroke="#5c3b1c" stroke-width="1.2"/>
  <path d="M80 19 V71 M54 45 H106 M62 27 L98 63 M98 27 L62 63" stroke="#5c3b1c" stroke-width="1" opacity="0.7"/>
  <circle cx="80" cy="45" r="4" fill="#ffd27a"/>`;

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
