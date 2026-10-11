import type { InputDevice, MenuIntents } from '../input/intents';
import { type ClassInfo, classColor } from './class-picker';
import { el, fillHint, setText } from './dom';
import { formatNumber, formatSeconds, formatTenth } from './format';
import { stepClass } from './lobby-model';
import { promptsFor } from './prompts';
import type { ClassPickerModel, CreatePortrait } from './types';

export const STAT_STEPS = 5;

export interface ClassStat {
  readonly label: string;
  readonly value: string;
  // From 1 to STAT_STEPS, against the other classes.
  readonly steps: number;
}

function reach(info: ClassInfo): number {
  return info.attack.rangeTicks * info.attack.projectileSpeed;
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
    ['Vie', (entry) => entry.maxHp, formatNumber],
    ['Vitesse', (entry) => entry.speed, formatTenth],
    ['Portée', reach, formatNumber],
  ];
  return rows.map(([label, of, format]) => ({
    label,
    value: format(of(info)),
    steps: stepsAmong(classes, of, of(info)),
  }));
}

export interface ClassPickerActions {
  choose(classId: string): void;
  confirm(): void;
  leave(): void;
}

export interface ClassPickerScreen {
  readonly element: HTMLElement;
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

// Solo: after « Jouer », pick a class, drawn alive. Left and right choose, Enter goes on, Escape
// goes back to the title.
export function createClassPicker(
  classes: readonly ClassInfo[],
  portrait: CreatePortrait,
  actions: ClassPickerActions,
): ClassPickerScreen {
  let model: ClassPickerModel = { classId: classes[0]?.id ?? '', launches: false };

  const element = el('section', 'ui-screen ui-classpicker');
  element.setAttribute('aria-label', 'Choix du perso');
  const header = el('header', 'ui-lobby__header');
  header.append(
    el('p', 'ui-kicker', 'Avant de lancer'),
    el('h2', 'ui-lobby__title', 'Choisis ton perso'),
    el('p', 'ui-lobby__lead', 'Qui monte sur la piste ce soir ?'),
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
  row.setAttribute('aria-label', 'Classes');
  row.setAttribute('aria-current', 'true');
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
    card.append(frame, el('span', 'ui-classcard__name', entry.name));
    card.addEventListener('click', (event) => {
      event.stopPropagation();
      actions.choose(entry.id);
    });
    return card;
  });
  row.append(...cards);

  const confirm = el('button', 'ui-button ui-button--primary');
  confirm.type = 'button';
  confirm.tabIndex = -1;
  const back = el('button', 'ui-button', 'Retour au titre');
  back.type = 'button';
  back.tabIndex = -1;
  confirm.addEventListener('click', () => {
    actions.confirm();
  });
  back.addEventListener('click', () => {
    actions.leave();
  });
  const footer = el('div', 'ui-lobby__actions');
  footer.append(confirm, back);
  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-lobby__body');
  body.append(header, hero, row, footer, hint);
  element.append(body);

  let device: InputDevice | null = null;

  function paintHint(): void {
    if (device === null) {
      return;
    }
    const prompts = promptsFor(device);
    fillHint(
      hint,
      [
        { keys: prompts.navigateRow, label: 'choisir' },
        { keys: [prompts.confirm], label: model.launches ? 'lancer' : 'valider' },
        { keys: [prompts.back], label: 'retour' },
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
    setText(name, chosen.name);
    setText(role, chosen.role);
    setText(skillName, chosen.skill.name);
    setText(skillRecharge, `recharge ${formatSeconds(chosen.skill.cooldownTicks)}`);
    setText(skillText, chosen.skill.description);
    stats.replaceChildren(...classStats(classes, chosen).map(statRow));
    classes.forEach((entry, index) => {
      cards[index]?.setAttribute('aria-checked', String(entry.id === chosen.id));
    });
    setText(confirm, model.launches ? 'Lancer le set' : 'Choisir la scène');
    paintHint();
  }

  paint();

  return {
    element,
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
      const delta = (edges.right || edges.down ? 1 : 0) - (edges.left || edges.up ? 1 : 0);
      const next = delta === 0 ? null : stepClass(classes, model.classId, delta);
      if (edges.back) {
        actions.leave();
      } else if (edges.confirm) {
        actions.confirm();
      } else if (next !== null) {
        actions.choose(next);
      }
    },
  };
}
