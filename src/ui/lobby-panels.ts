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
  lobbyView,
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
  readonly heading: HTMLElement;
  readonly lead: HTMLElement;
}

export function createLobbyHeader(): LobbyHeader {
  const heading = el('h2', 'ui-lobby__title');
  const lead = el('p', 'ui-lobby__lead');
  const element = el('header', 'ui-lobby__header');
  element.append(el('p', 'ui-kicker', t('À plusieurs')), heading, lead);
  return { element, heading, lead };
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
  const create = button('ui-button ui-button--primary', t('Créer un salon'));
  const discord = createActionButton(
    t('Trouve ton crew'),
    t('Recrute tes roadies sur Discord'),
    DISCORD,
  );
  discord.tabIndex = -1;
  const codeInput = el('input', 'ui-lobby__input ui-lobby__input--code');
  codeInput.type = 'text';
  codeInput.autocomplete = 'off';
  codeInput.spellcheck = false;
  codeInput.setAttribute('autocapitalize', 'characters');
  codeInput.setAttribute('aria-label', t('Code du salon'));
  codeInput.placeholder = t('Colle le code ici');
  const codeField = el('div', 'ui-lobby__field');
  codeField.append(el('span', 'ui-field__label', t('Code du salon')), codeInput);
  const join = button('ui-button', t('Rejoindre'));
  const element = el('div', 'ui-panel ui-lobby__entry');
  element.append(
    create,
    discord,
    el('p', 'ui-lobby__or', t('ou rejoins le salon d’un ami')),
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
  const copy = button('ui-button', t('Copier le lien'));
  const status = el('p', 'ui-lobby__copy');
  status.setAttribute('role', 'status');
  const element = el('div', 'ui-panel ui-lobby__share');
  const text = el('div', 'ui-lobby__sharetext');
  text.append(el('p', 'ui-panel__label', t('Code du salon')), codeText, linkText, status);
  element.append(text, copy);
  let link = '';

  async function copyNow(): Promise<void> {
    if (await copyText(navigator.clipboard, link)) {
      setText(status, t('Lien copié, envoie-le à tes amis.'));
    } else {
      const range = document.createRange();
      range.selectNodeContents(linkText);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setText(status, t('Lien sélectionné : copie-le avec Ctrl+C.'));
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
  readonly host: HTMLElement;
  readonly name: HTMLElement;
  readonly sheet: ClassSheet;
  readonly join: HTMLButtonElement;
  readonly wait: HTMLElement;
}

export interface SeatHandlers {
  readonly stepClass: (side: -1 | 1) => void;
  readonly rename: (name: string) => void;
  readonly join: () => void;
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
  const host = el('p', 'ui-seat__host', t('Lance le set'));
  const who = el('div', 'ui-seat__who');
  who.append(tag, host);
  const head = el('div', 'ui-seat__head');
  head.append(number, who);

  const input = el('input', 'ui-lobby__input');
  input.type = 'text';
  input.maxLength = NAME_LENGTH;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = defaultName(playerId);
  input.setAttribute(
    'aria-label',
    t('Nom du joueur {number}', { number: formatNumber(playerId + 1) }),
  );
  const field = el('div', 'ui-lobby__field');
  field.append(el('span', 'ui-field__label', t('Nom')), input);
  const name = el('p', 'ui-seat__name');

  const stepper = createClassStepper(classes, handlers.stepClass);
  const sheet = createClassSheet(classes);
  const join = button('ui-seat__join', t('Appuie sur Entrée ou sur A pour rejoindre'));
  const wait = el('p', 'ui-seat__wait', t('En attente d’un joueur'));
  const drawn = portrait();
  const frame = el('div', 'ui-seat__portrait');
  frame.append(drawn.element);
  item.append(head, frame, join, wait, field, name, stepper.element, ...sheet.parts);

  input.addEventListener('input', () => {
    handlers.rename(seatName(input.value));
  });
  onPointerClick(join, handlers.join);
  blurOnEnterOrEscape(input);
  return {
    playerId,
    element: item,
    field,
    input,
    stepper,
    portrait: drawn,
    tag,
    host,
    name,
    sheet,
    join,
    wait,
  };
}

export function paintSeatCard(
  card: SeatCard,
  model: LobbyModel,
  classes: readonly ClassInfo[],
): void {
  const seat = seatAt(model, card.playerId);
  const view = lobbyView(model);
  const editable = seat !== null && !seat.remote;
  card.element.dataset.state = seat === null ? 'empty' : 'taken';
  setFlag(card.element, 'own', editable);
  card.join.hidden = !(seat === null && view === 'local');
  card.wait.hidden = !(seat === null && view !== 'local');
  card.field.hidden = !editable;
  card.name.hidden = seat === null || editable;
  card.stepper.element.hidden = seat === null;
  for (const part of card.sheet.parts) {
    part.hidden = seat === null;
  }
  card.tag.hidden = seat === null;
  card.host.hidden = seat === null || !seat.host || view !== 'local';
  card.stepper.element.toggleAttribute('data-readonly', !editable);
  card.portrait.setClass(seat?.classId ?? classes[0]?.id ?? '');
  if (seat === null) {
    return;
  }
  setText(card.tag, seatTag(seat, model.mode));
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
  const cards = createStageCards(t('Scène'), chooseStage);
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
  const waiting = el('p', 'ui-lobby__waiting', t('En attente de l’hôte'));
  waiting.setAttribute('role', 'status');
  const leave = button('ui-button', t('Retour au titre'));
  const element = el('div', 'ui-lobby__actions');
  element.append(launch, waiting, leave);
  return { element, launch, launchText, launchMore, waiting, leave };
}
