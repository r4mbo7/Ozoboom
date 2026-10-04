import type { SkillEffect, TrapEffect, UpgradeFamily } from '../data/types';

export const BOLT = '<path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2z" fill="currentColor"/>';

export const FOG =
  '<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.47 1.2A3.9 3.9 0 0 1 17.1 18.5z" fill="currentColor"/>' +
  '<path d="M4 21.5h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

export const SUN =
  '<circle cx="12" cy="12" r="4.5" fill="currentColor"/>' +
  '<g stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
  '<path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g>';

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
  }
}
