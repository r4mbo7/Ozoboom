import { TUTORIAL } from '../data/tutorial';
import type { GameContent } from '../data/types';
import type { InputDevice } from '../input/intents';
import { t } from '../shared/i18n';
import { scoreOf } from '../sim/score';
import type { FestivalState, SimState } from '../sim/state';
import { el, fillHint, icon, setText } from './dom';
import { createActionButton, createFeedbackButton } from './feedback-button';
import { openDiscord } from './discord';
import { type PlayerCard, playerCards, turnCard } from './end-cards';
import { endStats, formatDuration, formatNumber } from './format';
import { DISCORD, FOG, SUN } from './icons';
import { type Menu, createMenu } from './menu';
import type { Prompts } from './prompts';
import type { Ending } from './end-parts';
import { FULL_END } from './full';
import { createTrapLesson } from './trap-lesson';
import type { EndSession } from './types';

export interface EndScreen {
  readonly element: HTMLElement;
  readonly menu: Menu;
  // `best`: the record of this device before the game, null for its first; `trapless`: no trap
  // ever stood on the field.
  show(
    state: SimState,
    content: GameContent | null,
    session: EndSession | undefined,
    best: number | null,
    trapless: boolean,
  ): void;
  setDevice(device: InputDevice): void;
}

export type { Ending } from './end-parts';

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

// A player alone who fell before the first boss of the night is offered the tutorial.
export function offersTutorial(state: {
  readonly status: SimState['status'];
  readonly players: readonly unknown[];
  readonly set: Pick<SimState['set'], 'tier'>;
  readonly setId: string;
  readonly festival?: Pick<FestivalState, 'scenes'>;
}): boolean {
  return (
    state.status === 'lost' &&
    state.players.length === 1 &&
    state.set.tier === 0 &&
    (state.festival?.scenes.length ?? 1) === 1 &&
    state.setId !== TUTORIAL.id
  );
}

export function createEnd(
  prompts: Prompts,
  onRestart: () => void,
  onBackToLobby: () => void,
  onQuit: () => void,
  onLearn: () => void,
  onFeedback?: () => void,
): EndScreen {
  const element = el('section', 'ui-screen ui-overlay ui-end');
  element.setAttribute('aria-label', t('Fin de partie'));
  const emblem = el('div', 'ui-end__emblem');
  const title = el('h2', 'ui-end__title');
  const text = el('p', 'ui-end__text');
  const score = el('p', 'ui-end__score');
  const scoreValue = el('strong', 'ui-end__score-value');
  const record = el('span', 'ui-end__record');
  score.append(el('span', 'ui-end__score-label', t('Score')), scoreValue, record);
  const cards = el('ul', 'ui-end__cards');
  cards.setAttribute('aria-label', t('L’équipe'));
  const lesson = createTrapLesson();
  // The lesson deals beside the cards: a phone has width to spare, not height.
  const table = el('div', 'ui-end__table');
  table.append(cards, lesson.element);
  const stats = el('dl', 'ui-end__stats');
  const restart = el('button', 'ui-button ui-button--primary');
  restart.type = 'button';
  const learn = el('button', 'ui-button', t('Apprendre à jouer'));
  learn.type = 'button';
  const lobby = el('button', 'ui-button', t('Retour au salon'));
  lobby.type = 'button';
  const quit = el('button', 'ui-button', t('Retour au titre'));
  quit.type = 'button';
  const feedback = onFeedback === undefined ? null : createFeedbackButton();
  const discord = createActionButton(t('L’after'), t('Débriefe ton set sur Discord'), DISCORD);
  const wait = el('p', 'ui-end__wait', t('En attente de l’hôte'));
  wait.setAttribute('role', 'status');
  wait.hidden = true;
  const actions = el('div', 'ui-end__actions');
  actions.append(
    restart,
    wait,
    learn,
    lobby,
    quit,
    ...(feedback === null ? [] : [feedback]),
    discord,
  );
  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-end__body');
  const details = el('div', 'ui-end__details');
  body.append(emblem, title, text, score, details, table, stats, actions, hint);
  element.append(body);

  let items: HTMLElement[] = [];
  let players: PlayerCard[] = [];
  const menu = createMenu((index) => {
    const item = items[index];
    const turned = players.find((player) => player.card === item);
    if (turned !== undefined) {
      turnCard(turned.card);
    } else if (item === restart) {
      onRestart();
    } else if (item === learn) {
      onLearn();
    } else if (item === lobby) {
      onBackToLobby();
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
    const shown = prompts.for(device ?? 'none');
    lesson.setDevice(shown);
    const confirm = { keys: [shown.confirm], label: t('valider') };
    fillHint(
      hint,
      items.length > 1 ? [{ keys: shown.navigateRow, label: t('naviguer') }, confirm] : [confirm],
      shown.style,
    );
  }

  function fillScore(points: number, best: number | null): void {
    setText(scoreValue, formatNumber(points));
    record.hidden = best === null;
    if (best === null) {
      return;
    }
    const beaten = points > best;
    record.dataset.beaten = String(beaten);
    record.replaceChildren(
      ...(beaten
        ? [
            el('span', 'ui-end__record-new', t('Nouveau record\u202f!')),
            el(
              'span',
              'ui-end__record-old',
              t('avant\u202f: {score}', { score: formatNumber(best) }),
            ),
          ]
        : [
            el(
              'span',
              'ui-end__record-old',
              t('Record\u202f: {score}', { score: formatNumber(best) }),
            ),
          ]),
    );
  }

  return {
    element,
    menu,
    show(state, content, session, best, trapless) {
      const won = state.status === 'won';
      element.dataset.outcome = won ? 'won' : 'lost';
      emblem.replaceChildren(icon('ui-end__icon', won ? SUN : FOG));
      const part = Object.values(FULL_END)
        .map((partOf) => partOf(state, content))
        .find((found) => found !== null);
      const ending = part?.ending ?? endingOf(state);
      setText(title, ending.title);
      setText(text, ending.text);
      details.replaceChildren(...(part === undefined ? [] : [part.details]));
      details.hidden = part === undefined;
      fillScore(scoreOf(state), best);
      lesson.element.hidden = !trapless;
      if (trapless) {
        lesson.show(state, content);
      }
      players = playerCards(state.players, content);
      cards.replaceChildren(...players.map((player) => player.seat));
      cards.style.setProperty('--count', String(state.players.length));
      stats.replaceChildren(
        ...endStats(state).map((stat) => {
          const item = el('div', 'ui-end__stat');
          item.append(el('dt', '', stat.label), el('dd', '', stat.value));
          return item;
        }),
      );
      const guest = session?.role === 'guest';
      const leads = session?.role === 'host';
      const learns = offersTutorial(state);
      // After the tutorial, the button plays a set of the night.
      setText(restart, state.setId === TUTORIAL.id ? t('Jouer') : t('Rejouer'));
      restart.hidden = guest;
      learn.hidden = !learns;
      lobby.hidden = !leads;
      wait.hidden = !guest;
      // The cards come before the buttons, as they read; the screen opens on the first button.
      items = [
        ...players.map((player) => player.card),
        ...(guest ? [] : [restart]),
        ...(learns ? [learn] : []),
        ...(leads ? [lobby] : []),
        quit,
        ...(feedback === null ? [] : [feedback]),
        discord,
      ];
      menu.setItems(items);
      menu.select(players.length);
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
