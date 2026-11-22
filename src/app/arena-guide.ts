import type { RenderOptions } from '../render/types';
import type { StepGuide } from '../ui/types';

// What the arena shows of a step's guide: the way to a speaker, the traps that call, the dash or the
// trap the tutorial asks, and the trap each player's key would take.
export type ArenaGuide = Required<
  Pick<RenderOptions, 'guideToSpeaker' | 'trapCallers' | 'tutorialCall' | 'keyTraps'>
>;

export const NO_ARENA_GUIDE: ArenaGuide = {
  guideToSpeaker: false,
  trapCallers: [],
  tutorialCall: null,
  keyTraps: [],
};

// The arena's guide for a step, `shown` itself while it asks the same, so the renderer is told only
// of a change. The step gives back the same callers and key traps while they do not change.
export function arenaGuide(guide: StepGuide, shown: ArenaGuide): ArenaGuide {
  const gesture = guide.tutorial === 'dash' || guide.tutorial === 'trap' ? guide.tutorial : null;
  const key = gesture === null ? '' : guide.tutorialKey;
  const call = shown.tutorialCall;
  const sameCall = (call?.gesture ?? null) === gesture && (call?.key ?? '') === key;
  const guideToSpeaker = guide.tutorial === 'speaker';
  if (
    sameCall &&
    guideToSpeaker === shown.guideToSpeaker &&
    guide.trapCallers === shown.trapCallers &&
    guide.keyTraps === shown.keyTraps
  ) {
    return shown;
  }
  return {
    guideToSpeaker,
    trapCallers: guide.trapCallers,
    keyTraps: guide.keyTraps,
    tutorialCall: sameCall ? call : gesture === null ? null : { gesture, key },
  };
}
