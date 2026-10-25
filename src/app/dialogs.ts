import type { FeedbackDialog } from '../feedback';
import type { GamepadLike } from '../input/gamepad';
import type { InputSnapshot } from '../input/intents';
import type { RemapScreen } from '../ui';

type Opener<T> = (onClose: () => void) => T;

export interface Dialogs {
  readonly open: boolean;
  openFeedback(open: Opener<FeedbackDialog>): void;
  openControls(open: Opener<RemapScreen>): void;
  takesPresses(merged: InputSnapshot): boolean;
}

export function createDialogs(gamepads: () => readonly (GamepadLike | null)[]): Dialogs {
  let feedback: FeedbackDialog | null = null;
  let remap: RemapScreen | null = null;

  return {
    get open() {
      return feedback !== null || remap !== null;
    },
    openFeedback(open) {
      if (feedback !== null) {
        return;
      }
      feedback = open(() => {
        feedback = null;
      });
    },
    openControls(open) {
      if (remap !== null || feedback !== null) {
        return;
      }
      remap = open(() => {
        remap = null;
      });
    },
    takesPresses(merged) {
      if (feedback !== null) {
        feedback.update(merged);
        return true;
      }
      if (remap !== null) {
        remap.update(merged, gamepads());
        return true;
      }
      return false;
    },
  };
}
