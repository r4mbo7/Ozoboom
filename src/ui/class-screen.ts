import type { InputDevice, MenuIntents } from '../input/intents';
import { t } from '../shared/i18n';
import { type ClassInfo, ROW_CARDS, classColor, landscapeNotice } from './class-picker';
import { CLASS_TEASERS, classTeaser } from './teaser';
import { el, fillHint, goMark, setText, setVar } from './dom';
import { PLAY } from './icons';
import { createEndlessToggle } from './endless';
import { createButtonRow } from './button-row';
import { createClassSheet } from './class-sheet';
import { stepClass } from './lobby-model';
import type { Prompts } from './prompts';
import type { ClassPickerModel, CreatePortrait } from './types';

// The last card when the row below is shorter; null past the first or the last row.
export function gridStep(
  count: number,
  columns: number,
  index: number,
  side: -1 | 1,
): number | null {
  const row = Math.floor(index / columns) + side;
  if (row < 0 || row > Math.floor((count - 1) / columns)) {
    return null;
  }
  return Math.min(index + side * columns, count - 1);
}

// As few rows as when each holds all it fits, the cards shared evenly between them.
export function evenColumns(count: number, fit: number): number {
  const rows = Math.ceil(count / Math.max(1, fit));
  return Math.ceil(count / Math.max(1, rows));
}

export interface ClassPickerActions {
  choose(classId: string): void;
  toggleEndless(enabled: boolean): void;
  confirm(): void;
  leave(): void;
}

export interface ClassPickerScreen {
  readonly element: HTMLElement;
  // The cards are picked, not the switch.
  open(): void;
  setModel(model: ClassPickerModel): void;
  setDevice(device: InputDevice): void;
  update(edges: MenuIntents): void;
}

// The cards keep the width the row fits them at; its padding narrows it to even rows, centred.
function spreadCards(row: HTMLElement): void {
  const width = row.clientWidth;
  if (width === 0) {
    return;
  }
  const style = getComputedStyle(row);
  const gap = parseFloat(style.columnGap);
  const least = parseFloat(style.getPropertyValue('--card-least'));
  const fit = Math.max(1, Math.floor((width + gap) / (least + gap)));
  const card = (width - (fit - 1) * gap) / fit;
  const columns = evenColumns(row.children.length, fit);
  setVar(row, '--card-width', `${String(card)}px`);
  setVar(
    row,
    '--cards-inset',
    `${String(Math.floor((width - columns * card - (columns - 1) * gap) / 2))}px`,
  );
}

export function createClassPicker(
  prompts: Prompts,
  classes: readonly ClassInfo[],
  portrait: CreatePortrait,
  actions: ClassPickerActions,
): ClassPickerScreen {
  let model: ClassPickerModel = {
    classId: classes[0]?.id ?? '',
    launches: false,
    endless: false,
  };

  const element = el('section', 'ui-screen ui-classpicker');
  element.setAttribute('aria-label', t('Choix du perso'));
  const grid = classes.length > ROW_CARDS;
  element.toggleAttribute('data-many', classes.length + CLASS_TEASERS.length > ROW_CARDS);
  const header = el('header', 'ui-lobby__header');
  header.append(
    el('p', 'ui-kicker', t('Avant de lancer')),
    el('h2', 'ui-lobby__title', t('Choisis ton perso')),
    el('p', 'ui-lobby__lead', t('Qui monte sur la piste ce soir ?')),
  );

  const big = portrait();
  const stage = el('div', 'ui-hero__stage');
  stage.append(big.element);
  const name = el('h3', 'ui-hero__name');
  const sheet = createClassSheet(classes);
  const info = el('div', 'ui-hero__info');
  info.setAttribute('aria-live', 'polite');
  info.append(name, ...sheet.parts);
  const hero = el('div', 'ui-hero');
  hero.append(stage, info);

  const row = el('div', 'ui-classcards');
  row.setAttribute('role', 'radiogroup');
  row.setAttribute('aria-label', t('Classes'));
  const endless = createEndlessToggle((enabled) => {
    actions.toggleEndless(enabled);
  });
  const goes = classes.map(() => goMark(PLAY));
  const cards = classes.map((entry, index) => {
    const card = el('button', 'ui-classcard');
    card.type = 'button';
    card.tabIndex = -1;
    card.setAttribute('role', 'radio');
    card.style.setProperty('--class-color', classColor(entry));
    const thumb = portrait();
    thumb.setClass(entry.id);
    const frame = el('span', 'ui-classcard__portrait');
    frame.append(thumb.element);
    card.append(frame, el('span', 'ui-classcard__name', t(entry.name)));
    const go = goes[index];
    if (go !== undefined) {
      card.append(go.element);
    }
    card.addEventListener('click', (event) => {
      event.stopPropagation();
      if (entry.id === model.classId) {
        actions.confirm();
      } else {
        actions.choose(entry.id);
      }
    });
    return card;
  });
  row.append(...cards, ...CLASS_TEASERS.map(classTeaser));
  // Its border box, which the padding leaves alone. On the next frame: taller cards can bring the
  // scrollbar in, which narrows the row again.
  if (element.hasAttribute('data-many') && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      requestAnimationFrame(() => {
        spreadCards(row);
      });
    }).observe(row, { box: 'border-box' });
  }

  const confirm = el('button', 'ui-button ui-button--primary');
  confirm.type = 'button';
  confirm.tabIndex = -1;
  const back = el('button', 'ui-button', t('Retour au titre'));
  back.type = 'button';
  back.tabIndex = -1;
  confirm.addEventListener('click', () => {
    actions.confirm();
  });
  back.addEventListener('click', () => {
    actions.leave();
  });
  const buttons = createButtonRow(row, [endless.toggle.button, confirm, back]);
  const footer = el('div', 'ui-lobby__actions');
  // In the row of the buttons: the picker already fills the height of a laptop screen.
  footer.append(endless.toggle.button, confirm, back);
  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-lobby__body');
  body.append(header, landscapeNotice(), hero, row, footer, hint);
  element.append(body);

  let device: InputDevice | null = null;

  function columns(): number {
    const top = cards[0]?.offsetTop;
    return Math.max(1, cards.filter((card) => card.offsetTop === top).length);
  }

  // Past the last row, down goes on to the buttons. True when the press was for the grid.
  function stepRows(edges: MenuIntents): boolean {
    const side = edges.down ? 1 : edges.up ? -1 : 0;
    if (buttons.focused !== null || side === 0 || edges.back || edges.confirm) {
      return false;
    }
    const count = columns();
    if (count >= classes.length) {
      return false;
    }
    const index = classes.findIndex((entry) => entry.id === model.classId);
    const next = gridStep(classes.length, count, Math.max(index, 0), side);
    if (next !== null) {
      reveal(next);
      return true;
    }
    return side < 0;
  }

  function reveal(index: number): void {
    const next = classes[index];
    if (next !== undefined) {
      actions.choose(next.id);
      cards[index]?.scrollIntoView({ block: 'nearest' });
    }
  }

  function paintHint(): void {
    if (device === null) {
      return;
    }
    const shown = prompts.for(device);
    fillHint(
      hint,
      [
        {
          keys: grid ? [...new Set([...shown.navigateRow, ...shown.navigate])] : shown.navigateRow,
          label: t('choisir'),
        },
        {
          keys: [shown.confirm],
          label: confirmLabel(),
        },
        { keys: [shown.back], label: t('retour') },
      ],
      shown.style,
    );
  }

  function confirmLabel(): string {
    const focused = buttons.focused;
    if (focused === endless.toggle.button) {
      return t('changer');
    }
    return focused === null && model.launches ? t('lancer') : t('valider');
  }

  function paint(): void {
    const chosen = classes.find((entry) => entry.id === model.classId);
    if (chosen === undefined) {
      return;
    }
    big.setClass(chosen.id);
    element.style.setProperty('--class-color', classColor(chosen));
    setText(name, t(chosen.name));
    sheet.set(chosen);
    classes.forEach((entry, index) => {
      cards[index]?.setAttribute('aria-checked', String(entry.id === chosen.id));
    });
    const next = model.launches ? t('Lancer le set') : t('Choisir la scène');
    setText(confirm, next);
    for (const go of goes) {
      go.set(next);
    }
    endless.set(model.endless, model.launches);
    paintHint();
  }

  paint();

  return {
    element,
    open() {
      buttons.reset();
      paintHint();
    },
    setModel(next) {
      model = next;
      paint();
    },
    setDevice(next) {
      if (next !== device) {
        device = next;
        paintHint();
      }
    },
    update(edges) {
      if (stepRows(edges)) {
        return;
      }
      const focused = buttons.focused;
      const taken = buttons.handle(edges);
      if (buttons.focused !== focused) {
        paintHint();
      }
      if (taken) {
        return;
      }
      const delta = (edges.right ? 1 : 0) - (edges.left ? 1 : 0);
      const next = delta === 0 ? null : stepClass(classes, model.classId, delta);
      if (edges.back) {
        actions.leave();
      } else if (edges.confirm) {
        actions.confirm();
      } else if (next !== null) {
        reveal(classes.findIndex((entry) => entry.id === next));
      }
    },
  };
}
