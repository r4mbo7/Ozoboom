import '../ui/ui.css';
import './feedback.css';
import type { InputDevice, InputSnapshot } from '../input/intents';
import { t } from '../shared/i18n';
import { copyText, onPointerClick, setText } from '../ui/dom';
import { openDiscord } from '../ui/discord';
import { createMenuInput } from '../ui/navigation';
import type { Prompts } from '../ui/prompts';
import { checkDraft } from './draft';
import { createFormCursor } from './form-cursor';
import { type FeedbackView, type Page, createFeedbackView, paintHint, say } from './form-view';
import { clipboardText } from './github';
import { type FormItem, navigateForm, shiftType, stepWhileTyping } from './navigation';
import type { DraftInProgress, FeedbackTransport, FeedbackType } from './types';

export interface FeedbackOptions {
  device: InputDevice;
  prompts: Prompts;
  onClose(): void;
}

export interface FeedbackDialog {
  update(input: Pick<InputSnapshot, 'menu' | 'device' | 'gameplay'>): void;
  close(): void;
}

let dialogs = 0;

export function openFeedback(
  root: HTMLElement,
  report: string,
  transport: FeedbackTransport,
  options: FeedbackOptions,
): FeedbackDialog {
  dialogs += 1;
  const view = createFeedbackView(
    report,
    `ui-feedback-title-${String(dialogs)}`,
    `ui-feedback-message-${String(dialogs)}`,
  );
  const { form, sent, textarea } = view;
  let type: FeedbackType | null = null;
  let attached = true;
  let busy = false;
  let closed = false;
  let device = options.device;
  const menuInput = createMenuInput();
  menuInput.open();

  const typing = (): boolean => document.activeElement === textarea;
  const cursor = createFormCursor([form, sent], { busy: () => busy, typing, activate });
  const selectOnForm = (item: FormItem, reveal: boolean): void => {
    cursor.select(form, form.items.indexOf(item), reveal);
  };
  for (const chip of view.chips) {
    onPointerClick(chip.node, () => {
      setType(chip.type);
      selectOnForm('type', false);
    });
  }
  wireMessage(view, selectOnForm);

  function setType(next: FeedbackType | null): void {
    type = next;
    view.paintType(next);
  }

  function setAttached(next: boolean): void {
    attached = next;
    view.paintAttached(next);
  }

  function draft(): DraftInProgress {
    return { type, message: textarea.value, context: attached ? report : null };
  }

  async function submit(): Promise<void> {
    const check = checkDraft(draft());
    if (!check.ready) {
      say(form, missingText(check.missing), 'warn');
      selectOnForm(check.missing, true);
      return;
    }
    busy = true;
    view.send.disabled = true;
    try {
      const outcome = await transport.send(check.draft);
      if (closed) {
        return;
      }
      if (outcome.status === 'opened') {
        view.truncatedNote.hidden = !outcome.truncated;
        show(sent);
      } else {
        setText(view.send, t('Try again'));
        say(
          form,
          t(
            'Your browser blocked the new tab. Try again, or copy your feedback so you don’t lose it.',
          ),
          'warn',
        );
      }
    } finally {
      busy = false;
      view.send.disabled = false;
    }
  }

  async function copyDraft(target: Page): Promise<void> {
    if (await copyText(navigator.clipboard, clipboardText(draft()))) {
      say(target, t('Copied to the clipboard.'), 'ok');
    } else if (target === form) {
      textarea.select();
      say(form, t('Can’t copy here. Your text is selected: copy it by hand.'), 'warn');
    } else {
      say(sent, t('Can’t copy here. Your feedback stays in the GitHub tab.'), 'warn');
    }
  }

  function activate(item: FormItem | undefined): void {
    switch (item) {
      case 'type':
        setType(shiftType(type, 1));
        break;
      case 'message':
        textarea.focus();
        break;
      case 'discord':
        openDiscord();
        break;
      case 'context':
        setAttached(!attached);
        break;
      case 'send':
        void submit();
        break;
      case 'copy':
        void copyDraft(cursor.page);
        break;
      case 'close':
        close();
        break;
      case undefined:
        break;
    }
  }

  function show(next: Page): void {
    cursor.show(next);
    paintHint(next, options.prompts.for(device));
  }

  function close(): void {
    if (closed) {
      return;
    }
    closed = true;
    view.layer.remove();
    options.onClose();
  }

  setType(null);
  setAttached(true);
  view.paintCount();
  paintHint(form, options.prompts.for(device));
  cursor.select(form, 0);
  root.append(view.layer);

  return {
    update(input) {
      if (closed) {
        return;
      }
      if (input.device !== device) {
        device = input.device;
        paintHint(cursor.page, options.prompts.for(device));
      }
      const edges = menuInput.edges(input.menu, input.gameplay.move);
      if (busy) {
        return;
      }
      if (typing()) {
        const step = stepWhileTyping(edges);
        if (step.leave) {
          textarea.blur();
        }
        if (!step.navigate) {
          return;
        }
      }
      const step = navigateForm(cursor.page.items, cursor.index, edges);
      if (step.back) {
        close();
        return;
      }
      if (step.typeShift !== 0) {
        setType(shiftType(type, step.typeShift));
      }
      if (step.index !== cursor.index) {
        cursor.select(cursor.page, step.index, true);
      }
      if (step.confirmed) {
        activate(cursor.page.items[cursor.index]);
      }
    },
    close,
  };
}

function missingText(missing: 'type' | 'message'): string {
  return missing === 'type'
    ? t('First pick what your feedback is about.')
    : t('Write your feedback before sending it.');
}

function wireMessage(
  view: FeedbackView,
  selectOnForm: (item: FormItem, reveal: boolean) => void,
): void {
  view.messageField.addEventListener('click', () => {
    view.textarea.focus();
  });
  view.textarea.addEventListener('focus', () => {
    selectOnForm('message', false);
  });
  view.textarea.addEventListener('input', () => {
    view.paintCount();
  });
  view.textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      view.textarea.blur();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      view.textarea.blur();
      selectOnForm(event.shiftKey ? 'type' : 'context', true);
    }
  });
}
