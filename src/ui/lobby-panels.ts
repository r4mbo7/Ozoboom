import { t } from '../shared/i18n';
import type { PlayerId } from '../sim/state';
import { type ClassInfo, type ClassStepper, classColor, createClassStepper } from './class-picker';
import { type ClassSheet, createClassSheet } from './class-sheet';
import { openDiscord } from './discord';
import { button, copyText, el, onPointerClick, setFlag, setText } from './dom';
import { createActionButton } from './feedback-button';
import { formatNumber } from './format';
import { DISCORD } from './icons';
import {
  NAME_LENGTH,
  defaultName,
  normalizeRoomCode,
  seatAt,
  seatName,
  seatTag,
} from './lobby-model';
import { type StageCards, createStageCards } from './stage';
import type { ClassPortrait, CreatePortrait, LobbyModel } from './types';

function blurOnEnterOrEscape(input: HTMLInputElement, onEnter?: () => void): void {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
      onEnter?.();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      input.blur();
    }
  });
}

export interface LobbyHeader {
  readonly element: HTMLElement;
  readonly lead: HTMLElement;
}

export function createLobbyHeader(): LobbyHeader {
  const lead = el('p', 'ui-lobby__lead');
  const element = el('header', 'ui-lobby__header');
  element.append(el('h2', 'ui-lobby__title', t('Online room')), lead);
  return { element, lead };
}

export function createLobbyError(): HTMLElement {
  const error = el('p', 'ui-lobby__error');
  error.setAttribute('role', 'alert');
  return error;
}

export interface EntryPanel {
  readonly element: HTMLElement;
  readonly create: HTMLButtonElement;
  readonly discord: HTMLButtonElement;
  readonly codeField: HTMLElement;
  readonly codeInput: HTMLInputElement;
  readonly join: HTMLButtonElement;
  submit(): void;
}

export function createEntryPanel(
  createRoom: () => void,
  joinRoom: (code: string) => void,
  linkedCode: string,
): EntryPanel {
  const create = button('ui-button ui-button--primary', t('Create a room'));
  const discord = createActionButton(
    t('Find your crew'),
    t('Round up your roadies on Discord'),
    DISCORD,
  );
  discord.tabIndex = -1;
  const codeInput = el('input', 'ui-lobby__input ui-lobby__input--code');
  codeInput.type = 'text';
  codeInput.autocomplete = 'off';
  codeInput.spellcheck = false;
  codeInput.setAttribute('autocapitalize', 'characters');
  codeInput.setAttribute('aria-label', t('Room code'));
  codeInput.placeholder = t('Paste the code here');
  const codeField = el('div', 'ui-lobby__field');
  codeField.append(el('span', 'ui-field__label', t('Room code')), codeInput);
  const join = button('ui-button', t('Join'));
  const element = el('div', 'ui-panel ui-lobby__entry');
  element.append(
    create,
    discord,
    el('p', 'ui-lobby__or', t('or join a friend’s room')),
    codeField,
    join,
  );

  function submit(): void {
    const code = normalizeRoomCode(codeInput.value);
    if (code !== '') {
      joinRoom(code);
    }
  }

  onPointerClick(create, createRoom);
  onPointerClick(discord, openDiscord);
  onPointerClick(join, submit);
  codeInput.addEventListener('input', () => {
    const code = normalizeRoomCode(codeInput.value);
    if (code !== codeInput.value) {
      codeInput.value = code;
    }
  });
  blurOnEnterOrEscape(codeInput, submit);
  if (linkedCode !== '') {
    codeInput.value = linkedCode;
  }
  return { element, create, discord, codeField, codeInput, join, submit };
}

export interface SharePanel {
  readonly element: HTMLElement;
  readonly copy: HTMLButtonElement;
  show(code: string, link: string): void;
  copyLink(): void;
}

export function createSharePanel(): SharePanel {
  const codeText = el('p', 'ui-lobby__code');
  const linkText = el('p', 'ui-lobby__link');
  const copy = button('ui-button', t('Copy the link'));
  const status = el('p', 'ui-lobby__copy');
  status.setAttribute('role', 'status');
  const element = el('div', 'ui-panel ui-lobby__share');
  const text = el('div', 'ui-lobby__sharetext');
  text.append(el('p', 'ui-panel__label', t('Room code')), codeText, linkText, status);
  element.append(text, copy);
  let link = '';

  async function copyNow(): Promise<void> {
    if (await copyText(navigator.clipboard, link)) {
      setText(status, t('Link copied, send it to your friends.'));
    } else {
      const range = document.createRange();
      range.selectNodeContents(linkText);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setText(status, t('Link selected: copy it with Ctrl+C.'));
    }
  }

  function copyLink(): void {
    void copyNow();
  }

  onPointerClick(copy, copyLink);
  return {
    element,
    copy,
    show(code, shown) {
      link = shown;
      setText(codeText, code);
      setText(linkText, shown);
    },
    copyLink,
  };
}

export interface SeatCard {
  readonly playerId: PlayerId;
  readonly element: HTMLLIElement;
  readonly field: HTMLElement;
  readonly input: HTMLInputElement;
  readonly stepper: ClassStepper;
  readonly portrait: ClassPortrait;
  readonly tag: HTMLElement;
  readonly name: HTMLElement;
  readonly sheet: ClassSheet;
  readonly wait: HTMLElement;
}

export interface SeatHandlers {
  readonly stepClass: (side: -1 | 1) => void;
  readonly rename: (name: string) => void;
}

export function createSeatCard(
  playerId: PlayerId,
  classes: readonly ClassInfo[],
  portrait: CreatePortrait,
  handlers: SeatHandlers,
): SeatCard {
  const item = el('li', 'ui-seat');
  const number = el('span', 'ui-seat__number', String(playerId + 1));
  number.setAttribute('aria-hidden', 'true');
  const tag = el('p', 'ui-seat__tag');
  const head = el('div', 'ui-seat__head');
  head.append(number, tag);

  const input = el('input', 'ui-lobby__input');
  input.type = 'text';
  input.maxLength = NAME_LENGTH;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = defaultName(playerId);
  input.setAttribute(
    'aria-label',
    t('Player {number}’s name', { number: formatNumber(playerId + 1) }),
  );
  const field = el('div', 'ui-lobby__field');
  field.append(el('span', 'ui-field__label', t('Name')), input);
  const name = el('p', 'ui-seat__name');

  const stepper = createClassStepper(classes, handlers.stepClass);
  const sheet = createClassSheet(classes);
  const wait = el('p', 'ui-seat__wait', t('Waiting for a player'));
  const drawn = portrait();
  const frame = el('div', 'ui-seat__portrait');
  frame.append(drawn.element);
  item.append(head, frame, wait, field, name, stepper.element, ...sheet.parts);

  input.addEventListener('input', () => {
    handlers.rename(seatName(input.value));
  });
  blurOnEnterOrEscape(input);
  return {
    playerId,
    element: item,
    field,
    input,
    stepper,
    portrait: drawn,
    tag,
    name,
    sheet,
    wait,
  };
}

export function paintSeatCard(
  card: SeatCard,
  model: LobbyModel,
  classes: readonly ClassInfo[],
): void {
  const seat = seatAt(model, card.playerId);
  const editable = seat !== null && !seat.remote;
  card.element.dataset.state = seat === null ? 'empty' : 'taken';
  setFlag(card.element, 'own', editable);
  card.wait.hidden = seat !== null;
  card.field.hidden = !editable;
  card.name.hidden = seat === null || editable;
  card.stepper.element.hidden = seat === null;
  for (const part of card.sheet.parts) {
    part.hidden = seat === null;
  }
  card.tag.hidden = seat === null;
  card.stepper.element.toggleAttribute('data-readonly', !editable);
  card.portrait.setClass(seat?.classId ?? classes[0]?.id ?? '');
  if (seat === null) {
    return;
  }
  setText(card.tag, seatTag(seat));
  const name = seat.name === '' ? defaultName(card.playerId) : seat.name;
  setText(card.name, name);
  if (document.activeElement !== card.input && card.input.value !== name) {
    card.input.value = name;
  }
  card.stepper.set(seat.classId);
  const chosen = classes.find((info) => info.id === seat.classId);
  if (chosen !== undefined) {
    card.element.style.setProperty('--class-color', classColor(chosen));
    card.sheet.set(chosen);
  }
}

export interface StagePanel {
  readonly element: HTMLElement;
  readonly label: HTMLElement;
  readonly cards: StageCards;
}

export function createStagePanel(chooseStage: (setId: string) => void): StagePanel {
  const label = el('p', 'ui-panel__label');
  const cards = createStageCards(t('Stage'), chooseStage);
  const element = el('div', 'ui-lobby__stage');
  element.append(label, cards.element);
  return { element, label, cards };
}

export interface LobbyFooter {
  readonly element: HTMLElement;
  readonly launch: HTMLButtonElement;
  readonly launchText: HTMLElement;
  readonly launchMore: HTMLElement;
  readonly waiting: HTMLElement;
  readonly leave: HTMLButtonElement;
}

export function createLobbyFooter(): LobbyFooter {
  const launch = button('ui-button ui-button--primary ui-launch', '');
  const launchText = el('span', 'ui-launch__label');
  const launchMore = el('span', 'ui-launch__detail');
  launch.append(launchText, launchMore);
  const waiting = el('p', 'ui-lobby__waiting', t('Waiting for the host'));
  waiting.setAttribute('role', 'status');
  const leave = button('ui-button', t('Back to the title'));
  const element = el('div', 'ui-lobby__actions');
  element.append(launch, waiting, leave);
  return { element, launch, launchText, launchMore, waiting, leave };
}
