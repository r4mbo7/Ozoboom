import type { GameContent } from '../data/types';
import type { InputDevice } from '../input/intents';
import type { SimState } from '../sim/state';
import { el, fillHint, icon, setText } from './dom';
import { createFeedbackButton } from './feedback-button';
import { endStats } from './format';
import { FOG, SUN } from './icons';
import { type Menu, createMenu } from './menu';
import { promptsFor } from './prompts';
import type { EndSession } from './types';
import { createWho, fillWho, whoColor } from './who';

export interface EndScreen {
  readonly element: HTMLElement;
  readonly menu: Menu;
  show(state: SimState, content: GameContent | null, session: EndSession | undefined): void;
  setDevice(device: InputDevice): void;
}

export interface Ending {
  title: string;
  text: string;
}

const SUNRISE: Ending = {
  title: 'Sunrise\u202f!',
  text: 'Le soleil se lève sur le dancefloor. Le sound system a tenu toute la nuit.',
};

const SILENCE: Ending = {
  title: 'La musique s’arrête',
  text: 'Les bad vibes ont eu raison du sound system. On rebranche et on y retourne\u202f?',
};

const EMPTY_FLOOR: Ending = {
  title: 'Plus personne debout',
  text: 'Le sound system tient bon, mais les bad vibes ont vidé la piste. On se relève et on y retourne\u202f?',
};

// The sim loses on a silent scene before it looks at the players: so does the text.
export function endingOf(state: SimState): Ending {
  if (state.status === 'won') {
    return SUNRISE;
  }
  return state.core.hp <= 0 ? SILENCE : EMPTY_FLOOR;
}

export function createEnd(onRestart: () => void, onFeedback?: () => void): EndScreen {
  const element = el('section', 'ui-screen ui-overlay ui-end');
  element.setAttribute('aria-label', 'Fin de partie');
  const emblem = el('div', 'ui-end__emblem');
  const title = el('h2', 'ui-end__title');
  const text = el('p', 'ui-end__text');
  const team = el('ul', 'ui-team');
  team.setAttribute('aria-label', 'L’équipe');
  const stats = el('dl', 'ui-stats');
  const restart = el('button', 'ui-button ui-button--primary', 'Rejouer');
  restart.type = 'button';
  const feedback = onFeedback === undefined ? null : createFeedbackButton();
  const wait = el('p', 'ui-end__wait', 'En attente de l’hôte');
  wait.setAttribute('role', 'status');
  wait.hidden = true;
  const actions = el('div', 'ui-end__actions');
  actions.append(...(feedback === null ? [restart] : [restart, feedback]), wait);
  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-end__body');
  body.append(emblem, title, text, team, stats, actions, hint);
  element.append(body);

  // A guest cannot restart: only the host does.
  let guest = false;
  const menu = createMenu((index) => {
    if (feedback !== null && (guest || index === 1)) {
      onFeedback?.();
    } else {
      onRestart();
    }
  });

  let device: InputDevice | null = null;

  function fillHints(): void {
    const prompts = promptsFor(device ?? 'none');
    const press = { keys: [prompts.confirm], label: guest ? 'valider' : 'rejouer' };
    if (feedback === null) {
      fillHint(hint, guest ? [] : [press], prompts.style);
    } else if (guest) {
      fillHint(hint, [{ keys: [prompts.confirm], label: 'valider' }], prompts.style);
    } else {
      fillHint(
        hint,
        [
          { keys: prompts.navigate, label: 'naviguer' },
          { keys: [prompts.confirm], label: 'valider' },
        ],
        prompts.style,
      );
    }
  }

  function fillTeam(state: SimState, content: GameContent | null): void {
    const shown = state.players.length > 1;
    team.hidden = !shown;
    team.replaceChildren(
      ...(shown
        ? state.players.map((player) => {
            const who = createWho();
            fillWho(who, player);
            const item = el('li', 'ui-team__member');
            item.dataset.downed = String(player.downed);
            item.style.setProperty('--who', whoColor(player.classId));
            item.append(who, el('span', 'ui-team__state', player.downed ? 'À terre' : 'Debout'));
            const className = content?.classes.find((entry) => entry.id === player.classId)?.name;
            if (className !== undefined) {
              item.insertBefore(el('span', 'ui-team__class', className), item.lastChild);
            }
            return item;
          })
        : []),
    );
  }

  return {
    element,
    menu,
    show(state, content, session) {
      const won = state.status === 'won';
      element.dataset.outcome = won ? 'won' : 'lost';
      emblem.replaceChildren(icon('ui-end__icon', won ? SUN : FOG));
      const ending = endingOf(state);
      setText(title, ending.title);
      setText(text, ending.text);
      fillTeam(state, content);
      stats.replaceChildren(
        ...endStats(state).map((stat) => {
          const item = el('div', 'ui-stats__item');
          item.append(
            el('dt', 'ui-stats__label', stat.label),
            el('dd', 'ui-stats__value', stat.value),
          );
          return item;
        }),
      );
      guest = session?.role === 'guest';
      restart.hidden = guest;
      wait.hidden = !guest;
      const open = feedback === null ? [] : [feedback];
      menu.setItems(guest ? open : [restart, ...open]);
      fillHints();
    },
    setDevice(next) {
      if (next === device) {
        return;
      }
      device = next;
      fillHints();
    },
  };
}
