import type { SkillEffect, TrapEffect, UpgradeFamily, WeaponEffect } from '../data/types';

export const BOLT = '<path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2z" fill="currentColor"/>';

export const FOG =
  '<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.47 1.2A3.9 3.9 0 0 1 17.1 18.5z" fill="currentColor"/>' +
  '<path d="M4 21.5h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

export const SUN =
  '<circle cx="12" cy="12" r="4.5" fill="currentColor"/>' +
  '<g stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
  '<path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g>';

export const MOON =
  '<path d="M19.5 14.6A8.2 8.2 0 0 1 9.4 4.5a8.2 8.2 0 1 0 10.1 10.1z" fill="currentColor"/>';

export const SPEECH =
  '<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
  '<path d="M7.5 8.5h9M7.5 12.5h5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

export const EYE =
  '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
  '<circle cx="12" cy="12" r="3" fill="currentColor"/>';

export const SENT =
  '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';

export function trapIcon(effect: TrapEffect): string {
  switch (effect.kind) {
    case 'shockwave':
      return (
        '<rect x="4" y="3" width="16" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>' +
        '<circle cx="12" cy="14" r="4" fill="none" stroke="currentColor" stroke-width="2"/>' +
        '<circle cx="12" cy="14" r="1.3" fill="currentColor"/><circle cx="12" cy="7" r="1.5" fill="currentColor"/>'
      );
    case 'beam':
      return (
        '<path d="M3 17.5 15 5.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="m14 4 6 6-3 3-6-6z" fill="currentColor"/>' +
        '<path d="M5 21h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
      );
    case 'mist':
      return (
        '<circle cx="8" cy="9" r="3" fill="currentColor"/><circle cx="15.5" cy="8" r="2.4" fill="currentColor"/>' +
        '<circle cx="12" cy="15" r="3.4" fill="currentColor"/><circle cx="18" cy="15.5" r="1.8" fill="currentColor"/>'
      );
    case 'lure':
      return (
        '<path d="M12 3 21 19H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M12 3v16M7.5 11 16.5 19M16.5 11 7.5 19" stroke="currentColor" stroke-width="1.2"/>'
      );
    case 'strobe':
      return '<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="currentColor"/>';
  }
}

export function skillIcon(effect: SkillEffect): string {
  switch (effect.kind) {
    case 'nova':
      return (
        '<circle cx="12" cy="12" r="3.5" fill="currentColor"/>' +
        '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.4"/>'
      );
    case 'laserShow':
      return (
        '<path d="M12 21 4 4M12 21l8-17M12 21V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="12" cy="21" r="1.6" fill="currentColor"/>'
      );
    case 'dash':
      return '<path d="M4 7h9M2 12h12M4 17h9M14 5l7 7-7 7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>';
    case 'barrier':
      return '<path d="M12 2.5 20 6v6c0 4.6-3.4 8.2-8 9.5-4.6-1.3-8-4.9-8-9.5V6z" fill="none" stroke="currentColor" stroke-width="2"/>';
    case 'healPulse':
      return '<path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" fill="currentColor"/>';
  }
}

export function familyIcon(family: UpgradeFamily): string {
  switch (family) {
    case 'class':
      return '<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" fill="currentColor"/>';
    case 'generic':
      return '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3"/>';
    case 'defense':
      return '<path d="M12 2.5 20 6v6c0 4.6-3.4 8.2-8 9.5-4.6-1.3-8-4.9-8-9.5V6z" fill="currentColor"/>';
    case 'relic':
      return '<path d="M12 2 4 9l8 13 8-13z" fill="currentColor"/>';
  }
}

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"';

export function weaponIcon(effect: WeaponEffect): string {
  switch (effect.kind) {
    case 'sweep':
      return (
        `<path d="M4 20 15 9" ${STROKE} stroke-width="2.6"/>` +
        `<path d="M13 3.5a9 9 0 0 1 7.5 7.5" ${STROKE}/>` +
        '<circle cx="16.5" cy="7.5" r="2" fill="currentColor"/>'
      );
    case 'spark':
      return (
        `<path d="M3 20 14 9" ${STROKE} stroke-width="2.6"/>` +
        '<circle cx="17" cy="6" r="3" fill="currentColor"/>' +
        `<path d="M20.5 11.5 22 13M12 2.5 11 1" ${STROKE} stroke-width="1.6"/>`
      );
    case 'hoop':
      return (
        `<circle cx="12" cy="12" r="9" ${STROKE}/>` + `<circle cx="12" cy="12" r="4.5" ${STROKE}/>`
      );
    case 'lob':
      return (
        `<path d="M3 19c3-12 15-12 18 0" ${STROKE} stroke-dasharray="1 3.4"/>` +
        '<circle cx="12" cy="8.5" r="3.4" fill="currentColor"/>'
      );
    case 'boomerang':
      return `<path d="M5 5c6 0 12 4.5 14 14-4-5-8-6.5-14-5.5z" ${STROKE} stroke-linejoin="round"/>`;
    case 'plate':
      return (
        `<ellipse cx="12" cy="7.5" rx="8.5" ry="3" ${STROKE}/>` +
        `<path d="M12 10.5V21M8 21h8" ${STROKE}/>`
      );
    case 'totem':
      return (
        `<rect x="7" y="3" width="10" height="5" rx="1.4" ${STROKE}/>` +
        `<rect x="7" y="9.5" width="10" height="5" rx="1.4" ${STROKE}/>` +
        `<rect x="7" y="16" width="10" height="5" rx="1.4" ${STROKE}/>`
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
        '<circle cx="18.5" cy="12" r="3.2" fill="currentColor"/>' +
        `<path d="M3 12h9" ${STROKE} stroke-dasharray="1 3.2"/>` +
        `<circle cx="15" cy="12" r="6.5" ${STROKE} stroke-width="1.4" opacity="0.6"/>`
      );
    case 'ribbon':
      return `<path d="M2.5 15c3-8 6-8 9.5 0s6.5 8 9.5 0" ${STROKE} stroke-width="2.6"/>`;
  }
}

// One shape per class, so that the colour never carries the class alone (see the art direction).
export function classMark(classId: string): string {
  switch (classId) {
    case 'mage':
      return (
        '<circle cx="12" cy="12" r="2.6" fill="currentColor"/>' +
        `<circle cx="12" cy="12" r="7.5" ${STROKE} stroke-width="1.5" stroke-dasharray="2 3"/>` +
        '<circle cx="19.5" cy="12" r="2.4" fill="currentColor"/><circle cx="4.5" cy="12" r="2.4" fill="currentColor"/>'
      );
    case 'tank':
      return (
        `<rect x="3.5" y="6.5" width="17" height="11" rx="2" ${STROKE}/>` +
        `<path d="M3.5 10.5h17M9 6.5v-2h6v2" ${STROKE}/>`
      );
    case 'healer':
      return (
        `<circle cx="12" cy="12" r="8.5" ${STROKE}/>` +
        '<path d="M12 3.5v17M4.6 7.8l14.8 8.4M19.4 7.8 4.6 16.2" stroke="currentColor" stroke-width="1.6"/>'
      );
    default:
      return '<circle cx="12" cy="12" r="7" fill="currentColor"/>';
  }
}

export const TWO_VERSIONS =
  `<circle cx="9.5" cy="12" r="6" ${STROKE}/>` +
  `<circle cx="14.5" cy="12" r="6" ${STROKE} stroke-dasharray="3 2.5"/>`;

export const DOOR =
  `<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3H17v18" ${STROKE}/>` +
  '<path d="M3 21h18M13.5 12v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';

export const BROKEN_LINK =
  `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" ${STROKE}/>` +
  '<path d="M9 3.5 10 6M3.5 9 6 10M15 21l-1-2.5M21 15l-2.5-1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
