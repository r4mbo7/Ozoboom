import type { DecorId } from '../data/types';
import { FULL_PREVIEWS } from './full';

const SVG_NS = 'http://www.w3.org/2000/svg';

const LAKE = `
  <rect width="160" height="90" fill="#060a1c"/>
  <circle cx="132" cy="18" r="6" fill="#ffe9b0" opacity="0.85"/>
  <g fill="#3fd0c9" opacity="0.55"><circle cx="20" cy="14" r="1"/><circle cx="52" cy="26" r="1"/><circle cx="104" cy="12" r="1"/><circle cx="146" cy="40" r="1"/></g>
  <rect y="64" width="160" height="26" fill="#0d2a48"/>
  <path d="M52 70 h56 M58 75 h44" stroke="#ffd27a" stroke-width="1.4" stroke-linecap="round" opacity="0.28"/>
  <path d="M46 64 a34 34 0 0 1 68 0 z" fill="#ffd27a" fill-opacity="0.14" stroke="#d9a441" stroke-width="2" stroke-linejoin="round"/>
  <path d="M46 64 L63 48 L80 64 L97 48 L114 64 M63 48 L80 33 L97 48 M80 33 V64" fill="none" stroke="#ffd27a" stroke-width="1.2" stroke-linejoin="round"/>
  <circle cx="80" cy="64" r="3.5" fill="#ffd27a"/>`;

const PREVIEWS: Readonly<Record<DecorId, string>> = { lake: LAKE, ...FULL_PREVIEWS };

export function stagePreview(decor: DecorId): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 160 90');
  svg.setAttribute('class', 'ui-stage__preview');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const preview = PREVIEWS[decor];
  if (preview === undefined) {
    throw new Error(`No preview for the decor ${decor}`);
  }
  svg.innerHTML = preview;
  return svg;
}
