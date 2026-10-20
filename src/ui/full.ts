import type { EndPartOf } from './end-parts';
import type { HudPart, HudParts } from './hud-parts';
import type { DecorId, SummonLook } from '../data/types';

export const FULL_PREVIEWS: Readonly<Record<DecorId, string>> = {};
export const FULL_MARKS: Readonly<Record<string, string>> = {};
export const FULL_SKILL_ICONS: Readonly<Record<string, string>> = {};
export const FULL_NIGHTS: { readonly festival?: true } = {};
export const FULL_HUD: Readonly<Record<string, (parts: HudParts) => HudPart>> = {};
export const FULL_OFFERING_ICONS: Partial<Record<SummonLook, string>> = {};
export const FULL_END: { readonly festival?: EndPartOf } = {};
