import type { EndPartOf } from './end-parts';
import type { HudPart, HudParts } from './hud-parts';
import type { DecorId } from '../data/types';

export const FULL_PREVIEWS: Readonly<Record<DecorId, string>> = {};
export const FULL_MARKS: Readonly<Record<string, string>> = {};
export const FULL_SKILL_ICONS: Readonly<Record<string, string>> = {};
export const FULL_NIGHTS: { readonly festival?: true } = {};
export const FULL_HUD: { readonly festival?: (parts: HudParts) => HudPart } = {};
export const FULL_END: { readonly festival?: EndPartOf } = {};
