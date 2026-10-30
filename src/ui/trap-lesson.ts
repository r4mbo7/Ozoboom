import type { GameContent } from '../data/types';
import { t } from '../shared/i18n';
import { beatPeriodMs } from '../shared/tempo';
import { setTempo } from '../sim/lineup';
import type { SimState } from '../sim/state';
import { el, fillHint, icon, setVar } from './dom';
import { classToken } from './hud-model';
import { trapIcon } from './icons';
import type { DevicePrompts } from './prompts';
import { cssName } from './sun';

export interface TrapLesson {
  readonly element: HTMLElement;
  show(state: SimState, content: GameContent | null): void;
  setDevice(shown: DevicePrompts): void;
}

// A game lost while no trap ever stood on the field: the end screen shows what a trap does.
export function lostWithoutTrap(
  state: Pick<SimState, 'status' | 'traps'>,
  stood: boolean,
): boolean {
  return state.status === 'lost' && !stood && state.traps.length === 0;
}

const CAISSON = trapIcon({ kind: 'shockwave', damage: 0, radius: 0, knockback: 0 });

const FOE =
  '<rect x="3" y="2.5" width="18" height="19" rx="7" fill="var(--bad-vibe)" stroke="var(--bad-vibe-rim)" stroke-width="1.6"/>' +
  '<path d="M7.5 8.5l3 2M16.5 8.5l-3 2M9 16.5q3-2.4 6 0" fill="none" stroke="var(--bad-vibe-rim)" stroke-width="1.6" stroke-linecap="round"/>';

const GOER =
  '<ellipse cx="12" cy="12" rx="6.5" ry="9" fill="var(--who)" stroke="rgba(4,6,18,.9)" stroke-width="1.6"/>' +
  '<circle cx="13.5" cy="12" r="4.6" fill="#f1c7a0" stroke="rgba(4,6,18,.9)" stroke-width="1.3"/>' +
  '<circle cx="12.6" cy="12" r="3.3" fill="#3a2414"/>';

function scene(): HTMLElement {
  const window = el('div', 'ui-lesson__scene');
  window.setAttribute('aria-hidden', 'true');
  const zone = el('span', 'ui-lesson__zone');
  zone.append(el('span', 'ui-lesson__ring'), icon('ui-lesson__caisson', CAISSON));
  const tile = el('span', 'ui-lesson__tile');
  tile.append(icon('ui-lesson__tile-icon', CAISSON), el('span', 'ui-lesson__tap'));
  window.append(
    zone,
    icon('ui-lesson__goer', GOER),
    icon('ui-lesson__foe ui-lesson__foe--a', FOE),
    icon('ui-lesson__foe ui-lesson__foe--b', FOE),
    tile,
  );
  return window;
}

export function createTrapLesson(): TrapLesson {
  const element = el('div', 'ui-end__lesson');
  element.hidden = true;
  const text = el('div', 'ui-lesson__text');
  const how = el('p', 'ui-lesson__how');
  text.append(el('p', 'ui-lesson__title', t('Les pièges freinent les bad vibes')), how);
  element.append(scene(), text);

  return {
    element,
    show(state, content) {
      const set = content?.sets.find((entry) => entry.id === state.setId);
      if (set !== undefined) {
        setVar(element, '--beat', `${beatPeriodMs(setTempo(set).bpm).toFixed(1)}ms`);
      }
      const player = state.players[0];
      if (player !== undefined) {
        setVar(element, '--who', `var(${cssName(classToken(player.classId))})`);
      }
    },
    setDevice(shown) {
      if (shown.placeTrap === '') {
        how.replaceChildren(t('Touche le bouton d’un piège pour le poser à tes pieds'));
      } else {
        fillHint(
          how,
          [{ keys: [shown.placeTrap], label: t('pose le piège à tes pieds') }],
          shown.style,
        );
      }
    },
  };
}
