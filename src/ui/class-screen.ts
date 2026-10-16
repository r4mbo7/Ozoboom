import type { InputDevice, MenuIntents } from '../input/intents';
import { t } from '../shared/i18n';
import { attackReach } from '../sim/attacks';
import { type ClassInfo, ROW_CARDS, classColor, landscapeNotice } from './class-picker';
import { CLASS_TEASERS, classTeaser } from './teaser';
import { el, fillHint, setText } from './dom';
import { createEndlessRow } from './endless';
import { formatNumber, formatSeconds, formatTenth } from './format';
import { stepClass } from './lobby-model';
import { endlessHint, promptsFor } from './prompts';
import type { ClassPickerModel, CreatePortrait } from './types';

export const STAT_STEPS = 5;

export interface ClassStat {
  readonly label: string;
  readonly value: string;
  // From 1 to STAT_STEPS, against the other classes.
  readonly steps: number;
}

function reach(info: ClassInfo): number {
  return attackReach(info.attack);
}

function stepsAmong(classes: readonly ClassInfo[], of: (info: ClassInfo) => number, value: number) {
  const values = classes.map(of);
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (!(high > low)) {
    return Math.ceil(STAT_STEPS / 2);
  }
  return 1 + Math.round(((STAT_STEPS - 1) * (value - low)) / (high - low));
}

// Life, speed and reach of a class, each with its value and its rank among the classes.
export function classStats(classes: readonly ClassInfo[], info: ClassInfo): readonly ClassStat[] {
  const rows: readonly [string, (entry: ClassInfo) => number, (value: number) => string][] = [
    [t('Vie'), (entry) => entry.maxHp, formatNumber],
    [t('Vitesse'), (entry) => entry.speed, formatTenth],
    [t('Portée'), reach, formatNumber],
  ];
  return rows.map(([label, of, format]) => ({
    label,
    value: format(of(info)),
    steps: stepsAmong(classes, of, of(info)),
  }));
}

// The card above or below in a grid of `columns`, the last one when the row below is shorter; null
// past the first or the last row.
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

export interface ClassPickerActions {
  choose(classId: string): void;
  toggleEndless(enabled: boolean): void;
  confirm(): void;
  leave(): void;
}

export interface ClassPickerScreen {
  readonly element: HTMLElement;
  // The picker opens: the cards are picked, not the switch.
  open(): void;
  setModel(model: ClassPickerModel): void;
  setDevice(device: InputDevice): void;
  update(edges: MenuIntents): void;
}

function statRow(stat: ClassStat): HTMLElement {
  const row = el('div', 'ui-hero__stat');
  const steps = el('span', 'ui-hero__steps');
  steps.setAttribute('aria-hidden', 'true');
  for (let index = 1; index <= STAT_STEPS; index += 1) {
    const step = el('i', 'ui-hero__step');
    step.toggleAttribute('data-on', index <= stat.steps);
    steps.append(step);
  }
  row.append(
    el('span', 'ui-hero__label', stat.label),
    steps,
    el('span', 'ui-hero__value', stat.value),
  );
  return row;
}

// Solo: after « Jouer », pick a class, drawn alive. The arrows choose, Enter goes on, Escape
// goes back to the title.
export function createClassPicker(
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
  const role = el('p', 'ui-hero__role');
  const skill = el('div', 'ui-hero__skill');
  const skillName = el('span', 'ui-hero__skillname');
  const skillRecharge = el('span', 'ui-hero__recharge');
  const skillText = el('p', 'ui-hero__skilltext');
  const skillHead = el('p', 'ui-hero__skillhead');
  skillHead.append(skillName, skillRecharge);
  skill.append(skillHead, skillText);
  const stats = el('div', 'ui-hero__stats');
  const info = el('div', 'ui-hero__info');
  info.setAttribute('aria-live', 'polite');
  info.append(name, role, skill, stats);
  const hero = el('div', 'ui-hero');
  hero.append(stage, info);

  const row = el('div', 'ui-classcards');
  row.setAttribute('role', 'radiogroup');
  row.setAttribute('aria-label', t('Classes'));
  const endless = createEndlessRow(row, (enabled) => {
    actions.toggleEndless(enabled);
  });
  const cards = classes.map((entry) => {
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
    card.addEventListener('click', (event) => {
      event.stopPropagation();
      actions.choose(entry.id);
    });
    return card;
  });
  row.append(...cards, ...CLASS_TEASERS.map(classTeaser));

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

  // Up and down walk the rows of a grid: past the last row, down goes on to the endless switch when
  // there is one. True when the press was for the grid.
  function stepRows(edges: MenuIntents): boolean {
    const side = edges.down ? 1 : edges.up ? -1 : 0;
    if (endless.row !== 'cards' || side === 0 || edges.back || edges.confirm) {
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
    return side < 0 || !model.launches;
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
    const prompts = promptsFor(device);
    fillHint(
      hint,
      [
        {
          keys: grid
            ? [...new Set([...prompts.navigateRow, ...prompts.navigate])]
            : prompts.navigateRow,
          label: t('choisir'),
        },
        ...(model.launches && !grid ? endlessHint(prompts) : []),
        {
          keys: [prompts.confirm],
          label:
            endless.row === 'endless' ? t('changer') : model.launches ? t('lancer') : t('valider'),
        },
        { keys: [prompts.back], label: t('retour') },
      ],
      prompts.style,
    );
  }

  function paint(): void {
    const chosen = classes.find((entry) => entry.id === model.classId);
    if (chosen === undefined) {
      return;
    }
    big.setClass(chosen.id);
    element.style.setProperty('--class-color', classColor(chosen));
    setText(name, t(chosen.name));
    setText(role, t(chosen.role));
    setText(skillName, t(chosen.skill.name));
    setText(
      skillRecharge,
      t('recharge {duration}', { duration: formatSeconds(chosen.skill.cooldownTicks) }),
    );
    setText(skillText, t(chosen.skill.description));
    stats.replaceChildren(...classStats(classes, chosen).map(statRow));
    classes.forEach((entry, index) => {
      cards[index]?.setAttribute('aria-checked', String(entry.id === chosen.id));
    });
    setText(confirm, model.launches ? t('Lancer le set') : t('Choisir la scène'));
    endless.set(model.endless, model.launches);
    paintHint();
  }

  paint();

  return {
    element,
    open() {
      endless.reset();
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
      const focused = endless.row;
      const taken = endless.handle(edges);
      if (endless.row !== focused) {
        paintHint();
      }
      if (taken) {
        return;
      }
      const delta = (edges.right || edges.down ? 1 : 0) - (edges.left || edges.up ? 1 : 0);
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
