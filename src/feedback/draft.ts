import type { DraftInProgress, FeedbackDraft } from './types';

export type DraftCheck =
  { ready: true; draft: FeedbackDraft } | { ready: false; missing: 'type' | 'message' };

export function checkDraft(draft: DraftInProgress): DraftCheck {
  if (draft.type === null) {
    return { ready: false, missing: 'type' };
  }
  if (draft.message.trim() === '') {
    return { ready: false, missing: 'message' };
  }
  return {
    ready: true,
    draft: { type: draft.type, message: draft.message, context: draft.context },
  };
}
