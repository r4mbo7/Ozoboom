import { t } from '../shared/i18n';
import { attackReach } from '../sim/attacks';
import type { ClassInfo } from './class-picker';
import { el, setText } from './dom';
import { formatNumber, formatSeconds, formatTenth } from './format';

const STAT_STEPS = 5;

interface ClassStat {
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

function statRow(stat: ClassStat): HTMLElement {
  const row = el('div', 'ui-sheet__stat');
  const steps = el('span', 'ui-sheet__steps');
  steps.setAttribute('aria-hidden', 'true');
  for (let index = 1; index <= STAT_STEPS; index += 1) {
    const step = el('i', 'ui-sheet__step');
    step.toggleAttribute('data-on', index <= stat.steps);
    steps.append(step);
  }
  row.append(
    el('span', 'ui-sheet__label', stat.label),
    steps,
    el('span', 'ui-sheet__value', stat.value),
  );
  return row;
}

// What a class does and how it measures against the others.
export interface ClassSheet {
  readonly parts: readonly HTMLElement[];
  set(info: ClassInfo): void;
}

export function createClassSheet(classes: readonly ClassInfo[]): ClassSheet {
  const role = el('p', 'ui-sheet__role');
  const recharge = el('span', 'ui-sheet__recharge');
  const head = el('p', 'ui-sheet__skillhead');
  head.append(el('span', 'ui-sheet__skilllabel', t('Spéciale')), recharge);
  const skillName = el('p', 'ui-sheet__skillname');
  const skillText = el('p', 'ui-sheet__skilltext');
  const skill = el('div', 'ui-sheet__skill');
  skill.append(head, skillName, skillText);
  const stats = el('div', 'ui-sheet__stats');

  return {
    parts: [role, stats, skill],
    set(info) {
      setText(role, t(info.role));
      setText(skillName, t(info.skill.name));
      setText(
        recharge,
        t('recharge {duration}', { duration: formatSeconds(info.skill.cooldownTicks) }),
      );
      setText(skillText, t(info.skill.description));
      stats.replaceChildren(...classStats(classes, info).map(statRow));
    },
  };
}
