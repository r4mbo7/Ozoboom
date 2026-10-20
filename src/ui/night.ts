import { t } from '../shared/i18n';
import type { MenuIntents } from '../input/intents';
import { el, icon, keycap, setText } from './dom';
import { formatNumber } from './format';
import { INFINITY, STAGES, SUNRISE } from './icons';
import { FULL_NIGHTS } from './full';
import type { Night, StageCard } from './types';

// A festival walks about twenty seconds from one stage to the next.
const PATH_MINUTES = 1 / 3;

// The nights a player can choose from: one stage, endless, and in the full game the whole festival.
export function nightsOffered(): readonly Night[] {
  return FULL_NIGHTS.festival === true ? ['stage', 'endless', 'festival'] : ['stage', 'endless'];
}

export function nightOf(model: { endless?: boolean; festival?: boolean }): Night {
  if (model.festival === true) {
    return 'festival';
  }
  return model.endless === true ? 'endless' : 'stage';
}

// The night after `night`, `direction` steps along the choices, wrapping.
export function stepNight(nights: readonly Night[], night: Night, direction: number): Night {
  const index = nights.indexOf(night);
  const count = nights.length;
  return nights[(((index + direction) % count) + count) % count] ?? night;
}

function nameOf(night: Night): string {
  switch (night) {
    case 'stage':
      return t('Une scène');
    case 'endless':
      return t('Sans fin');
    case 'festival':
      return t('Full festival');
  }
}

function lineOf(night: Night): string {
  switch (night) {
    case 'stage':
      return t('Un set, jusqu’au sunrise');
    case 'endless':
      return t('Après le dernier boss, la nuit continue');
    case 'festival':
      return t('Les quatre scènes, d’un chemin à l’autre');
  }
}

const ICONS: Readonly<Record<Night, string>> = {
  stage: SUNRISE,
  endless: INFINITY,
  festival: STAGES,
};

const minutes = (count: number) => t('≈ {minutes} min', { minutes: formatNumber(count) });

// How long a night lasts: the stage picked, the whole festival with its walks, or as long as the team holds.
export function nightLength(night: Night, stages: readonly StageCard[], stageId: string): string {
  switch (night) {
    case 'stage':
      return minutes(stages.find((stage) => stage.setId === stageId)?.minutes ?? 0);
    case 'endless':
      return t('tant que vous tenez');
    case 'festival':
      return minutes(
        Math.round(
          stages.reduce((sum, stage) => sum + stage.minutes, 0) +
            Math.max(0, stages.length - 1) * PATH_MINUTES,
        ),
      );
  }
}

// The title of the stage choice: in a festival, the stage picked is only the first.
export function stageQuestion(night: Night): string {
  return night === 'festival' ? t('Par où commence la nuit ?') : t('Choisis la scène');
}

// What follows the stage picked, under the cards.
export function nightNote(night: Night): string {
  switch (night) {
    case 'stage':
      return '';
    case 'endless':
      return t(
        'Le set va jusqu’au dernier boss, puis la nuit repart : elle s’arrête quand vous tombez.',
      );
    case 'festival':
      return t('Les autres scènes suivent : à chaque sunrise, l’équipe choisit sa sortie.');
  }
}

// What the launch button says for that night.
export function launchLabel(night: Night): string {
  switch (night) {
    case 'stage':
      return t('Lancer le set');
    case 'endless':
      return t('Lancer la nuit');
    case 'festival':
      return t('Lancer le festival');
  }
}

// What the launch button launches, under its label.
export function launchDetail(night: Night, stages: readonly StageCard[], stageId: string): string {
  const stage = stages.find((card) => card.setId === stageId);
  const name = stage === undefined ? '' : t(stage.name);
  switch (night) {
    case 'stage':
      return `${name} · ${nightLength(night, stages, stageId)}`;
    case 'endless':
      return `${name} · ${t('sans fin')}`;
    case 'festival':
      return t('départ {stage} · {count} scènes · {length}', {
        stage: name,
        count: formatNumber(stages.length),
        length: nightLength(night, stages, stageId),
      });
  }
}

export interface NightTabs {
  readonly element: HTMLElement;
  // The night chosen, and the line under the tabs that says what it is and how long it lasts.
  set(night: Night, length: string): void;
  // The keys that step through the tabs, shown on either side; none on a touch screen.
  setKeys(keys: readonly string[], style: 'key' | 'button'): void;
  // A guest sees the host's night and cannot change it.
  setReadonly(readonly: boolean): void;
  // True when the presses stepped the tabs.
  handle(edges: MenuIntents): boolean;
}

// The nights as tabs over the stage choice, always in sight: the previous and next tab keys step through them
// from anywhere on the screen, a click or a touch picks one.
export function createNightTabs(onChoose: (night: Night) => void): NightTabs {
  const nights = nightsOffered();
  let night: Night = 'stage';
  let locked = false;
  const element = el('div', 'ui-nights');
  const row = el('div', 'ui-nights__row');
  const before = el('span', 'ui-nights__key');
  const after = el('span', 'ui-nights__key');
  const list = el('div', 'ui-nights__tabs');
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', t('Mode de jeu'));
  const tabs = nights.map((one) => {
    const tab = el('button', 'ui-nights__tab');
    tab.type = 'button';
    tab.tabIndex = -1;
    tab.setAttribute('role', 'tab');
    tab.dataset.night = one;
    tab.append(icon('ui-nights__icon', ICONS[one]), el('span', 'ui-nights__name', nameOf(one)));
    tab.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!locked && one !== night) {
        onChoose(one);
      }
    });
    return tab;
  });
  list.append(...tabs);
  row.append(before, list, after);
  const line = el('p', 'ui-nights__line');
  const what = el('span', 'ui-nights__what');
  const length = el('span', 'ui-nights__length');
  line.append(what, length);
  element.append(row, line);

  return {
    element,
    set(next, lasts) {
      night = next;
      for (const tab of tabs) {
        tab.setAttribute('aria-selected', String(tab.dataset.night === night));
      }
      setText(what, lineOf(night));
      setText(length, lasts);
    },
    setKeys(keys, style) {
      const [previous, next] = keys;
      before.replaceChildren(...(previous === undefined ? [] : [keycap(previous, style)]));
      after.replaceChildren(...(next === undefined ? [] : [keycap(next, style)]));
    },
    setReadonly(readonly) {
      locked = readonly;
      element.toggleAttribute('data-readonly', readonly);
      list.setAttribute('aria-disabled', String(readonly));
    },
    handle(edges) {
      const direction = (edges.next ? 1 : 0) - (edges.previous ? 1 : 0);
      if (direction === 0) {
        return false;
      }
      if (!locked) {
        onChoose(stepNight(nights, night, direction));
      }
      return true;
    },
  };
}
