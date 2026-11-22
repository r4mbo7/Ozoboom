import type { SetDefinition } from '../data/types';
import { t } from '../shared/i18n';
import type { SimState } from '../sim/state';
import { el, icon, replay, setFlag, setText } from './dom';
import { formatNumber } from './format';
import { momentReading, strikesNow, tierStages } from './hud-model';
import { BOSS_MASK, INFINITY, SUN } from './icons';

export interface LineupRibbon {
  readonly element: HTMLElement;
  build(set: SetDefinition): void;
  update(set: SetDefinition, state: SimState): void;
}

function endlessMark(from: number | null | undefined): string | undefined {
  return from === undefined ? undefined : from === null ? 'ahead' : 'on';
}

function tierMask(index: number): HTMLElement {
  // The drop keeps its slot class: the full game hangs the campfire's extra bosses on it.
  const drop = el('span', 'ui-slot ui-slot--drop');
  drop.title = t('Tier {tier}, drop', { tier: formatNumber(index + 1) });
  drop.append(icon('ui-slot__mask', BOSS_MASK));
  return drop;
}

function sunriseNode(): HTMLElement {
  const node = el('span', 'ui-slot ui-slot--sunrise');
  node.title = t('Sunrise');
  node.append(icon('ui-slot__sun', SUN), icon('ui-slot__endless', INFINITY));
  return node;
}

// An endless game has no sunrise: its last slot says so, lit once the last boss fell.
function paintEndless(sunrise: HTMLElement, from: number | null | undefined): void {
  if (sunrise.dataset.endless === endlessMark(from)) {
    return;
  }
  if (from === undefined) {
    delete sunrise.dataset.endless;
  } else {
    sunrise.dataset.endless = endlessMark(from);
  }
  sunrise.title = from === undefined ? t('Sunrise') : t('Endless');
}

export function createLineupRibbon(): LineupRibbon {
  const element = el('section', 'ui-panel ui-hud__ribbon');
  element.setAttribute('aria-label', t('Line-up'));
  const moment = el('div', 'ui-moment');
  // One boss mask per tier, then the sunrise: on the line of the tier the set is at.
  const lineup = el('div', 'ui-lineup');
  lineup.setAttribute('role', 'img');
  const word = el('span', 'ui-moment__word');
  const countdown = el('span', 'ui-moment__countdown');
  countdown.setAttribute('role', 'timer');
  countdown.setAttribute('aria-label', t('Drop'));
  const now = el('span', 'ui-moment__now');
  now.append(word, countdown);
  moment.append(lineup, now);
  element.append(moment);

  let masks: HTMLElement[] = [];
  const sunrise = sunriseNode();
  let beatsToDrop = 0;

  function paintMoment(set: SetDefinition, state: SimState): void {
    const reading = momentReading(set, state);
    const label = reading.tier || reading.word;
    if (lineup.getAttribute('aria-label') !== label) {
      lineup.setAttribute('aria-label', label);
    }
    setText(word, reading.word);
    setText(countdown, reading.countdown);
    countdown.hidden = reading.countdown === '';
    if (moment.dataset.moment !== reading.moment) {
      moment.dataset.moment = reading.moment;
    }
    setFlag(element, 'drop', reading.moment === 'drop');
    if (countdown.dataset.strike !== reading.strike) {
      countdown.dataset.strike = reading.strike;
    }
    if (strikesNow(reading, beatsToDrop)) {
      replay(countdown, 'beat');
    }
    beatsToDrop = reading.beatsToDrop;
  }

  return {
    element,
    build(set) {
      masks = set.tiers.map((_, index) => tierMask(index));
      lineup.replaceChildren(...masks, sunrise);
    },
    update(set, state) {
      tierStages(set, state).forEach((stage, index) => {
        const mask = masks[index];
        if (mask !== undefined && mask.dataset.state !== stage) {
          mask.dataset.state = stage;
        }
      });
      sunrise.dataset.state = state.status === 'won' ? 'current' : 'next';
      paintEndless(sunrise, state.set.endlessFromTick);
      paintMoment(set, state);
    },
  };
}
