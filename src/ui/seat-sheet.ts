import { defaultName, t } from '../shared/i18n';
import type { PlayerId } from '../sim/state';
import { type ClassInfo, classColor } from './class-picker';
import { createClassSheet } from './class-sheet';
import { el, icon, keycap, replay, setText } from './dom';
import { CHECK } from './icons';
import type { CreatePortrait } from './types';

// One player's sheet on the character screen: the character under their cursor, and whether
// they are ready.
export interface SeatSheet {
  readonly element: HTMLElement;
  show(info: ClassInfo, ready: boolean): void;
}

export function createSeatSheet(
  playerId: PlayerId,
  classes: readonly ClassInfo[],
  portrait: CreatePortrait,
): SeatSheet {
  const element = el('section', 'ui-seatsheet');
  element.dataset.seat = String(playerId + 1);
  element.setAttribute('aria-label', defaultName(playerId));
  element.setAttribute('aria-live', 'polite');
  const head = el('header', 'ui-seatsheet__head');
  const state = el('span', 'ui-seatsheet__state');
  const stateText = el('span', 'ui-seatsheet__statetext');
  state.append(icon('ui-seatsheet__check', CHECK), stateText);
  head.append(
    el('span', 'ui-seatsheet__number', String(playerId + 1)),
    el('span', 'ui-seatsheet__who', defaultName(playerId)),
    state,
  );
  const big = portrait();
  const stage = el('div', 'ui-seatsheet__stage');
  stage.append(big.element);
  const name = el('h3', 'ui-seatsheet__name');
  const sheet = createClassSheet(classes);
  element.append(head, stage, name, ...sheet.parts);

  return {
    element,
    show(chosen, ready) {
      big.setClass(chosen.id);
      element.style.setProperty('--class-color', classColor(chosen));
      element.toggleAttribute('data-ready', ready);
      setText(stateText, ready ? t('Ready') : t('Choosing…'));
      setText(name, t(chosen.name));
      sheet.set(chosen);
    },
  };
}

// The sheet of the one player: their portrait beside what their character does.
export interface ClassHero {
  readonly element: HTMLElement;
  readonly info: HTMLElement;
  show(info: ClassInfo): void;
}

export function createClassHero(
  classes: readonly ClassInfo[],
  portrait: CreatePortrait,
): ClassHero {
  const big = portrait();
  const stage = el('div', 'ui-hero__stage');
  stage.append(big.element);
  const name = el('h3', 'ui-hero__name');
  const sheet = createClassSheet(classes);
  const info = el('div', 'ui-hero__info');
  info.setAttribute('aria-live', 'polite');
  info.append(name, ...sheet.parts);
  const element = el('div', 'ui-hero');
  element.append(stage, info);

  return {
    element,
    info,
    show(chosen) {
      big.setClass(chosen.id);
      setText(name, t(chosen.name));
      sheet.set(chosen);
    },
  };
}

// Where the next player joins, by holding A or Entrée: never a button, a click seats nobody.
export interface Invite {
  readonly element: HTMLElement;
  // The ring round the plus, filled from 0 to 1 by the hold to join.
  hold(fill: number): void;
  // A brief press or a move that does not join: the invite pulses, to say how to.
  knock(): void;
}

export function createInvite(): Invite {
  const element = el('div', 'ui-invite');
  const keys = el('p', 'ui-invite__keys');
  keys.append(
    el('span', '', t('Hold')),
    keycap('A', 'button'),
    el('span', '', t('or')),
    keycap(t('Enter'), 'key'),
  );
  const body = el('div', 'ui-invite__body');
  body.append(el('p', 'ui-invite__text', t('Add a player')), keys);
  element.append(el('span', 'ui-invite__plus', '+'), body);
  let filled = 0;
  return {
    element,
    hold(fill) {
      if (fill !== filled) {
        filled = fill;
        element.style.setProperty('--hold', String(fill));
      }
    },
    knock() {
      replay(element, 'knock');
    },
  };
}
