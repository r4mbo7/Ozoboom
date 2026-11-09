import type { RenderOptions } from '../render/types';
import type { StepGuide } from '../ui/types';

// What the arena shows of a step's guide: the way to a speaker, the traps that call, the dash or the
// trap the tutorial asks.
export type ArenaGuide = Required<
  Pick<RenderOptions, 'guideToSpeaker' | 'trapCallers' | 'tutorialCall'>
>;

export const NO_ARENA_GUIDE: ArenaGuide = {
  guideToSpeaker: false,
  trapCallers: [],
  tutorialCall: null,
};

// The arena's guide for a step, `shown` itself while it asks the same, so the renderer is told only
// of a change.
export function arenaGuide(guide: StepGuide, shown: ArenaGuide): ArenaGuide {
  const gesture = guide.tutorial === 'dash' || guide.tutorial === 'trap' ? guide.tutorial : null;
  const key = gesture === null ? '' : guide.tutorialKey;
  const call = shown.tutorialCall;
  const sameCall = (call?.gesture ?? null) === gesture && (call?.key ?? '') === key;
  const guideToSpeaker = guide.tutorial === 'speaker';
  if (
    sameCall &&
    guideToSpeaker === shown.guideToSpeaker &&
    guide.trapCallers === shown.trapCallers
  ) {
    return shown;
  }
  return {
    guideToSpeaker,
    trapCallers: guide.trapCallers,
    tutorialCall: sameCall ? call : gesture === null ? null : { gesture, key },
  };
}
