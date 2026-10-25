import { t } from '../shared/i18n';
import type { MenuIntents } from '../input/intents';
import { wrap } from '../shared/scalar';
import { el, icon, keycap, setText } from './dom';
import { formatNumber } from './format';
import { INFINITY, STAGES, SUNRISE } from './icons';
import { FULL_NIGHTS } from './full';
import type { Night, StageCard } from './types';

// A festival walks about twenty seconds from one stage to the next.
const PATH_MINUTES = 1 / 3;

export function nightsOffered(): readonly Night[] {
  return FULL_NIGHTS.festival === true ? ['stage', 'endless', 'festival'] : ['stage', 'endless'];
}

export function nightOf(model: { endless?: boolean; festival?: boolean }): Night {
  if (model.festival === true) {
    return 'festival';
  }
  return model.endless === true ? 'endless' : 'stage';
}

export function stepNight(nights: readonly Night[], night: Night, direction: number): Night {
  const index = nights.indexOf(night);
  return nights[wrap(index + direction, nights.length)] ?? night;
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

export function stageQuestion(night: Night): string {
  return night === 'festival' ? t('Par où commence la nuit ?') : t('Choisis la scène');
}

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
  set(night: Night, length: string): void;
  // None on a touch screen.
  setKeys(keys: readonly string[], style: 'key' | 'button'): void;
  // A guest sees the host's night and cannot change it.
  setReadonly(readonly: boolean): void;
  // True when the presses stepped the tabs.
  handle(edges: MenuIntents): boolean;
}

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
