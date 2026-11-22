import { t } from '../shared/i18n';
import { el, setText } from './dom';
import { formatNumber } from './format';
import { PIPS } from './programme/figures';
import type { PropLine, StatsProp, StatsRow, StatsSheet, StatsSteps } from './stats-model';
import { whoColor } from './who';

export type StatsSheetSize = 'panel' | 'pause' | 'card';

export interface StatsSheetView {
  readonly element: HTMLElement;
  update(sheet: StatsSheet): void;
}

function stepsOf(steps: StatsSteps | null): HTMLElement {
  const node = el('span', 'ui-stats__steps');
  node.setAttribute('aria-hidden', 'true');
  if (steps === null) {
    return node;
  }
  const start = Math.min(steps.start, steps.now);
  for (let index = 1; index <= PIPS; index += 1) {
    const step = el('i', 'ui-stats__step');
    if (index <= start) {
      step.setAttribute('data-on', 'start');
    } else if (index <= steps.now) {
      step.setAttribute('data-on', 'gain');
    }
    node.append(step);
  }
  return node;
}

// The value, or before → after on the line the previewed card changes; its unit small after.
function valueOf(row: StatsRow): HTMLElement {
  const node = el('span', 'ui-stats__value');
  if (row.after === undefined) {
    node.textContent = row.text;
  } else {
    node.append(
      el('span', 'ui-stats__before', row.text),
      el('span', 'ui-stats__to', '→'),
      el('span', 'ui-stats__after', row.after),
    );
  }
  if (row.unit !== '') {
    node.append(el('small', 'ui-stats__unit', row.unit));
  }
  return node;
}

function gainOf(row: StatsRow): HTMLElement {
  return el('span', 'ui-stats__gain', row.after === undefined ? row.gain : '▲');
}

function statRow(row: StatsRow): HTMLElement {
  const node = el('div', 'ui-stats__row');
  node.toggleAttribute('data-lit', row.after !== undefined);
  node.append(
    el('span', 'ui-stats__label', row.label),
    stepsOf(row.steps),
    valueOf(row),
    gainOf(row),
  );
  return node;
}

function specialRow(name: string, row: StatsRow): HTMLElement {
  const node = el('div', 'ui-stats__specialrow');
  node.toggleAttribute('data-lit', row.after !== undefined);
  node.append(
    el('span', 'ui-stats__specialname', name),
    el('span', 'ui-stats__label', row.label),
    valueOf(row),
    gainOf(row),
  );
  return node;
}

const changeOf = (before: string, after: string | undefined): string =>
  after === undefined || after === before ? before : before === '' ? after : `${before} → ${after}`;

function propChip(prop: StatsProp): HTMLElement {
  const level = (line: PropLine): string =>
    line.level === 0 ? '' : t('Lv. {level}', { level: formatNumber(line.level) });
  const hit = (line: PropLine): string =>
    line.hit === null ? '' : t('{damage}/hit', { damage: line.hit });
  const { after } = prop;
  const node = el('span', 'ui-stats__prop');
  node.toggleAttribute('data-lit', after !== undefined);
  node.append(
    el('span', 'ui-stats__propname', changeOf(prop.name, after?.name)),
    el('b', 'ui-stats__level', changeOf(level(prop), after && level(after))),
    el('span', 'ui-stats__hit', changeOf(hit(prop), after && hit(after))),
  );
  return node;
}

export function createStatsSheet(size: StatsSheetSize): StatsSheetView {
  const element = el('div', `ui-stats ui-stats--${size}`);
  const who = el('span', 'ui-stats__who');
  const name = el('span', 'ui-stats__name');
  const head = el('div', 'ui-stats__head');
  head.append(who, name);
  const rows = el('div', 'ui-stats__rows');
  const recharge = el('span', 'ui-stats__recharge');
  const rechargeGain = el('span', 'ui-stats__gain');
  const specialHead = el('p', 'ui-stats__specialhead');
  specialHead.append(el('span', 'ui-stats__speciallabel', t('Special')), recharge, rechargeGain);
  const specialRows = el('div', 'ui-stats__specialrows');
  const special = el('div', 'ui-stats__special');
  special.append(specialHead, specialRows);
  const props = el('div', 'ui-stats__props');
  element.append(head, rows, special, props);
  // The panel updates on every frame: the same sheet leaves the page as it is.
  let shown = '';

  return {
    element,
    update(sheet) {
      const key = JSON.stringify(sheet);
      if (key === shown) {
        return;
      }
      shown = key;
      element.style.setProperty('--who', whoColor(sheet.classId));
      setText(who, sheet.player);
      setText(name, sheet.className);
      rows.replaceChildren(...sheet.rows.map(statRow));
      const cooldown = sheet.special.recharge;
      setText(
        recharge,
        t('cooldown {duration}', { duration: changeOf(cooldown.text, cooldown.after) }),
      );
      recharge.toggleAttribute('data-lit', cooldown.after !== undefined);
      setText(rechargeGain, cooldown.after === undefined ? cooldown.gain : '');
      specialRows.replaceChildren(
        ...sheet.special.rows.map((row, index) =>
          specialRow(index === 0 ? sheet.special.name : '', row),
        ),
      );
      props.replaceChildren(...sheet.props.map(propChip));
    },
  };
}
