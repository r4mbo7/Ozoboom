import type { WeaponEffect } from './types';

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"';
const ROUND = `${STROKE} stroke-linejoin="round"`;

// The picto of a weapon, an SVG in a box of 24: the interface shows it, and so does the bubble of
// the speaker that opens it.
export function weaponGlyph(effect: WeaponEffect): string {
  switch (effect.kind) {
    case 'sweep':
      return (
        `<path d="M4 20 15 9" ${STROKE}/>` +
        `<path d="M13 3.5a9 9 0 0 1 7.5 7.5" ${STROKE}/>` +
        '<circle cx="16.5" cy="7.5" r="2" fill="currentColor"/>'
      );
    case 'spark':
      return (
        `<path d="M3.5 20.5 11.5 12.5" ${STROKE}/>` +
        '<path d="M16 2.5q1 4.5 5.5 5.5-4.5 1-5.5 5.5-1-4.5-5.5-5.5 4.5-1 5.5-5.5z" fill="currentColor"/>' +
        '<path d="M21 14q.36 1.64 2 2-1.64.36-2 2-.36-1.64-2-2 1.64-.36 2-2zM8 1.5q.36 1.64 2 2-1.64.36-2 2-.36-1.64-2-2 1.64-.36 2-2z" fill="currentColor"/>'
      );
    case 'hoop':
      return (
        `<circle cx="12" cy="12" r="9" ${STROKE}/>` + `<circle cx="12" cy="12" r="4.5" ${STROKE}/>`
      );
    case 'lob':
      return (
        '<path d="M5 3.5C7.6 5 9.4 7.8 10.3 11h3.4C14.6 7.8 16.4 5 19 3.5zM5 20.5C7.6 19 9.4 16.2 10.3 13h3.4c.9 3.2 2.7 6 5.3 7.5zM10.3 11h3.4v2h-3.4z" fill="currentColor" transform="rotate(-25 12 12)"/>' +
        `<path d="M1.5 22c.8-3 2.2-5 4-6.5" ${STROKE} stroke-dasharray="1 3"/>`
      );
    case 'boomerang':
      return (
        `<ellipse cx="13" cy="10" rx="8.5" ry="3.4" ${STROKE}/>` +
        `<path d="M4.5 10v1.4c0 1.9 3.8 3.4 8.5 3.4s8.5-1.5 8.5-3.4V10" ${STROKE}/>` +
        `<ellipse cx="13" cy="10" rx="4" ry="1.4" ${STROKE} opacity="0.7"/>` +
        `<path d="M1.5 17.5h5M3.5 20.5h6" ${STROKE}/>`
      );
    case 'plate':
      return (
        `<ellipse cx="12" cy="5" rx="7" ry="2.4" ${STROKE}/>` +
        `<path d="M12 7.4V17M3.5 3a8 3 0 0 1 3-1.2M20.5 7a8 3 0 0 1-3 1.2" ${STROKE}/>` +
        `<ellipse cx="12" cy="19" rx="9.5" ry="3" ${STROKE} stroke-dasharray="1 3"/>`
      );
    case 'totem':
      return (
        `<circle cx="12" cy="9" r="3.8" ${STROKE}/>` +
        `<path d="M12 12.8v7M12 3.6V2M15.8 5.2 17 4M17.4 9H19M15.8 12.8 17 14M8.2 12.8 7 14M6.6 9H5M8.2 5.2 7 4" ${ROUND}/>` +
        `<ellipse cx="12" cy="20.5" rx="5.5" ry="2" ${STROKE}/>` +
        '<circle cx="12" cy="8.2" r="1.1" fill="currentColor"/>'
      );
    case 'orbit':
      return (
        `<circle cx="12" cy="12" r="8.5" ${STROKE} stroke-dasharray="2 3.4"/>` +
        '<circle cx="12" cy="12" r="2.5" fill="currentColor"/>' +
        '<circle cx="12" cy="3.5" r="2" fill="currentColor"/><circle cx="19.4" cy="16.3" r="2" fill="currentColor"/>' +
        '<circle cx="4.6" cy="16.3" r="2" fill="currentColor"/>'
      );
    case 'trail':
      return (
        `<circle cx="16" cy="16" r="5" ${STROKE}/>` +
        '<circle cx="16" cy="16" r="1.3" fill="currentColor"/>' +
        `<path d="M16 16V5M12.5 4h7M1.5 21c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0" ${ROUND}/>` +
        '<path d="M6 14.3s-2.6-1.5-2.6-3.4a1.5 1.5 0 0 1 2.6-.35 1.5 1.5 0 0 1 2.6.35c0 1.9-2.6 3.4-2.6 3.4z" fill="currentColor"/>'
      );
    case 'ribbon':
      return `<path d="M2.5 15c3-8 6-8 9.5 0s6.5 8 9.5 0" ${STROKE}/>`;
  }
}
