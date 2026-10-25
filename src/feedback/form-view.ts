import { t } from '../shared/i18n';
import { button, el, fillHint, icon, setText } from '../ui/dom';
import { formatNumber } from '../ui/format';
import { EYE, SENT } from '../ui/icons';
import type { DevicePrompts } from '../ui/prompts';
import { type Toggle, createToggle } from '../ui/toggle';
import { FEEDBACK_TYPES } from './github';
import type { FormItem } from './navigation';
import type { FeedbackType } from './types';

const MAX_MESSAGE_LENGTH = 2000;

export interface Page {
  element: HTMLElement;
  items: readonly FormItem[];
  nodes: ReadonlyMap<FormItem, HTMLElement>;
  status: HTMLElement;
  hint: HTMLElement;
}

export interface TypeChip {
  type: FeedbackType;
  node: HTMLButtonElement;
}

export interface FeedbackView {
  layer: HTMLElement;
  form: Page;
  sent: Page;
  chips: readonly TypeChip[];
  messageField: HTMLElement;
  textarea: HTMLTextAreaElement;
  send: HTMLButtonElement;
  truncatedNote: HTMLElement;
  paintType(type: FeedbackType | null): void;
  paintAttached(on: boolean): void;
  paintCount(): void;
}

interface TypeField {
  field: HTMLElement;
  chips: readonly TypeChip[];
}

interface MessageField {
  field: HTMLElement;
  textarea: HTMLTextAreaElement;
  counter: HTMLElement;
}

interface ContextPanel {
  attach: Toggle;
  context: HTMLElement;
}

export function createFeedbackView(
  report: string,
  titleId: string,
  messageId: string,
): FeedbackView {
  const layer = el('div', 'ui ui-feedback-layer');
  const element = el('section', 'ui-screen ui-overlay ui-feedback');
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-labelledby', titleId);
  layer.append(element);

  const type = typeField(titleId);
  const message = messageField(messageId);
  const discord = discordLink();
  const { attach, context } = contextPanel(report);
  const send = button('ui-button ui-button--primary', t('Envoyer sur GitHub'));
  const form = formPage(titleId, {
    type: type.field,
    message: message.field,
    notice: publicNotice(),
    discord,
    attach: attach.button,
    context,
    send,
  });
  const truncatedNote = el(
    'p',
    'ui-feedback__text ui-feedback__text--warn',
    t(
      'Ton message était trop long pour le lien, sa fin a été coupée. Copie-le en entier pour le coller sur GitHub.',
    ),
  );
  const sent = sentPage(truncatedNote);

  const body = el('div', 'ui-feedback__body');
  body.append(form.element, sent.element);
  element.append(body);

  return {
    layer,
    form,
    sent,
    chips: type.chips,
    messageField: message.field,
    textarea: message.textarea,
    send,
    truncatedNote,
    paintType(next) {
      for (const chip of type.chips) {
        chip.node.setAttribute('aria-checked', String(chip.type === next));
      }
    },
    paintAttached(on) {
      attach.set(on);
      context.toggleAttribute('data-detached', !on);
    },
    paintCount() {
      setText(
        message.counter,
        `${formatNumber(message.textarea.value.length)} / ${formatNumber(MAX_MESSAGE_LENGTH)}`,
      );
    },
  };
}

export function say(page: Page, text: string, tone: 'ok' | 'warn'): void {
  page.status.dataset.tone = tone;
  setText(page.status, text);
}

export function paintHint(page: Page, prompts: DevicePrompts): void {
  fillHint(
    page.hint,
    [
      { keys: prompts.navigate, label: t('naviguer') },
      { keys: [prompts.confirm], label: t('valider') },
      { keys: [prompts.back], label: t('fermer') },
    ],
    prompts.style,
  );
}

function typeField(titleId: string): TypeField {
  const field = el('div', 'ui-field ui-field--type');
  const label = el('span', 'ui-field__label', t('C’est plutôt'));
  label.id = `${titleId}-type`;
  const group = el('div', 'ui-chips');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', label.id);
  const chips = FEEDBACK_TYPES.map((option) => {
    const node = button('ui-chip', option.label);
    node.setAttribute('role', 'radio');
    return { type: option.id, node };
  });
  group.append(...chips.map((chip) => chip.node));
  field.append(label, group);
  return { field, chips };
}

function messageField(messageId: string): MessageField {
  const field = el('div', 'ui-field ui-field--message');
  const head = el('div', 'ui-field__head');
  const label = el('label', 'ui-field__label', t('Ton avis'));
  label.htmlFor = messageId;
  const counter = el('span', 'ui-field__count');
  head.append(label, counter);
  const textarea = el('textarea', 'ui-field__input');
  textarea.id = messageId;
  textarea.maxLength = MAX_MESSAGE_LENGTH;
  textarea.rows = 6;
  textarea.placeholder = t('Ce que tu as vécu, ce que tu attendais, ce que tu changerais.');
  field.append(head, textarea);
  return { field, textarea, counter };
}

function publicNotice(): HTMLElement {
  const notice = el('p', 'ui-feedback__public');
  notice.append(
    icon('ui-feedback__public-icon', EYE),
    el('span', '', t('Ton avis sera public sur GitHub. N’y mets rien de personnel.')),
  );
  return notice;
}

function discordLink(): HTMLButtonElement {
  const discord = button('ui-feedback__discord', '');
  discord.append(
    el('span', '', t('Pas sur GitHub ?')),
    el('span', 'ui-feedback__discord-link', t('Pose ton mot sur Discord')),
  );
  return discord;
}

function contextPanel(report: string): ContextPanel {
  const attach = createToggle(
    t('Joindre le contexte'),
    t('Pour rejouer ta partie à l’identique'),
    t('Oui'),
    t('Non'),
  );
  attach.button.tabIndex = -1;
  const context = el('pre', 'ui-feedback__context', report);
  context.setAttribute('aria-label', t('Contexte de la partie'));
  // The report is read by developers, in English, whatever the language of the game.
  context.dir = 'ltr';
  return { attach, context };
}

function formPage(
  titleId: string,
  parts: {
    type: HTMLElement;
    message: HTMLElement;
    notice: HTMLElement;
    discord: HTMLButtonElement;
    attach: HTMLButtonElement;
    context: HTMLElement;
    send: HTMLButtonElement;
  },
): Page {
  const main = el('div', 'ui-feedback__column');
  main.append(parts.type, parts.message, parts.notice, parts.discord);
  const side = el('div', 'ui-feedback__column');
  side.append(parts.attach, parts.context);
  const grid = el('div', 'ui-feedback__grid');
  grid.append(main, side);

  const copy = button('ui-button ui-feedback__secondary', t('Copier'));
  const cancel = button('ui-button ui-feedback__secondary', t('Fermer'));
  const actions = el('div', 'ui-feedback__actions');
  actions.append(parts.send, copy, cancel);

  const title = el('h2', 'ui-heading', t('Raconte-nous ta soirée'));
  title.id = titleId;
  const header = el('header', 'ui-feedback__header');
  header.append(el('p', 'ui-kicker', t('Ton avis')), title);

  const page: Page = {
    element: el('div', 'ui-feedback__view'),
    items: ['type', 'message', 'discord', 'context', 'send', 'copy', 'close'],
    nodes: new Map<FormItem, HTMLElement>([
      ['type', parts.type],
      ['message', parts.message],
      ['discord', parts.discord],
      ['context', parts.attach],
      ['send', parts.send],
      ['copy', copy],
      ['close', cancel],
    ]),
    status: statusLine(),
    hint: el('p', 'ui-hint'),
  };
  page.element.append(header, grid, page.status, actions, page.hint);
  return page;
}

function sentPage(truncatedNote: HTMLElement): Page {
  const close = button('ui-button ui-button--primary', t('Fermer'));
  const copy = button('ui-button ui-feedback__secondary', t('Copier'));
  const actions = el('div', 'ui-feedback__actions');
  actions.append(close, copy);
  const page: Page = {
    element: el('div', 'ui-feedback__view ui-feedback__sent'),
    items: ['close', 'copy'],
    nodes: new Map<FormItem, HTMLElement>([
      ['close', close],
      ['copy', copy],
    ]),
    status: statusLine(),
    hint: el('p', 'ui-hint'),
  };
  page.element.append(
    icon('ui-feedback__emblem', SENT),
    el('h2', 'ui-heading', t('Le formulaire GitHub est ouvert')),
    el(
      'p',
      'ui-feedback__text',
      t('Relis ton avis dans le nouvel onglet, puis publie-le. Il te faut un compte GitHub.'),
    ),
    truncatedNote,
    el(
      'p',
      'ui-feedback__text',
      t('Pas de compte GitHub ? Copie ton avis pour l’envoyer autrement.'),
    ),
    page.status,
    actions,
    page.hint,
  );
  page.element.hidden = true;
  return page;
}

function statusLine(): HTMLElement {
  const node = el('p', 'ui-feedback__status');
  node.setAttribute('role', 'status');
  return node;
}
