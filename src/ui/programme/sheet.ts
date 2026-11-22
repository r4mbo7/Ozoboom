import { t } from '../../shared/i18n';
import { el, icon, keycap, onPointerClick } from '../dom';
import { formatHundredth } from '../format';
import { LOCK, PLAY } from '../icons';
import type { KeyStyle } from '../prompts';
import { PIPS, pipsOf } from './figures';
import { createPortrait, type PortraitView } from './portrait';
import type { Figure, ProgrammeEntry } from './types';

export interface Sheet {
  readonly element: HTMLElement;
  show(entry: ProgrammeEntry, confirmKey: string | null, keyStyle: KeyStyle): void;
  // Fits the sheet to its panel, then paints its portrait.
  paint(): void;
}

// The portrait gives way to the words: CSS shrinks it to its smallest readable size, and a sheet that
// still overflows its panel goes without it.
function fitFrame(body: HTMLElement, frame: HTMLElement): void {
  frame.style.removeProperty('display');
  if (body.scrollHeight > body.clientHeight) {
    frame.style.display = 'none';
  }
}

function figureRow({ label, value, most, text }: Figure): HTMLElement {
  const row = el('div', 'ui-programme__figure');
  const pips = el('dd', 'ui-programme__pips');
  const filled = pipsOf(value, most);
  pips.setAttribute('aria-hidden', 'true');
  for (let pip = 0; pip < PIPS; pip += 1) {
    pips.append(
      el('span', pip < filled ? 'ui-programme__pip ui-programme__pip--on' : 'ui-programme__pip'),
    );
  }
  row.append(
    el('dt', 'ui-programme__figure-label', label),
    pips,
    el('dd', 'ui-programme__value', text ?? formatHundredth(value)),
  );
  return row;
}

function listenButton(
  listen: () => void,
  confirmKey: string | null,
  keyStyle: KeyStyle,
): HTMLButtonElement {
  const node = el('button', 'ui-programme__listen');
  node.type = 'button';
  node.tabIndex = -1;
  node.append(icon('ui-programme__listen-icon', PLAY), el('span', '', t('Listen')));
  if (confirmKey !== null) {
    node.append(keycap(confirmKey, keyStyle));
  }
  onPointerClick(node, listen);
  return node;
}

// The special's name, printed under the figures.
function specialRow(name: string): HTMLElement {
  const row = el('p', 'ui-programme__special');
  row.append(el('span', 'ui-programme__special-label', t('Special')), el('span', '', name));
  return row;
}

function lockedNote(): HTMLElement {
  const note = el('p', 'ui-programme__locked');
  note.append(icon('ui-programme__lock', LOCK), el('span', '', t('In the full game')));
  return note;
}

export function createSheet(): Sheet {
  const element = el('article', 'ui-programme__panel ui-programme__sheet');
  const head = el('p', 'ui-programme__eyebrow', t('Fact sheet'));
  const body = el('div', 'ui-programme__entry');
  element.append(head, body);
  let portrait: PortraitView | null = null;

  return {
    element,
    show(entry, confirmKey, keyStyle) {
      portrait = createPortrait(entry, 'ui-programme__frame');
      const about = el('div', 'ui-programme__about');
      about.append(
        el('p', 'ui-programme__kind', entry.kind),
        el('h3', 'ui-programme__title', entry.name),
      );
      if (entry.chips !== undefined) {
        const chips = el('p', 'ui-programme__chips');
        chips.append(...entry.chips.map((chip) => el('span', 'ui-programme__chip', chip)));
        about.append(chips);
      }
      body.dataset.locked = entry.locked === true ? 'true' : 'false';
      body.replaceChildren(portrait.element, about);
      if (entry.locked === true) {
        about.append(lockedNote());
        return;
      }
      if (entry.line !== undefined) {
        about.append(el('p', 'ui-programme__line', entry.line));
      }
      if (entry.note !== undefined) {
        about.append(el('p', 'ui-programme__note', entry.note));
      }
      if (entry.figures.length > 0) {
        const figures = el('dl', 'ui-programme__figures');
        figures.append(...entry.figures.map(figureRow));
        body.append(figures);
      }
      if (entry.special !== undefined) {
        body.append(specialRow(entry.special));
      }
      if (entry.listen !== undefined) {
        body.append(listenButton(entry.listen, confirmKey, keyStyle));
      }
    },
    paint() {
      if (portrait !== null) {
        fitFrame(body, portrait.element);
        portrait.paint();
      }
    },
  };
}
