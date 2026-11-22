import type { CreateBoardLine, EndPartOf } from './end-parts';
import type { HudPart, HudParts, PlaceKeyUse } from './hud-parts';
import type { PlayerState, SimState } from '../sim/state';
import type { DecorId, SummonLook } from '../data/types';
import type { ChangelogView, LeaderboardView } from './title';

export const FULL_PREVIEWS: Readonly<Record<DecorId, string>> = {};
export const FULL_MARKS: Readonly<Record<string, string>> = {};
export const FULL_SKILL_ICONS: Readonly<Record<string, string>> = {};
export const FULL_NIGHTS: { readonly festival?: true } = {};
export const FULL_HUD: Readonly<Record<string, (parts: HudParts) => HudPart>> = {};
export const FULL_PLACE_KEY: {
  readonly use?: (state: SimState, player: PlayerState) => PlaceKeyUse | undefined;
} = {};
export const FULL_OFFERING_ICONS: Partial<Record<SummonLook, string>> = {};
export const FULL_END: { readonly festival?: EndPartOf } = {};
export const FULL_CHANGELOG: { readonly create?: () => ChangelogView } = {};
export const FULL_BOARD_LINE: { readonly create?: CreateBoardLine } = {};
export const FULL_LEADERBOARD: {
  readonly create?: (changed: (turned: boolean) => void) => LeaderboardView;
} = {};
