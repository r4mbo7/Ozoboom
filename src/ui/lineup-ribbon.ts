import type { SetDefinition } from '../data/types';
import { t } from '../shared/i18n';
import { setFraction } from '../sim/lineup';
import type { SimState } from '../sim/state';
import { el, icon, setFlag, setText, setVar } from './dom';
import { formatNumber } from './format';
import { type TierReading, isNight, momentReading, tierReadings } from './hud-model';
import { BOSS_MASK, INFINITY, MOON, SUN } from './icons';

export interface LineupRibbon {
  readonly element: HTMLElement;
  build(set: SetDefinition): void;
  update(set: SetDefinition, state: SimState): void;
}

interface TierNodes {
  bar: HTMLElement;
  drop: HTMLElement;
}

function endlessMark(from: number | null | undefined): string | undefined {
  return from === undefined ? undefined : from === null ? 'ahead' : 'on';
}

function tierNodes(set: SetDefinition): { tiers: TierNodes[]; groups: HTMLElement[] } {
  const tiers = set.tiers.map((_, index) => {
    const bar = el('span', 'ui-lineup__bar');
    // The drop keeps its slot class: the full game hangs the campfire's extra bosses on it.
    const drop = el('span', 'ui-slot ui-slot--drop');
    drop.title = t('Palier {tier}, drop', { tier: formatNumber(index + 1) });
    drop.append(icon('ui-slot__mask', BOSS_MASK));
    return { bar, drop };
  });
  const groups = tiers.map(({ bar, drop }) => {
    const group = el('div', 'ui-lineup__tier');
    group.append(bar, drop);
    return group;
  });
  return { tiers, groups };
}

function sunriseNode(): HTMLElement {
  const node = el('span', 'ui-slot ui-slot--sunrise');
  node.title = t('Sunrise');
  node.append(icon('ui-slot__sun', SUN), icon('ui-slot__endless', INFINITY));
  return node;
}

function paintTier({ bar, drop }: TierNodes, { stage, fill }: TierReading): void {
  if (bar.dataset.state !== stage) {
    bar.dataset.state = stage;
    drop.dataset.state = stage === 'dropping' ? 'current' : stage === 'done' ? 'done' : 'next';
    setFlag(drop, 'open', stage === 'dropping');
  }
  setVar(bar, '--fill', fill.toFixed(3));
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
  sunrise.title = from === undefined ? t('Sunrise') : t('Sans fin');
}

export function createLineupRibbon(): LineupRibbon {
  const element = el('section', 'ui-panel ui-hud__ribbon');
  element.setAttribute('aria-label', t('Line-up'));
  const moment = el('div', 'ui-moment');
  const sky = el('span', 'ui-moment__sky');
  const tier = el('span', 'ui-moment__tier');
  const word = el('span', 'ui-moment__word');
  const countdown = el('span', 'ui-moment__countdown');
  countdown.setAttribute('role', 'timer');
  countdown.setAttribute('aria-label', t('Drop'));
  const now = el('span', 'ui-moment__now');
  now.append(word, countdown);
  const text = el('span', 'ui-moment__text');
  text.append(tier, now);
  moment.append(sky, text);
  const track = el('div', 'ui-lineup');
  const timeline = el('div', 'ui-panel ui-hud__timeline');
  timeline.append(track);
  element.append(moment, timeline);

  let tiers: TierNodes[] = [];
  const sunrise = sunriseNode();
  let night: boolean | null = null;

  function paintMoment(set: SetDefinition, state: SimState): void {
    const reading = momentReading(set, state);
    setText(tier, reading.tier);
    tier.hidden = reading.tier === '';
    setText(word, reading.word);
    setText(countdown, reading.countdown);
    countdown.hidden = reading.countdown === '';
    if (moment.dataset.moment !== reading.moment) {
      moment.dataset.moment = reading.moment;
    }
    setFlag(element, 'drop', reading.moment === 'drop');
  }

  function paintSky(fraction: number): void {
    const isNightNow = isNight(fraction);
    if (isNightNow !== night) {
      night = isNightNow;
      sky.replaceChildren(icon('ui-moment__glyph', isNightNow ? MOON : SUN));
    }
  }

  return {
    element,
    build(set) {
      const nodes = tierNodes(set);
      tiers = nodes.tiers;
      track.replaceChildren(...nodes.groups, sunrise);
    },
    update(set, state) {
      tierReadings(set, state).forEach((reading, index) => {
        const nodes = tiers[index];
        if (nodes !== undefined) {
          paintTier(nodes, reading);
        }
      });
      sunrise.dataset.state = state.status === 'won' ? 'current' : 'next';
      paintEndless(sunrise, state.set.endlessFromTick);
      paintMoment(set, state);
      paintSky(setFraction(set, state));
    },
  };
}
