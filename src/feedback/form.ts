import '../ui/ui.css';
import './feedback.css';
import type { InputDevice, InputSnapshot } from '../input/intents';
import { el, fillHint, icon, setText } from '../ui/dom';
import { formatNumber } from '../ui/format';
import { EYE, SENT } from '../ui/icons';
import { createMenuInput } from '../ui/navigation';
import { onMouseMove } from '../ui/pointer';
import { promptsFor } from '../ui/prompts';
import { createToggle } from '../ui/toggle';
import { FEEDBACK_TYPES, clipboardText } from './github';
import { type FormItem, navigateForm, shiftType } from './navigation';
import type { FeedbackTransport, FeedbackType } from './types';

export const MAX_MESSAGE_LENGTH = 2000;

export interface FeedbackOptions {
  device: InputDevice;
  onClose(): void;
}

export interface FeedbackDialog {
  update(input: Pick<InputSnapshot, 'menu' | 'device' | 'gameplay'>): void;
  close(): void;
}

type Tone = 'ok' | 'warn';

interface View {
  element: HTMLElement;
  items: readonly FormItem[];
  nodes: ReadonlyMap<FormItem, HTMLElement>;
  status: HTMLElement;
  hint: HTMLElement;
}

let dialogs = 0;

function button(className: string, text: string): HTMLButtonElement {
  const node = el('button', className, text);
  node.type = 'button';
  node.tabIndex = -1;
  return node;
}

function statusLine(): HTMLElement {
  const node = el('p', 'ui-feedback__status');
  node.setAttribute('role', 'status');
  return node;
}

export function openFeedback(
  root: HTMLElement,
  report: string,
  transport: FeedbackTransport,
  options: FeedbackOptions,
): FeedbackDialog {
  dialogs += 1;
  const titleId = `ui-feedback-title-${String(dialogs)}`;
  const messageId = `ui-feedback-message-${String(dialogs)}`;

  const layer = el('div', 'ui ui-feedback-layer');
  const element = el('section', 'ui-screen ui-overlay ui-feedback');
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-labelledby', titleId);
  layer.append(element);

  const typeField = el('div', 'ui-field ui-field--type');
  const typeLabel = el('span', 'ui-field__label', 'C’est plutôt');
  typeLabel.id = `${titleId}-type`;
  const chips = el('div', 'ui-chips');
  chips.setAttribute('role', 'radiogroup');
  chips.setAttribute('aria-labelledby', typeLabel.id);
  const chipButtons = FEEDBACK_TYPES.map((option) => {
    const chip = button('ui-chip', option.label);
    chip.setAttribute('role', 'radio');
    chip.addEventListener('click', (event) => {
      if (event.detail !== 0) {
        setType(option.id);
        select(form, form.items.indexOf('type'));
      }
    });
    return chip;
  });
  chips.append(...chipButtons);
  typeField.append(typeLabel, chips);

  const messageField = el('div', 'ui-field ui-field--message');
  const messageHead = el('div', 'ui-field__head');
  const messageLabel = el('label', 'ui-field__label', 'Ton avis');
  messageLabel.htmlFor = messageId;
  const counter = el('span', 'ui-field__count');
  messageHead.append(messageLabel, counter);
  const textarea = el('textarea', 'ui-field__input');
  textarea.id = messageId;
  textarea.maxLength = MAX_MESSAGE_LENGTH;
  textarea.rows = 6;
  textarea.placeholder = 'Ce que tu as vécu, ce que tu attendais, ce que tu changerais.';
  messageField.append(messageHead, textarea);

  const notice = el('p', 'ui-feedback__public');
  notice.append(
    icon('ui-feedback__public-icon', EYE),
    el('span', '', 'Ton avis sera public sur GitHub. N’y mets rien de personnel.'),
  );

  const attach = createToggle(
    'Joindre le contexte',
    'Pour rejouer ta partie à l’identique',
    'Oui',
    'Non',
  );
  attach.button.tabIndex = -1;
  const context = el('pre', 'ui-feedback__context', report);
  context.setAttribute('aria-label', 'Contexte de la partie');

  const main = el('div', 'ui-feedback__column');
  main.append(typeField, messageField, notice);
  const side = el('div', 'ui-feedback__column');
  side.append(attach.button, context);
  const grid = el('div', 'ui-feedback__grid');
  grid.append(main, side);

  const send = button('ui-button ui-button--primary', 'Envoyer sur GitHub');
  const copy = button('ui-button ui-feedback__secondary', 'Copier');
  const cancel = button('ui-button ui-feedback__secondary', 'Fermer');
  const formActions = el('div', 'ui-feedback__actions');
  formActions.append(send, copy, cancel);

  const title = el('h2', 'ui-heading', 'Raconte-nous ta soirée');
  title.id = titleId;
  const formHeader = el('header', 'ui-feedback__header');
  formHeader.append(el('p', 'ui-kicker', 'Ton avis'), title);

  const form: View = {
    element: el('div', 'ui-feedback__view'),
    items: ['type', 'message', 'context', 'send', 'copy', 'close'],
    nodes: new Map<FormItem, HTMLElement>([
      ['type', typeField],
      ['message', messageField],
      ['context', attach.button],
      ['send', send],
      ['copy', copy],
      ['close', cancel],
    ]),
    status: statusLine(),
    hint: el('p', 'ui-hint'),
  };
  form.element.append(formHeader, grid, form.status, formActions, form.hint);

  const sentClose = button('ui-button ui-button--primary', 'Fermer');
  const sentCopy = button('ui-button ui-feedback__secondary', 'Copier');
  const sentActions = el('div', 'ui-feedback__actions');
  sentActions.append(sentClose, sentCopy);
  const truncatedNote = el(
    'p',
    'ui-feedback__text ui-feedback__text--warn',
    'Ton message était trop long pour le lien, sa fin a été coupée. Copie-le en entier pour le coller sur GitHub.',
  );
  const sent: View = {
    element: el('div', 'ui-feedback__view ui-feedback__sent'),
    items: ['close', 'copy'],
    nodes: new Map<FormItem, HTMLElement>([
      ['close', sentClose],
      ['copy', sentCopy],
    ]),
    status: statusLine(),
    hint: el('p', 'ui-hint'),
  };
  sent.element.append(
    icon('ui-feedback__emblem', SENT),
    el('h2', 'ui-heading', 'Le formulaire GitHub est ouvert'),
    el(
      'p',
      'ui-feedback__text',
      'Relis ton avis dans le nouvel onglet, puis publie-le. Il te faut un compte GitHub.',
    ),
    truncatedNote,
    el('p', 'ui-feedback__text', 'Pas de compte GitHub ? Copie ton avis pour l’envoyer autrement.'),
    sent.status,
    sentActions,
    sent.hint,
  );
  sent.element.hidden = true;

  const body = el('div', 'ui-feedback__body');
  body.append(form.element, sent.element);
  element.append(body);

  let view = form;
  let index = 0;
  let type: FeedbackType | null = null;
  let attached = true;
  let busy = false;
  let closed = false;
  let device: InputDevice | null = null;
  const menuInput = createMenuInput();
  menuInput.open();

  function setType(next: FeedbackType | null): void {
    type = next;
    FEEDBACK_TYPES.forEach((option, position) => {
      chipButtons[position]?.setAttribute('aria-checked', String(option.id === next));
    });
  }

  function setAttached(next: boolean): void {
    attached = next;
    attach.set(next);
    context.toggleAttribute('data-detached', !next);
  }

  function countCharacters(): void {
    setText(
      counter,
      `${formatNumber(textarea.value.length)} / ${formatNumber(MAX_MESSAGE_LENGTH)}`,
    );
  }

  function say(target: View, text: string, tone: Tone): void {
    target.status.dataset.tone = tone;
    setText(target.status, text);
  }

  function select(target: View, next: number, reveal = false): void {
    index = next;
    target.items.forEach((item, position) => {
      const node = target.nodes.get(item);
      if (position === next) {
        node?.setAttribute('aria-current', 'true');
        if (reveal) {
          node?.scrollIntoView({ block: 'nearest' });
        }
      } else {
        node?.removeAttribute('aria-current');
      }
    });
  }

  function showHint(target: View): void {
    if (device === null) {
      return;
    }
    const prompts = promptsFor(device);
    fillHint(
      target.hint,
      [
        { keys: prompts.navigate, label: 'naviguer' },
        { keys: [prompts.confirm], label: 'valider' },
        { keys: [prompts.back], label: 'fermer' },
      ],
      prompts.style,
    );
  }

  function draft() {
    return { type, message: textarea.value, context: attached ? report : null };
  }

  async function submit(): Promise<void> {
    const current = draft();
    if (current.type === null) {
      say(form, 'Choisis d’abord le type de ton avis.', 'warn');
      select(form, form.items.indexOf('type'), true);
      return;
    }
    if (current.message.trim() === '') {
      say(form, 'Écris ton avis avant de l’envoyer.', 'warn');
      select(form, form.items.indexOf('message'), true);
      return;
    }
    busy = true;
    send.disabled = true;
    try {
      const outcome = await transport.send({ ...current, type: current.type });
      if (closed) {
        return;
      }
      if (outcome.status === 'opened') {
        truncatedNote.hidden = !outcome.truncated;
        show(sent);
      } else {
        setText(send, 'Réessayer');
        say(
          form,
          'Ton navigateur a bloqué le nouvel onglet. Réessaie, ou copie ton avis pour ne pas le perdre.',
          'warn',
        );
      }
    } finally {
      busy = false;
      send.disabled = false;
    }
  }

  async function copyDraft(target: View): Promise<void> {
    try {
      await navigator.clipboard.writeText(clipboardText(draft()));
      say(target, 'Copié dans le presse-papiers.', 'ok');
    } catch (error) {
      if (!(error instanceof DOMException || error instanceof TypeError)) {
        throw error;
      }
      if (target === form) {
        textarea.select();
        say(form, 'Copie impossible ici. Ton texte est sélectionné : copie-le à la main.', 'warn');
      } else {
        say(sent, 'Copie impossible ici. Ton avis reste dans l’onglet GitHub.', 'warn');
      }
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
      case 'context':
        setAttached(!attached);
        break;
      case 'send':
        void submit();
        break;
      case 'copy':
        void copyDraft(view);
        break;
      case 'close':
        close();
        break;
      case undefined:
        break;
    }
  }

  function show(next: View): void {
    select(view, -1);
    view.element.hidden = true;
    view = next;
    view.element.hidden = false;
    showHint(view);
    select(view, 0);
  }

  function close(): void {
    if (closed) {
      return;
    }
    closed = true;
    layer.remove();
    options.onClose();
  }

  for (const target of [form, sent]) {
    target.items.forEach((item, position) => {
      const node = target.nodes.get(item);
      if (node === undefined) {
        return;
      }
      onMouseMove(node, () => {
        if (index !== position && document.activeElement !== textarea) {
          select(target, position);
        }
      });
      if (node instanceof HTMLButtonElement) {
        node.addEventListener('click', (event) => {
          if (event.detail === 0 || busy) {
            return;
          }
          select(target, position);
          activate(item);
        });
      }
    });
  }

  messageField.addEventListener('click', () => {
    textarea.focus();
  });
  textarea.addEventListener('focus', () => {
    select(form, form.items.indexOf('message'));
  });
  textarea.addEventListener('input', countCharacters);
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      textarea.blur();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      textarea.blur();
      select(form, form.items.indexOf(event.shiftKey ? 'type' : 'context'), true);
    }
  });

  setType(null);
  setAttached(true);
  countCharacters();
  device = options.device;
  showHint(form);
  select(form, 0);
  root.append(layer);

  return {
    update(input) {
      if (closed) {
        return;
      }
      if (input.device !== device) {
        device = input.device;
        showHint(view);
      }
      const edges = menuInput.edges(input.menu, input.gameplay.move);
      if (busy) {
        return;
      }
      if (document.activeElement === textarea) {
        if (edges.back || edges.up || edges.down) {
          textarea.blur();
        }
        if (!(edges.up || edges.down)) {
          return;
        }
      }
      const step = navigateForm(view.items, index, edges);
      if (step.back) {
        close();
        return;
      }
      if (step.typeShift !== 0) {
        setType(shiftType(type, step.typeShift));
      }
      if (step.index !== index) {
        select(view, step.index, true);
      }
      if (step.confirmed) {
        activate(view.items[index]);
      }
    },
    close,
  };
}
