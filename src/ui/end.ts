import type { GameContent } from '../data/types';
import type { InputDevice } from '../input/intents';
import { t } from '../shared/i18n';
import type { SimState } from '../sim/state';
import { el, fillHint, icon, setText } from './dom';
import { createActionButton, createFeedbackButton } from './feedback-button';
import { openDiscord } from './discord';
import { endStats, formatDuration } from './format';
import { DISCORD, FOG, SUN } from './icons';
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

const sunrise = (): Ending => ({
  title: t('Sunrise\u202f!'),
  text: t('Le soleil se lève sur le dancefloor. Le sound system a tenu toute la nuit.'),
});

const silence = (): Ending => ({
  title: t('La musique s’arrête'),
  text: t('Les bad vibes ont eu raison du sound system. On rebranche et on y retourne\u202f?'),
});

const emptyFloor = (): Ending => ({
  title: t('Plus personne debout'),
  text: t(
    'Le sound system tient bon, mais les bad vibes ont vidé la piste. On se relève et on y retourne\u202f?',
  ),
});

// The sim loses on a silent scene before it looks at the players: so does the text.
export function endingOf(state: SimState): Ending {
  if (state.status === 'won') {
    return sunrise();
  }
  const from = state.set.endlessFromTick;
  if (typeof from === 'number') {
    return {
      title: t('Quelle nuit\u202f!'),
      text: t(
        'Le set est allé au bout, puis le sound system a tenu {duration} de sans-fin. On y retourne\u202f?',
        { duration: formatDuration(state.tick - from) },
      ),
    };
  }
  return state.core.hp <= 0 ? silence() : emptyFloor();
}

export function createEnd(
  onRestart: () => void,
  onQuit: () => void,
  onFeedback?: () => void,
): EndScreen {
  const element = el('section', 'ui-screen ui-overlay ui-end');
  element.setAttribute('aria-label', t('Fin de partie'));
  const emblem = el('div', 'ui-end__emblem');
  const title = el('h2', 'ui-end__title');
  const text = el('p', 'ui-end__text');
  const team = el('ul', 'ui-team');
  team.setAttribute('aria-label', t('L’équipe'));
  const stats = el('dl', 'ui-stats');
  const restart = el('button', 'ui-button ui-button--primary', t('Rejouer'));
  restart.type = 'button';
  const quit = el('button', 'ui-button', t('Retour au titre'));
  quit.type = 'button';
  const feedback = onFeedback === undefined ? null : createFeedbackButton();
  const discord = createActionButton(t('L’after'), t('Débriefe ton set sur Discord'), DISCORD);
  const wait = el('p', 'ui-end__wait', t('En attente de l’hôte'));
  wait.setAttribute('role', 'status');
  wait.hidden = true;
  const actions = el('div', 'ui-end__actions');
  actions.append(restart, wait, quit, ...(feedback === null ? [] : [feedback]), discord);
  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-end__body');
  body.append(emblem, title, text, team, stats, actions, hint);
  element.append(body);

  let items: HTMLElement[] = [];
  const menu = createMenu((index) => {
    const item = items[index];
    if (item === restart) {
      onRestart();
    } else if (item === quit) {
      onQuit();
    } else if (item === discord) {
      openDiscord();
    } else {
      onFeedback?.();
    }
  });

  let device: InputDevice | null = null;

  function fillHints(): void {
    const prompts = promptsFor(device ?? 'none');
    const confirm = { keys: [prompts.confirm], label: t('valider') };
    fillHint(
      hint,
      items.length > 1 ? [{ keys: prompts.navigate, label: t('naviguer') }, confirm] : [confirm],
      prompts.style,
    );
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
            item.append(
              who,
              el('span', 'ui-team__state', player.downed ? t('À terre') : t('Debout')),
            );
            const className = content?.classes.find((entry) => entry.id === player.classId)?.name;
            if (className !== undefined) {
              item.insertBefore(el('span', 'ui-team__class', t(className)), item.lastChild);
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
      // A guest cannot restart: only the host does.
      const guest = session?.role === 'guest';
      restart.hidden = guest;
      wait.hidden = !guest;
      items = [
        ...(guest ? [] : [restart]),
        quit,
        ...(feedback === null ? [] : [feedback]),
        discord,
      ];
      menu.setItems(items);
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
