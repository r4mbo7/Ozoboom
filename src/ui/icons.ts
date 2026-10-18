import type { SkillEffect, TrapEffect, UpgradeFamily, WeaponEffect } from '../data/types';
import { FULL_MARKS, FULL_SKILL_ICONS } from './full';

export const BOLT = '<path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2z" fill="currentColor"/>';

export const PLUG =
  '<path d="M9 2.5v4.5M15 2.5v4.5M12 17v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M6 7h12v3.5a6 6 0 0 1-12 0z" fill="currentColor"/>';

export const PAUSE =
  '<rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/>';

export const PHONE =
  '<rect x="7" y="2.5" width="10" height="19" rx="2.2" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M10.5 18.5h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

export const HEART =
  '<path d="M12 20.5s-8.2-4.7-8.2-10.6A4.7 4.7 0 0 1 12 7a4.7 4.7 0 0 1 8.2 2.9c0 5.9-8.2 10.6-8.2 10.6z" fill="currentColor"/>';

// A pearl thrown forward: the dash, beside the Charge's lines and arrow.
export const DASH =
  '<circle cx="15.5" cy="12" r="5" fill="currentColor"/><path d="M2 8.5h6M1 12h8M2 15.5h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

export const FOG =
  '<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.47 1.2A3.9 3.9 0 0 1 17.1 18.5z" fill="currentColor"/>' +
  '<path d="M4 21.5h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

export const SUN =
  '<circle cx="12" cy="12" r="4.5" fill="currentColor"/>' +
  '<g stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
  '<path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g>';

export const INFINITY =
  '<path d="M6.5 8.5c-2.2 0-4 1.6-4 3.5s1.8 3.5 4 3.5c4 0 7-7 11-7 2.2 0 4 1.6 4 3.5s-1.8 3.5-4 3.5c-4 0-7-7-11-7z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>';

export const MOON =
  '<path d="M19.5 14.6A8.2 8.2 0 0 1 9.4 4.5a8.2 8.2 0 1 0 10.1 10.1z" fill="currentColor"/>';

export const SPEECH =
  '<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
  '<path d="M7.5 8.5h9M7.5 12.5h5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

export const LOCK =
  '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5" fill="currentColor"/>' +
  '<path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';

export const DISCORD =
  '<path fill="currentColor" d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.61 1.25a18.3 18.3 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.88 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.88-1.3 1.23-2a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.12l.37-.3a.07.07 0 0 1 .08-.01c3.93 1.8 8.18 1.8 12.06 0a.07.07 0 0 1 .08.01l.37.3a.08.08 0 0 1 0 .12c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.1c.36.7.77 1.37 1.22 2a.08.08 0 0 0 .09.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.17-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z"/>';

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
    case 'breeze':
      return (
        '<circle cx="9" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/>' +
        '<g fill="currentColor"><ellipse cx="9" cy="8.4" rx="1.7" ry="2.9" transform="rotate(25 9 12)"/>' +
        '<ellipse cx="9" cy="8.4" rx="1.7" ry="2.9" transform="rotate(145 9 12)"/>' +
        '<ellipse cx="9" cy="8.4" rx="1.7" ry="2.9" transform="rotate(265 9 12)"/>' +
        '<circle cx="19.5" cy="7.5" r="1.2"/><circle cx="21.5" cy="12" r="1.2"/><circle cx="19.5" cy="16.5" r="1.2"/></g>'
      );
  }
}

// Read by a plain string: in the demo, no skill is left for them.
const FULL_ICONS: Readonly<Record<string, string>> = FULL_SKILL_ICONS;

export function skillIcon(effect: SkillEffect): string {
  const kind: string = effect.kind;
  switch (kind) {
    case 'nova':
      return (
        '<circle cx="12" cy="12" r="3.5" fill="currentColor"/>' +
        '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.4"/>'
      );
    case 'dash':
      return '<path d="M4 7h9M2 12h12M4 17h9M14 5l7 7-7 7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>';
    case 'healPulse':
      return '<path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" fill="currentColor"/>';
    default: {
      const icon = FULL_ICONS[kind];
      if (icon === undefined) {
        throw new Error(`No icon for the skill "${kind}"`);
      }
      return icon;
    }
  }
}

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"';
const ROUND = `${STROKE} stroke-linejoin="round"`;

export function familyIcon(family: UpgradeFamily): string {
  switch (family) {
    case 'class':
      return '<path d="M12 1.5 13 9.6l3.6-2.2-2.2 3.6 8.1 1-8.1 1 2.2 3.6-3.6-2.2-1 8.1-1-8.1-3.6 2.2 2.2-3.6-8.1-1 8.1-1-2.2-3.6 3.6 2.2z" fill="currentColor"/>';
    case 'generic':
      return `<path d="m5 12.5 7-7 7 7M5 19.5l7-7 7 7" ${ROUND}/>`;
    case 'defense':
      return (
        `<path d="M12 2.5 20 6v6c0 4.6-3.4 8.2-8 9.5-4.6-1.3-8-4.9-8-9.5V6z" ${ROUND}/>` +
        '<path d="M12 6.5 16.5 8.5v3.6c0 2.6-1.9 4.6-4.5 5.4-2.6-.8-4.5-2.8-4.5-5.4V8.5z" fill="currentColor"/>'
      );
    case 'relic':
      return (
        `<circle cx="12" cy="12" r="9.5" ${STROKE}/>` +
        `<circle cx="12" cy="12" r="6.8" ${STROKE} opacity="0.6"/>` +
        '<circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="2.4"/>' +
        `<path d="M6.5 5.8a8 8 0 0 1 4-1.7" ${STROKE}/>`
      );
  }
}

// The few cards with a picto of their own; the others wear that of their family.
const UPGRADE_GLYPHS: Readonly<Record<string, string>> = {
  'baskets-legeres':
    `<path d="M2.5 18.5V12l4-1.3L9 6h4l2 5 3.6 1c1.7.5 2.9 1.9 2.9 3.6v2.9z" ${ROUND}/>` +
    `<path d="M2.5 15.5h19M10.2 9.4l2.3.8M11 7.4l2 .7" ${STROKE}/>`,
  'pas-chasse':
    '<ellipse cx="7" cy="12.5" rx="3.3" ry="4.8" transform="rotate(-15 7 12.5)" fill="currentColor"/>' +
    '<circle cx="8.8" cy="20.2" r="2.2" fill="currentColor"/>' +
    '<ellipse cx="16.5" cy="5.2" rx="3.3" ry="4.8" transform="rotate(-15 16.5 5.2)" fill="currentColor"/>' +
    '<circle cx="18.3" cy="12.9" r="2.2" fill="currentColor"/>',
};

export function upgradeIcon(id: string, family: UpgradeFamily): string {
  return UPGRADE_GLYPHS[id] ?? familyIcon(family);
}

// A card's pictogram in a medallion of sacred geometry, six circles in a flower: drawn in a box of 84.
export function medallion(glyph: string): string {
  const petals = Array.from({ length: 6 }, (_, petal) => {
    const angle = (petal * Math.PI) / 3;
    return `<circle cx="${(42 + 19 * Math.cos(angle)).toFixed(1)}" cy="${(42 + 19 * Math.sin(angle)).toFixed(1)}" r="19"/>`;
  }).join('');
  return (
    '<g fill="none" stroke="currentColor"><circle cx="42" cy="42" r="40" stroke-width="1.5"/>' +
    '<circle cx="42" cy="42" r="36" stroke-width="0.8" opacity="0.6"/>' +
    `<g stroke-width="0.8" opacity="0.32">${petals}</g></g>` +
    `<svg x="24" y="24" width="36" height="36" viewBox="0 0 24 24">${glyph}</svg>`
  );
}

export function weaponIcon(effect: WeaponEffect): string {
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
        '<path d="M4 7 10.6 10.8h2.8L20 7v10l-6.6-3.8h-2.8L4 17z" fill="currentColor" stroke="currentColor" stroke-linejoin="round" transform="rotate(-25 12 12)"/>' +
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
        `<path d="M8 2.5v19M3 20.5c3 2 7 2 10 0M15.5 15.5c2.5 1 4 2.5 4.5 4.5" ${ROUND}/>` +
        '<path d="M8 3 19 6.5 8 10z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"/>'
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

// One shape per class, so that the colour never carries the class alone (see the art direction).
export function classMark(classId: string): string {
  switch (classId) {
    case 'mage':
      return (
        '<circle cx="12" cy="12" r="2.6" fill="currentColor"/>' +
        `<circle cx="12" cy="12" r="7.5" ${STROKE} stroke-dasharray="2 3"/>` +
        '<circle cx="19.5" cy="12" r="2.4" fill="currentColor"/><circle cx="4.5" cy="12" r="2.4" fill="currentColor"/>'
      );
    case 'tank':
      return (
        `<path d="M6.5 9.5a5.5 5.5 0 0 1 11 0V19a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" ${STROKE}/>` +
        `<rect x="5" y="2.5" width="14" height="4" rx="2" ${STROKE}/>` +
        `<path d="M9.5 14.5h5" ${STROKE}/>`
      );
    case 'healer':
      return (
        `<circle cx="12" cy="12" r="8.5" ${STROKE}/>` +
        '<path d="M12 3.5v17M4.6 7.8l14.8 8.4M19.4 7.8 4.6 16.2" stroke="currentColor" stroke-width="1.6"/>'
      );
    default:
      return FULL_MARKS[classId] ?? '<circle cx="12" cy="12" r="7" fill="currentColor"/>';
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
