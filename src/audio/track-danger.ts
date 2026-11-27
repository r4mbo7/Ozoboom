import { DEFAULT_DANGER } from './music-score';
import type { DangerCurve, DangerFilter, SoundFiles } from './sound-file';

type Dangers = SoundFiles['dangers'];

// The curve a track's music thins along as its stage nears silence: its artist's, set with
// `pnpm sounds danger` (ADR 0029), else the game's own.
export function trackDanger(
  trackId: string,
  dangers: Dangers,
): { readonly curve: DangerCurve; readonly byArtist: boolean } {
  const curve = dangers?.[trackId];
  return curve === undefined
    ? { curve: DEFAULT_DANGER, byArtist: false }
    : { curve, byArtist: true };
}

function filterText({ from, to }: DangerFilter): string {
  return `${String(from.hz)} Hz at ${String(from.percent)} % to ${String(to.hz)} Hz at ${String(to.percent)} %`;
}

export function dangerText({ highPass, lowPass }: DangerCurve): string {
  return `high-pass ${filterText(highPass)}, low-pass ${filterText(lowPass)}`;
}
