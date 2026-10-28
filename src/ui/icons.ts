import type { SkillEffect, StatKey, TrapEffect, UpgradeFamily, WeaponRole } from '../data/types';
import { FULL_MARKS, FULL_SKILL_ICONS } from './full';
import { KIFFEUR_MARK, OLA_ICON } from './kiffeur';

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

// A pearl thrown forward, unlike the lines and arrow of the Charge.
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

export const SUNRISE =
  '<path d="M3 17.5h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M6.5 17.5a5.5 5.5 0 0 1 11 0" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M12 5v3M5.3 9.3l1.8 1.6M18.7 9.3l-1.8 1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

export const STAGES =
  '<path d="M4 17.5c3-7 5.5 1 8.5-5.5s5-4.5 7.5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2.6"/>' +
  '<circle cx="4" cy="17.5" r="2.2" fill="currentColor"/>' +
  '<g fill="none" stroke="currentColor" stroke-width="1.8">' +
  '<circle cx="9.5" cy="12.5" r="2"/><circle cx="14.5" cy="11" r="2"/><circle cx="20" cy="6.5" r="2"/></g>';

export const MOON =
  '<path d="M19.5 14.6A8.2 8.2 0 0 1 9.4 4.5a8.2 8.2 0 1 0 10.1 10.1z" fill="currentColor"/>';

export const PLAY =
  '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>';

export const PAD =
  '<path d="M7 7.5h10a5 5 0 0 1 4.8 6.4l-1 3.3a2.3 2.3 0 0 1-3.9.9L14.6 15.5H9.4l-2.3 2.6a2.3 2.3 0 0 1-3.9-.9l-1-3.3A5 5 0 0 1 7 7.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
  '<path d="M7.5 10v3.5M5.75 11.75h3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '<circle cx="16.5" cy="10.75" r="1.2" fill="currentColor"/><circle cx="18" cy="13" r="1.2" fill="currentColor"/>';

export const GLOBE =
  '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M3 12h18M12 3c3.2 3.4 3.2 14.6 0 18M12 3c-3.2 3.4-3.2 14.6 0 18" fill="none" stroke="currentColor" stroke-width="1.8"/>';

export const GEAR =
  '<circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<circle cx="12" cy="12" r="2" fill="currentColor"/>' +
  '<path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3M5.4 5.4l2.1 2.1M16.5 16.5l2.1 2.1M5.4 18.6l2.1-2.1M16.5 7.5l2.1-2.1" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';

export const SPEECH =
  '<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
  '<path d="M7.5 8.5h9M7.5 12.5h5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

export const KEYBOARD =
  '<rect x="2.5" y="6" width="19" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M6.5 10h1M10 10h1M13 10h1M16.5 10h1M6.5 14h1M16.5 14h1M10 14h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

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
    case 'ola':
      return OLA_ICON;
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

// Each card that draws the object it names.
const UPGRADE_GLYPHS: Readonly<Record<string, string>> = {
  'baskets-legeres':
    `<path d="M2.5 18.5V12l4-1.3L9 6h4l2 5 3.6 1c1.7.5 2.9 1.9 2.9 3.6v2.9z" ${ROUND}/>` +
    `<path d="M2.5 15.5h19M10.2 9.4l2.3.8M11 7.4l2 .7" ${STROKE}/>`,
  'pas-chasse':
    '<ellipse cx="7" cy="12.5" rx="3.3" ry="4.8" transform="rotate(-15 7 12.5)" fill="currentColor"/>' +
    '<circle cx="8.8" cy="20.2" r="2.2" fill="currentColor"/>' +
    '<ellipse cx="16.5" cy="5.2" rx="3.3" ry="4.8" transform="rotate(-15 16.5 5.2)" fill="currentColor"/>' +
    '<circle cx="18.3" cy="12.9" r="2.2" fill="currentColor"/>',
  'jambes-de-danseur':
    '<path d="M8 2.5h8l1.2 7h-3.6L12 6.8l-1.6 2.7H6.8z" fill="currentColor"/>' +
    '<path d="M8.6 9.8 5.4 15.2l1.8 4.6M15.4 9.8l3.4 4.8-.6 3.4" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M3.2 19.4h4.2c.9 0 1.6.7 1.6 1.6v.5H3.2zM16.7 17.2l3.4.8c.9.2 1.4 1.1 1.2 2l-.1.4-5-1.2z" fill="currentColor"/>' +
    '<path d="M21 13.6l1.6-.8M21.6 16.2h1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>',
  'deuxieme-souffle':
    '<path d="M12 2.5v7.5M12 10c-.6 1.6-2 2.2-3.4 2.8M12 10c.6 1.6 2 2.2 3.4 2.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M9.8 7.2C6.5 5.8 3.8 9.5 3.2 14c-.5 4 .1 6.8 2.3 7 2.3.2 4.3-1.2 4.3-3.5zM14.2 7.2c3.3-1.4 6 2.3 6.6 6.8.5 4-.1 6.8-2.3 7-2.3.2-4.3-1.2-4.3-3.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  'bonnes-ondes':
    '<path d="M12 10.5 7.6 21.5M12 10.5l4.4 11M9 18h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M10 8a2 2 0 1 0 4 0 2 2 0 1 0-4 0z" fill="currentColor"/>' +
    '<path d="M15.25 4.75a4.6 4.6 0 0 1 0 6.5M8.75 4.75a4.6 4.6 0 0 0 0 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M18.13 2.86a8 8 0 0 1 0 10.28M5.87 2.86a8 8 0 0 0 0 10.28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>',
  'volume-a-fond':
    '<path d="M6 12a6 6 0 1 0 12 0 6 6 0 1 0-12 0zM11.89 13.31l2.5 2.5a1 1 0 0 0 1.42-1.42l-2.5-2.5a1 1 0 0 0-1.42 1.42z" fill="currentColor" fill-rule="evenodd"/>' +
    '<path d="M5.6 20.2a9.5 9.5 0 1 1 12.8 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0.1 3.3" opacity="0.6"/>' +
    '<path d="M16.82 18.72a1.9 1.9 0 1 0 3.8 0 1.9 1.9 0 1 0-3.8 0z" fill="currentColor"/>',
  'double-tempo':
    '<path d="M9.2 2.5h5.6l4.4 16H4.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M3.5 18.5h17v3h-17z" fill="currentColor"/>' +
    '<path d="M12 15.5v-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(16 12 15.5)"/>' +
    '<path d="M10.4 8h3.2a.8.8 0 0 1 .8.8v2a.8.8 0 0 1-.8.8h-3.2a.8.8 0 0 1-.8-.8v-2a.8.8 0 0 1 .8-.8z" fill="currentColor" transform="rotate(16 12 15.5)"/>',
  // The Caisson de basse as it stands on the floor, and its bass wave.
  'sub-renforce':
    `<path d="M5 5.5h9a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 16V8A2.5 2.5 0 0 1 5 5.5z" ${ROUND}/>` +
    `<circle cx="9.5" cy="12" r="4.1" ${STROKE}/>` +
    '<circle cx="9.5" cy="12" r="1.5" fill="currentColor"/>' +
    '<path d="M17.8 6.07a10.2 10.2 0 0 1 0 11.86" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>' +
    '<path d="M21.26 5.58a13.4 13.4 0 0 1 0 12.84" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.55"/>',
  rallonge:
    `<path d="M5 3.5h14a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 9V6A2.5 2.5 0 0 1 5 3.5z" ${ROUND}/>` +
    '<g fill="currentColor"><circle cx="7" cy="7.5" r="1.9"/><circle cx="12" cy="7.5" r="1.9"/><circle cx="17" cy="7.5" r="1.9"/>' +
    '<rect x="8.8" y="17.5" width="6.4" height="4" rx="0.8"/></g>' +
    `<path d="M5.5 11.5c0 5 6.5 2 6.5 6" ${ROUND}/>` +
    '<path d="M10.6 21.5v1.3M13.4 21.5v1.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  'talkie-walkie':
    `<rect x="6.5" y="8" width="11" height="14" rx="2.5" ${ROUND}/>` +
    '<path d="M9 8V2" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
    '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
    '<path d="M9.5 12.5h5M9.5 15h5M9.5 17.5h5M12.5 2.8a3.6 3.6 0 0 1 2.2 3.2"/>' +
    '<path d="M15.2.9a6.4 6.4 0 0 1 3 4.9" opacity="0.6"/></g>',
  // Worn across the chest, as at a festival: the strap runs from corner to corner.
  banane:
    '<g transform="translate(12 12.4) rotate(-25.8)">' +
    `<path d="M-8.6-2.6H-12M8.6-2.6H12M-6.6-4.6H6.6a2 2 0 0 1 2 2.2C8.2 2.4 4.7 5.4 0 5.4S-8.2 2.4-8.6-2.4a2 2 0 0 1 2-2.2z" ${ROUND}/>` +
    '<path d="M-5.8-.9H5.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M2.3-.9h1.4v3.1a.7.7 0 0 1-1.4 0z" fill="currentColor"/></g>',
  // A relic is solid gold, with a glint: precious beside the line drawings of the other cards.
  'boule-a-facettes':
    '<path d="M12 .8V3.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M10.8 3.1h2.4v1.1h-2.4z" fill="currentColor"/>' +
    '<path d="M2.8 13.6a9.2 9.2 0 1 0 18.4 0a9.2 9.2 0 1 0 -18.4 0zM3.7 13.6a8.3 8.3 0 1 0 16.6 0a8.3 8.3 0 1 0 -16.6 0z" fill="currentColor" fill-rule="evenodd"/>' +
    '<path d="M12 5.72L13.01 6.01L14.45 7.67L9.55 7.67L10.99 6.01zM6.6 8.47L6.41 9.17L5.64 10.43L4.76 10.43L6 8.47zM9.46 8.47L9.36 9.26L9.06 10.43L6.9 10.43L7.77 8.47zM13.6 8.47L13.97 10.43L10.03 10.43L10.4 8.47zM16.23 8.47L17.1 10.43L14.94 10.43L14.64 9.26L14.54 8.47zM18 8.47L19.24 10.43L18.36 10.43L17.59 9.17L17.4 8.47zM5.66 11.23L5.65 12.14L5.4 13.2L4.11 13.2L4.46 11.23zM9.05 11.23L9.04 12.16L8.94 13.2L6.44 13.2L6.69 11.23zM14.06 11.23L14.16 13.2L9.84 13.2L9.94 11.23zM17.31 11.23L17.56 13.2L15.06 13.2L14.96 12.16L14.95 11.23zM19.54 11.23L19.89 13.2L18.6 13.2L18.35 12.14L18.34 11.23zM5.4 14L5.65 15.06L5.66 15.97L4.46 15.97L4.11 14zM8.94 14L9.04 15.04L9.05 15.97L6.69 15.97L6.44 14zM14.16 14L14.06 15.97L9.94 15.97L9.84 14zM17.56 14L17.31 15.97L14.95 15.97L14.96 15.04L15.06 14zM19.89 14L19.54 15.97L18.34 15.97L18.35 15.06L18.6 14zM5.64 16.77L6.41 18.03L6.6 18.73L6 18.73L4.76 16.77zM9.06 16.77L9.36 17.94L9.46 18.73L7.77 18.73L6.9 16.77zM13.97 16.77L13.6 18.73L10.4 18.73L10.03 16.77zM17.1 16.77L16.23 18.73L14.54 18.73L14.64 17.94L14.94 16.77zM19.24 16.77L18 18.73L17.4 18.73L17.59 18.03L18.36 16.77zM14.45 19.53L13.01 21.19L12 21.48L10.99 21.19L9.55 19.53z" fill="currentColor"/>' +
    '<path d="M0-2.8C.3-.6.6-.3 2.8 0 .6.3.3.6 0 2.8-.3.6-.6.3-2.8 0-.6-.3-.3-.6 0-2.8z" fill="currentColor" transform="translate(3.6 4.6)"/>',
  'machine-a-fumee':
    '<path d="M16.5 13.4a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0zM18 10.4a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0zM15.4 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0zM17.6 6.2a2 2 0 1 0 4 0a2 2 0 1 0 -4 0zM20.2 7.4a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0z" fill="currentColor" opacity="0.5"/>' +
    '<path d="M5.7 11V9.4a1 1 0 0 1 1-1h3.6a1 1 0 0 1 1 1V11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M3.8 11h9a1.6 1.6 0 0 1 1.6 1.6v5.4a1.6 1.6 0 0 1 -1.6 1.6h-9a1.6 1.6 0 0 1 -1.6 -1.6v-5.4a1.6 1.6 0 0 1 1.6 -1.6zM4.85 12.75h3.5a.45 .45 0 0 1 .45 .45v0a.45 .45 0 0 1 -.45 .45h-3.5a.45 .45 0 0 1 -.45 -.45v0a.45 .45 0 0 1 .45 -.45zM4.85 14.75h3.5a.45 .45 0 0 1 .45 .45v0a.45 .45 0 0 1 -.45 .45h-3.5a.45 .45 0 0 1 -.45 -.45v0a.45 .45 0 0 1 .45 -.45zM4.85 16.75h3.5a.45 .45 0 0 1 .45 .45v0a.45 .45 0 0 1 -.45 .45h-3.5a.45 .45 0 0 1 -.45 -.45v0a.45 .45 0 0 1 .45 -.45zM9.8 15.2a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0zM10.8 15.2a.6 .6 0 1 0 1.2 0a.6 .6 0 1 0 -1.2 0z" fill="currentColor" fill-rule="evenodd"/>' +
    '<path d="M14.9 13.4h1l1.3-.7v4.6l-1.3-.7h-1zM3.6 19.6h2v1.5h-2zM10.8 19.6h2v1.5h-2z" fill="currentColor"/>' +
    '<path d="M0-2.8C.3-.6.6-.3 2.8 0 .6.3.3.6 0 2.8-.3.6-.6.3-2.8 0-.6-.3-.3-.6 0-2.8z" fill="currentColor" transform="translate(3.6 5.2)"/>',
  'cable-d-or':
    '<path d="M10.4 13.6C7.6 16.4 9.8 19.2 7 21.2 5.4 22.3 3.8 21.9 2.6 20.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M-5.4 -2.4h5.6a1 1 0 0 1 1 1v2.8a1 1 0 0 1 -1 1h-5.6a1 1 0 0 1 -1 -1v-2.8a1 1 0 0 1 1 -1zM-4.4 -1.7h.7v3.4h-.7zM-2.6 -1.7h.7v3.4h-.7z" fill="currentColor" fill-rule="evenodd" transform="translate(14.6 9.4) rotate(-45)"/>' +
    '<path d="M1.65 -1.6h1.2v3.2h-1.2zM3.3 -.95h2.4v1.9h-2.4zM6.15 -.95h1.3v1.9h-1.3zM7.9-.95H8.6L9.6 0 8.6.95H7.9z" fill="currentColor" transform="translate(14.6 9.4) rotate(-45)"/>' +
    '<path d="M0-2.8C.3-.6.6-.3 2.8 0 .6.3.3.6 0 2.8-.3.6-.6.3-2.8 0-.6-.3-.3-.6 0-2.8z" fill="currentColor" transform="translate(4.8 5.2)"/>',
  'console-de-mixage':
    '<path d="M3.5 5h17a2 2 0 0 1 2 2v11a2 2 0 0 1 -2 2h-17a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2zM3.5 8.2a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0zM4.3 8.2a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0zM4.4 11h.8v3.45h-.8zM4.4 16.35h.8v2.05h-.8zM3.25 14.45h3.1v1.9h-3.1zM8.3 8.2a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0zM9.1 8.2a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0zM9.2 11h.8v.65h-.8zM9.2 13.55h.8v4.85h-.8zM8.05 11.65h3.1v1.9h-3.1zM13.1 8.2a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0zM13.9 8.2a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0zM14 11h.8v4.45h-.8zM14 17.35h.8v1.05h-.8zM12.85 15.45h3.1v1.9h-3.1zM17.9 8.2a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0zM18.7 8.2a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0zM18.8 11h.8v1.45h-.8zM18.8 14.35h.8v4.05h-.8zM17.65 12.45h3.1v1.9h-3.1z" fill="currentColor" fill-rule="evenodd"/>' +
    '<path d="M4.05 14.9h1.5a.3 .3 0 0 1 .3 .3v.4a.3 .3 0 0 1 -.3 .3h-1.5a.3 .3 0 0 1 -.3 -.3v-.4a.3 .3 0 0 1 .3 -.3zM8.85 12.1h1.5a.3 .3 0 0 1 .3 .3v.4a.3 .3 0 0 1 -.3 .3h-1.5a.3 .3 0 0 1 -.3 -.3v-.4a.3 .3 0 0 1 .3 -.3zM13.65 15.9h1.5a.3 .3 0 0 1 .3 .3v.4a.3 .3 0 0 1 -.3 .3h-1.5a.3 .3 0 0 1 -.3 -.3v-.4a.3 .3 0 0 1 .3 -.3zM18.45 12.9h1.5a.3 .3 0 0 1 .3 .3v.4a.3 .3 0 0 1 -.3 .3h-1.5a.3 .3 0 0 1 -.3 -.3v-.4a.3 .3 0 0 1 .3 -.3z" fill="currentColor"/>' +
    '<path d="M0-2.8C.3-.6.6-.3 2.8 0 .6.3.3.6 0 2.8-.3.6-.6.3-2.8 0-.6-.3-.3-.6 0-2.8z" fill="currentColor" transform="translate(20.8 2.4)"/>',
  'projecteur-de-poursuite':
    '<path d="M6.6-3.2 15.4-7.4V7.4L6.6 3.2z" fill="currentColor" opacity="0.42" transform="translate(8.6 11) rotate(-22)"/>' +
    '<path d="M8 12.6V19.4M8 19.4 4.4 22.4M8 19.4l3.6 3M8 19.4v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M-5.2-2.6H3.4L5-3.2V3.2L3.4 2.6H-5.2a.8.8 0 0 1-.8-.8V-1.8a.8.8 0 0 1 .8-.8zM-2.6 -1.9h.7v3.8h-.7zM-.6 -1.9h.7v3.8h-.7z" fill="currentColor" fill-rule="evenodd" transform="translate(8.6 11) rotate(-22)"/>' +
    '<path d="M5.9 -3.8h.5a.5 .5 0 0 1 .5 .5v6.6a.5 .5 0 0 1 -.5 .5h-.5a.5 .5 0 0 1 -.5 -.5v-6.6a.5 .5 0 0 1 .5 -.5zM-6.6-1.4h-.8a.6.6 0 0 0-.6.6v1.6a.6.6 0 0 0 .6.6h.8z" fill="currentColor" transform="translate(8.6 11) rotate(-22)"/>' +
    '<path d="M0-2.8C.3-.6.6-.3 2.8 0 .6.3.3.6 0 2.8-.3.6-.6.3-2.8 0-.6-.3-.3-.6 0-2.8z" fill="currentColor" transform="translate(3.8 4.4)"/>',
  'sono-de-reference':
    '<path d="M8 3 12 1l4 2M12 1V.2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M3.6 3h16.8v1.4h-16.8z" fill="currentColor"/>' +
    '<path d="M3.7 5h16.6a.7 .7 0 0 1 .7 .7v2.7a.7 .7 0 0 1 -.7 .7h-16.6a.7 .7 0 0 1 -.7 -.7v-2.7a.7 .7 0 0 1 .7 -.7zM3.75 7.05a1.39 1.39 0 1 0 2.79 0a1.39 1.39 0 1 0 -2.79 0zM4.61 7.05a.53 .53 0 1 0 1.06 0a.53 .53 0 1 0 -1.06 0zM17.46 7.05a1.39 1.39 0 1 0 2.79 0a1.39 1.39 0 1 0 -2.79 0zM18.33 7.05a.53 .53 0 1 0 1.06 0a.53 .53 0 1 0 -1.06 0zM9.34 6.65h5.32a.4 .4 0 0 1 .4 .4v0a.4 .4 0 0 1 -.4 .4h-5.32a.4 .4 0 0 1 -.4 -.4v0a.4 .4 0 0 1 .4 -.4zM4.2 9.7h15.6a.7 .7 0 0 1 .7 .7v2.5a.7 .7 0 0 1 -.7 .7h-15.6a.7 .7 0 0 1 -.7 -.7v-2.5a.7 .7 0 0 1 .7 -.7zM4.25 11.65a1.33 1.33 0 1 0 2.65 0a1.33 1.33 0 1 0 -2.65 0zM5.07 11.65a.5 .5 0 1 0 1.01 0a.5 .5 0 1 0 -1.01 0zM17.1 11.65a1.33 1.33 0 1 0 2.65 0a1.33 1.33 0 1 0 -2.65 0zM17.92 11.65a.5 .5 0 1 0 1.01 0a.5 .5 0 1 0 -1.01 0zM9.51 11.25h4.98a.4 .4 0 0 1 .4 .4v0a.4 .4 0 0 1 -.4 .4h-4.98a.4 .4 0 0 1 -.4 -.4v0a.4 .4 0 0 1 .4 -.4zM4.9 14.2h14.2a.7 .7 0 0 1 .7 .7v2.3a.7 .7 0 0 1 -.7 .7h-14.2a.7 .7 0 0 1 -.7 -.7v-2.3a.7 .7 0 0 1 .7 -.7zM4.95 16.05a1.26 1.26 0 1 0 2.52 0a1.26 1.26 0 1 0 -2.52 0zM5.73 16.05a.48 .48 0 1 0 .96 0a.48 .48 0 1 0 -.96 0zM16.53 16.05a1.26 1.26 0 1 0 2.52 0a1.26 1.26 0 1 0 -2.52 0zM17.31 16.05a.48 .48 0 1 0 .96 0a.48 .48 0 1 0 -.96 0zM9.75 15.65h4.5a.4 .4 0 0 1 .4 .4v0a.4 .4 0 0 1 -.4 .4h-4.5a.4 .4 0 0 1 -.4 -.4v0a.4 .4 0 0 1 .4 -.4zM5.8 18.5h12.4a.7 .7 0 0 1 .7 .7v2.1a.7 .7 0 0 1 -.7 .7h-12.4a.7 .7 0 0 1 -.7 -.7v-2.1a.7 .7 0 0 1 .7 -.7zM5.85 20.25a1.19 1.19 0 1 0 2.38 0a1.19 1.19 0 1 0 -2.38 0zM6.59 20.25a.45 .45 0 1 0 .9 0a.45 .45 0 1 0 -.9 0zM15.77 20.25a1.19 1.19 0 1 0 2.38 0a1.19 1.19 0 1 0 -2.38 0zM16.51 20.25a.45 .45 0 1 0 .9 0a.45 .45 0 1 0 -.9 0zM10.05 19.85h3.89a.4 .4 0 0 1 .4 .4v0a.4 .4 0 0 1 -.4 .4h-3.89a.4 .4 0 0 1 -.4 -.4v0a.4 .4 0 0 1 .4 -.4z" fill="currentColor" fill-rule="evenodd"/>' +
    '<path d="M0-2.8C.3-.6.6-.3 2.8 0 .6.3.3.6 0 2.8-.3.6-.6.3-2.8 0-.6-.3-.3-.6 0-2.8z" fill="currentColor" transform="translate(3.6 20.4)"/>',
};

// A class card draws what it changes, the same for every character: its first stat names it.
const STAT_GLYPHS: Readonly<Partial<Record<StatKey, string>>> = {
  // An hourglass caught while it is turned over.
  skillCooldownMul:
    '<g transform="translate(12 12) rotate(28) scale(.9) translate(-12 -12)">' +
    '<path d="M5.5 1.5h13a1.25 1.25 0 0 1 0 2.5h-13a1.25 1.25 0 0 1 0-2.5zM5.5 20h13a1.25 1.25 0 0 1 0 2.5h-13a1.25 1.25 0 0 1 0-2.5z" fill="currentColor"/>' +
    '<path d="M7 4v1.8c0 3.2 4 4.4 4 6.2s-4 3-4 6.2V20M17 4v1.8c0 3.2-4 4.4-4 6.2s4 3 4 6.2V20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M9.4 8.6h5.2c-.7 1.2-1.8 2-2.6 3-.8-1-1.9-1.8-2.6-3zM8.2 19.3h7.6c-.5-2.4-2.2-3.7-3.8-3.9-1.6.2-3.3 1.5-3.8 3.9z" fill="currentColor" opacity="0.85"/></g>' +
    '<path d="M3.18 6.3A10.8 10.8 0 0 1 7.6 2.1M20.82 17.7A10.8 10.8 0 0 1 16.4 21.9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity="0.6"/>',
  // A spiked blast to the edges, a star at its heart.
  skillPowerMul:
    '<path d="M13.4 .2 15.9 4.2 20.2 4.3 20.2 8.5 23.8 11.4 20.2 14.5 20.8 18.6 16.9 19.5 14.8 23.8 11 20.6 6.8 22.2 5.5 18.1 .2 17 3.4 12.5 1.4 8.8 4.9 6.7 4.3 .2 10 3.5zM14.41 6.57 15.02 8.85 17.05 9.53 16.43 11.54 17.73 13.46 15.55 14.41 15.23 16.45 13.23 16.31 11.59 18.05 10.25 15.96 8.01 16.1 7.99 13.95 5.62 12.64 7.82 10.97 7.41 8.91 9.39 8.42 10.07 5.23 12.3 7.64z" fill="currentColor" fill-rule="evenodd"/>' +
    '<path d="M14.03 9.67 13.98 10.9 14.89 11.55 14.27 12.45 14.62 13.6 13.39 13.74 12.92 14.71 11.95 14.33 10.87 14.94 10.52 13.7 9.39 13.43 9.71 12.35 8.73 11.34 10.08 10.84 10.2 9.76 11.25 9.82 12.08 8.34 12.82 9.88z" fill="currentColor"/>',
  // A shot through two bad vibe masks, its trail fading behind.
  pierceAdd:
    '<g transform="translate(11.6 12.3) rotate(-37)">' +
    '<g stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
    '<path d="M-13.2 0h1.15" opacity="0.4"/><path d="M-4.95 0h1.35" opacity="0.6"/></g>' +
    '<path transform="translate(.7 0) rotate(29) scale(.98)" d="M-.5-3h1a2.2 2.2 0 0 1 2.2 2.2v1.6a2.2 2.2 0 0 1-2.2 2.2h-1a2.2 2.2 0 0 1-2.2-2.2v-1.6a2.2 2.2 0 0 1 2.2-2.2zM-2.25-1.38-.54-.58v.96l-1.71-.8zM2.25-1.38.54-.58v.96l1.71-.8z" fill="currentColor" fill-rule="evenodd"/>' +
    '<path transform="translate(-8.5 0) rotate(29) scale(.74)" d="M-.5-3h1a2.2 2.2 0 0 1 2.2 2.2v1.6a2.2 2.2 0 0 1-2.2 2.2h-1a2.2 2.2 0 0 1-2.2-2.2v-1.6a2.2 2.2 0 0 1 2.2-2.2zM-2.25-1.38-.54-.58v.96l-1.71-.8zM2.25-1.38.54-.58v.96l1.71-.8z" fill="currentColor" fill-rule="evenodd"/>' +
    '<path d="M3.2 0 8.69-1.98A2.1 2.1 0 1 1 8.69 1.98z" fill="currentColor"/></g>',
  // Three shots fanning out from one point.
  projectileCountAdd:
    '<path d="M3.92 10.37L16.6 5.47L13.55 .77zM4.4 12L17.7 14.8L17.7 9.2zM3.92 13.63L13.55 23.23L16.6 18.53z" fill="currentColor" opacity="0.6"/>' +
    '<path d="M17.87 3.12a2.8 2.8 0 1 1 -5.6 0a2.8 2.8 0 1 1 5.6 0zM20.5 12a2.8 2.8 0 1 1 -5.6 0a2.8 2.8 0 1 1 5.6 0zM17.87 20.88a2.8 2.8 0 1 1 -5.6 0a2.8 2.8 0 1 1 5.6 0z" fill="currentColor"/>',
  // The old reach dotted, the new one a full ring, the band gained between them.
  attackRadiusMul:
    '<path d="M21.6 12a9.6 9.6 0 1 1 -19.2 0a9.6 9.6 0 1 1 19.2 0zM17.4 12a5.4 5.4 0 1 1 -10.8 0a5.4 5.4 0 1 1 10.8 0z" fill="currentColor" fill-rule="evenodd" opacity="0.18"/>' +
    '<circle cx="12" cy="12" r="9.6" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<circle cx="12" cy="12" r="5.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="0.1 2.73" opacity="0.6"/>' +
    '<circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
  // A thick ring, then waves thinner and more broken as they spread.
  skillRadiusMul:
    '<circle cx="12" cy="12" r="2.1" fill="currentColor"/>' +
    '<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="3"/>' +
    '<path d="M20.15 14.03A8.4 8.4 0 0 1 14.03 20.15M9.97 20.15A8.4 8.4 0 0 1 3.85 14.03M3.85 9.97A8.4 8.4 0 0 1 9.97 3.85M14.03 3.85A8.4 8.4 0 0 1 20.15 9.97" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.8"/>' +
    '<path d="M23.05 13.85A11.2 11.2 0 0 1 21.12 18.5M18.5 21.12A11.2 11.2 0 0 1 13.85 23.05M10.15 23.05A11.2 11.2 0 0 1 5.5 21.12M2.88 18.5A11.2 11.2 0 0 1 .95 13.85M.95 10.15A11.2 11.2 0 0 1 2.88 5.5M5.5 2.88A11.2 11.2 0 0 1 10.15 .95M13.85 .95A11.2 11.2 0 0 1 18.5 2.88M21.12 5.5A11.2 11.2 0 0 1 23.05 10.15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.55"/>',
  // A firework sheaf: sparks shot from one low point.
  skillCountAdd:
    '<path d="M12 16.2V13.7M13.95 16.81 15.19 15.05M10.05 16.81 8.81 15.05" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>' +
    '<path d="M12 12.1V8.6M16.1 13.74 17.85 11.24M7.9 13.74 6.15 11.24M15.25 18.61 18.41 17.64M8.75 18.61 5.59 17.64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.75"/>' +
    '<g fill="currentColor"><circle cx="12" cy="5" r="2.3"/><circle cx="19.8" cy="8.46" r="2.1"/><circle cx="4.2" cy="8.46" r="2.1"/><circle cx="21.37" cy="16.73" r="1.8"/><circle cx="2.63" cy="16.73" r="1.8"/><circle cx="12" cy="19.6" r="2.1"/></g>',
  // A shot streaking past its speed lines.
  projectileSpeedMul:
    '<g transform="translate(12.6 12) rotate(-35)"><path d="M7.4-3.7-8-.85a.86.86 0 0 0 0 1.7L7.4 3.7z" fill="currentColor" opacity="0.5"/><circle cx="7.4" cy="0" r="3.7" fill="currentColor"/><path d="M-9.8-5.7H2.4M-7.4 5.7H2.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M-5.6-9.2H-1.6M-2.6 9.2h3.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/></g>',
  // Three marks on the ground, the newest in front.
  zoneCountAdd:
    '<path d="M21.7 4.6a3.7 1.6 0 1 1 -7.4 0a3.7 1.6 0 1 1 7.4 0zM13.2 9.4a5.2 2.3 0 1 1 -10.4 0a5.2 2.3 0 1 1 10.4 0z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity="0.6"/>' +
    '<path d="M21.8 17.6a7.8 3.5 0 1 1 -15.6 0a7.8 3.5 0 1 1 15.6 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M17.7 17.6a3.7 1.65 0 1 1 -7.4 0a3.7 1.65 0 1 1 7.4 0z" fill="currentColor"/>',
};

export function upgradeIcon(id: string, family: UpgradeFamily, stat: StatKey | null): string {
  return (
    UPGRADE_GLYPHS[id] ?? (stat === null ? undefined : STAT_GLYPHS[stat]) ?? familyIcon(family)
  );
}

// Six circles in a flower, drawn in a box of 84.
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

// What a weapon does, drawn as something seen in game: the player is the dot, a bad vibe the burst.
export function roleIcon(role: WeaponRole): string {
  switch (role) {
    case 'hitFront':
      return (
        '<circle cx="12" cy="19" r="2.5" fill="currentColor"/>' +
        `<path d="M4.5 13a10 10 0 0 1 15 0" ${STROKE} stroke-width="2.6"/>` +
        `<path d="M7.6 8.6 6.2 6.4M12 7.2V4.6M16.4 8.6l1.4-2.2" ${ROUND}/>`
      );
    case 'hitFar':
      return (
        '<circle cx="4" cy="12" r="2.5" fill="currentColor"/>' +
        `<path d="M8.5 12h5" ${ROUND} stroke-dasharray="1.5 2.6"/>` +
        '<path d="m18.5 7.2 1.3 3.5 3.5 1.3-3.5 1.3-1.3 3.5-1.3-3.5-3.5-1.3 3.5-1.3z" fill="currentColor"/>'
      );
    case 'hitAround':
      return (
        '<circle cx="12" cy="12" r="2.5" fill="currentColor"/>' +
        `<circle cx="12" cy="12" r="8" ${STROKE} stroke-dasharray="2.2 3"/>` +
        '<path d="M16.6 2.6a5 5 0 0 1 4.8 4.8l-4.8-.6zM7.4 21.4a5 5 0 0 1-4.8-4.8l4.8.6z" fill="currentColor"/>'
      );
    case 'heal':
      return `<path d="M12 4.5v15M4.5 12h15" ${ROUND} stroke-width="3.4"/>`;
    case 'slow':
      return (
        `<path d="M10.5 16.5a5.5 5.5 0 1 1 8.6-4.5 3.2 3.2 0 0 1-3.2 3.2 2.2 2.2 0 0 1-2.2-2.2 1.3 1.3 0 0 1 1.3-1.3" ${ROUND}/>` +
        `<path d="M2 18.5h17.5M3.5 18.5c0-3 1.2-4.5 3-4.5M4.2 14.6 3 12M6.6 14l.4-2.8" ${ROUND}/>`
      );
    case 'pull':
      return (
        `<path d="M6 4.5V12a6 6 0 0 0 12 0V4.5" ${STROKE} stroke-width="2.6"/>` +
        `<path d="M4.2 4.5h3.6M16.2 4.5h3.6" ${ROUND} stroke-width="3.2"/>`
      );
    case 'push':
      return (
        '<circle cx="5.5" cy="12" r="2.5" fill="currentColor"/>' +
        `<path d="M10.5 8a6 6 0 0 1 0 8M14.5 5a10 10 0 0 1 0 14M18.5 2.5a13.5 13.5 0 0 1 0 19" ${ROUND}/>`
      );
    case 'mark':
      return (
        `<circle cx="12" cy="12" r="8.5" ${STROKE}/>` +
        `<circle cx="12" cy="12" r="4" ${STROKE}/>` +
        '<circle cx="12" cy="12" r="1.2" fill="currentColor"/>'
      );
  }
}

export const STAR =
  '<path d="m12 2.5 2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L12 16.8l-5.9 3.7 1.7-6.7-5.3-4.4 6.9-.5z" fill="currentColor"/>';

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
    case 'kiffeur':
      return KIFFEUR_MARK;
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

// Two cards of a hand, the one in front a little turned.
export const CARDS =
  `<rect x="4" y="4.5" width="10" height="14" rx="2" ${ROUND} opacity="0.6"/>` +
  `<rect x="10" y="5.5" width="10" height="14" rx="2" transform="rotate(10 15 12.5)" ${ROUND}/>`;

// Two arrows that chase each other round: the card turns over.
export const TURN =
  `<path d="M4.5 10a7.5 7.5 0 0 1 13.4-3.6M19.5 14a7.5 7.5 0 0 1-13.4 3.6" ${STROKE}/>` +
  `<path d="M18.5 2.5v4.2h-4.2M5.5 21.5v-4.2h4.2" ${ROUND}/>`;
