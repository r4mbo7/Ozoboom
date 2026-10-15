import type { MenuIntents } from '../input/intents';
import { navigateMenu } from '../ui/navigation';
import { FEEDBACK_TYPES } from './github';
import type { FeedbackType } from './types';

export type FormItem = 'type' | 'message' | 'context' | 'send' | 'copy' | 'close';

export interface FormStep {
  index: number;
  typeShift: -1 | 0 | 1;
  confirmed: boolean;
  back: boolean;
}

export function navigateForm(
  items: readonly FormItem[],
  index: number,
  edges: MenuIntents,
): FormStep {
  if (items[index] === 'type' && edges.left !== edges.right) {
    return { index, typeShift: edges.right ? 1 : -1, confirmed: edges.confirm, back: edges.back };
  }
  return { ...navigateMenu(index, items.length, edges), typeShift: 0 };
}

export function shiftType(type: FeedbackType | null, shift: -1 | 0 | 1): FeedbackType | null {
  if (shift === 0) {
    return type;
  }
  const count = FEEDBACK_TYPES.length;
  const current = FEEDBACK_TYPES.findIndex((option) => option.id === type);
  const next = current === -1 ? (shift === 1 ? 0 : count - 1) : (current + shift + count) % count;
  return FEEDBACK_TYPES[next]?.id ?? null;
}
