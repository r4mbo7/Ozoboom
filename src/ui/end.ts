import { TUTORIAL } from '../data/tutorial';
import type { GameContent } from '../data/types';
import type { InputDevice, MenuIntents } from '../input/intents';
import { t } from '../shared/i18n';
import { scoreBreakdown } from '../sim/score';
import type { FestivalState, SimState } from '../sim/state';
import { el, fillHint, icon, setFlag, setText } from './dom';
import { createActionButton, createFeedbackButton } from './feedback-button';
import { openDiscord } from './discord';
import { type PlayerCard, playerCards, turnCard } from './end-cards';
import { formatDuration, formatNumber } from './format';
import { DISCORD, FOG, SUN } from './icons';
import { createMenu } from './menu';
import type { Prompts } from './prompts';
import { tallyOf } from './score-tally';
import { createScoreTicket, setTally, tallyState } from './score-ticket';
import type { Ending } from './end-parts';
import { FULL_BOARD_LINE, FULL_END } from './full';
import { createTrapLesson } from './trap-lesson';
import type { BoardLine, EndSession } from './types';

export interface EndScreen {
  readonly element: HTMLElement;
  // While the ticket counts, every press only skips it.
  handle(edges: MenuIntents): void;
  // `best`: the record of this device before the game, null for its first; `unmoved`: nobody
  // ever moved a trap.
  show(
    state: SimState,
    content: GameContent | null,
    session: EndSession | undefined,
    best: number | null,
    unmoved: boolean,
  ): void;
  setDevice(device: InputDevice): void;
  setBoardLine(line: BoardLine | null): void;
}

export type { Ending } from './end-parts';

const sunrise = (): Ending => ({
  title: t('Sunrise!'),
  text: t('The sun rises over the dancefloor. The sound system held all night long.'),
});

const silence = (): Ending => ({
  title: t('The music stops'),
  text: t('The bad vibes got the better of the sound system. Plug back in and go again?'),
});

const emptyFloor = (): Ending => ({
  title: t('Nobody left standing'),
  text: t(
    'The sound system holds, but the bad vibes cleared the floor. Back on your feet and go again?',
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
      title: t('What a night!'),
      text: t(
        'The set went all the way, then the sound system held {duration} of endless. Go again?',
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

// `calm`: the screen arrives at rest; `graceOver`: a press or a tap from the game is spent.
export interface EndPace {
  calm(): boolean;
  graceOver(): boolean;
}

export function createEnd(
  prompts: Prompts,
  pace: EndPace,
  onRestart: () => void,
  onBackToLobby: () => void,
  onQuit: () => void,
  onLearn: () => void,
  onBoardName: (pseudo: string) => void,
  onFeedback?: () => void,
): EndScreen {
  const element = el('section', 'ui-screen ui-overlay ui-end');
  element.setAttribute('aria-label', t('End of the game'));
  const emblem = el('div', 'ui-end__emblem');
  const title = el('h2', 'ui-end__title');
  const text = el('p', 'ui-end__text');
  // The score is a button that opens its detail in the cards' place; the record ends the detail.
  const score = el('button', 'ui-end__score');
  score.type = 'button';
  score.setAttribute('aria-label', t('Score details'));
  const scoreValue = el('strong', 'ui-end__score-value');
  const opens = el('span', 'ui-end__score-open', t('Details'));
  const chevron = el('span', 'ui-end__score-chevron', '▾');
  chevron.setAttribute('aria-hidden', 'true');
  opens.append(chevron);
  score.append(el('span', 'ui-end__score-label', t('Score')), scoreValue, opens);
  const record = el('span', 'ui-end__record');
  const board = FULL_BOARD_LINE.create?.(onBoardName) ?? null;
  // The score's pill also holds what acts on the score: « Partager », its form, then the rank.
  const pill = el('div', 'ui-end__pill');
  pill.append(score, ...(board === null ? [] : [board.element]));
  const cards = el('ul', 'ui-end__cards');
  cards.setAttribute('aria-label', t('The team'));
  const lesson = createTrapLesson();
  // The lesson deals beside the cards: a phone has width to spare, not height.
  const table = el('div', 'ui-end__table');
  table.append(cards, lesson.element);
  const restart = el('button', 'ui-button ui-button--primary');
  restart.type = 'button';
  const learn = el('button', 'ui-button', t('Learn to play'));
  learn.type = 'button';
  const lobby = el('button', 'ui-button', t('Back to the lobby'));
  lobby.type = 'button';
  const quit = el('button', 'ui-button', t('Back to the title'));
  quit.type = 'button';
  const feedback = onFeedback === undefined ? null : createFeedbackButton();
  const discord = createActionButton(
    t('The afterparty'),
    t('Talk your set over on Discord'),
    DISCORD,
  );
  const wait = el('p', 'ui-end__wait', t('Waiting for the host'));
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
  const ticket = createScoreTicket(element, score, scoreValue, record);
  // The ticket counts over the cards, which wait for it to fold.
  const stage = el('div', 'ui-end__stage');
  stage.append(table, ticket.ticket);
  // The details tell how the game went, right under the title that says how it ended.
  body.append(emblem, title, details, text, pill, stage, actions, hint);
  element.append(body);

  let items: HTMLElement[] = [];
  let players: PlayerCard[] = [];
  let buttons: HTMLElement[] = [];
  const menu = createMenu((index) => {
    const item = items[index];
    const turned = players.find((player) => player.card === item);
    const counting = tallyState(element) === 'counting';
    if (counting) {
      setTally(element, 'folded');
    }
    if (item === undefined) {
      return;
    }
    if (board?.items().includes(item) === true) {
      board.activate(item);
      // « Partager » gives its place to the form, whose field takes the selection.
      const shown = board.items();
      settle(shown.includes(item) ? item : (shown[0] ?? score));
    } else if (item === score) {
      // A press on the score while it counts only skips the count.
      if (!counting) {
        setTally(element, tallyState(element) === 'open' ? 'folded' : 'open');
      }
    } else if (turned !== undefined) {
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

  // A tap off the buttons skips the count; off the open ticket, it folds it.
  element.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const state = tallyState(element);
    if (state === 'counting' && pace.graceOver() && !inside(target, '.ui-button')) {
      setTally(element, 'folded');
    } else if (state === 'open' && !inside(target, '.ui-end__ticket, .ui-end__score')) {
      setTally(element, 'folded');
    }
  });

  // The menu follows the ticket: the cards it replaces when open leave it.
  element.addEventListener('tally', () => {
    settle(items[menu.index] ?? score);
  });
  // « Partager » arrives as the reward of a count that lands on its own; skipped or calm, at once.
  element.addEventListener('landed', () => {
    setFlag(pill, 'arrive', true);
  });
  function settle(selected: HTMLElement): void {
    const open = tallyState(element) === 'open';
    items = [
      score,
      ...(board?.items() ?? []),
      ...(open ? [] : players.map((player) => player.card)),
      ...buttons,
    ];
    menu.setItems(items, Math.max(0, items.indexOf(selected)));
    fillHints();
  }

  function fillHints(): void {
    const shown = prompts.for(device ?? 'none');
    lesson.setDevice(shown);
    const state = tallyState(element);
    const confirm = { keys: [shown.confirm], label: t('confirm') };
    fillHint(
      hint,
      state === 'counting'
        ? [{ keys: [shown.confirm], label: t('skip') }]
        : [
            { keys: shown.navigateRow, label: t('navigate') },
            confirm,
            ...(state === 'open' ? [{ keys: [shown.back], label: t('collapse') }] : []),
          ],
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
    // A record beaten says so alone: the old one no longer matters.
    record.replaceChildren(
      beaten
        ? el('span', 'ui-end__record-new', t('New record!'))
        : el('span', 'ui-end__record-old', t('Record: {score}', { score: formatNumber(best) })),
    );
  }

  return {
    element,
    handle(edges) {
      const state = tallyState(element);
      if (state === 'counting') {
        if (pressed(edges)) {
          setTally(element, 'folded');
        }
      } else if (state === 'open' && edges.back) {
        setTally(element, 'folded');
      } else {
        menu.handle(edges);
      }
    },
    show(state, content, session, best, unmoved) {
      const won = state.status === 'won';
      element.dataset.outcome = won ? 'won' : 'lost';
      emblem.replaceChildren(icon('ui-end__icon', won ? SUN : FOG));
      const part = Object.values(FULL_END)
        .map((partOf) => partOf(state, content))
        .find((found) => found !== null);
      const ending = part?.ending ?? endingOf(state);
      setText(title, ending.title);
      setText(text, ending.text);
      text.hidden = ending.text === '';
      details.replaceChildren(...(part === undefined ? [] : [part.details]));
      details.hidden = part === undefined;
      board?.set(null);
      setFlag(pill, 'arrive', false);
      const breakdown = scoreBreakdown(state);
      fillScore(breakdown.total, best);
      lesson.element.hidden = !unmoved;
      if (unmoved) {
        lesson.show(state, content);
      }
      players = playerCards(state.players, content);
      cards.replaceChildren(...players.map((player) => player.seat));
      cards.style.setProperty('--count', String(state.players.length));
      const guest = session?.role === 'guest';
      const leads = session?.role === 'host';
      const learns = offersTutorial(state);
      // After the tutorial, the button plays a set of the night.
      setText(restart, state.setId === TUTORIAL.id ? t('Play') : t('Play again'));
      restart.hidden = guest;
      learn.hidden = !learns;
      lobby.hidden = !leads;
      wait.hidden = !guest;
      // The score and the cards come before the buttons, as they read; the screen opens on the first button.
      buttons = [
        ...(guest ? [] : [restart]),
        ...(learns ? [learn] : []),
        ...(leads ? [lobby] : []),
        quit,
        ...(feedback === null ? [] : [feedback]),
        discord,
      ];
      ticket.show(tallyOf(breakdown), !pace.calm());
      settle(buttons[0] ?? quit);
    },
    setDevice(next) {
      if (next === device) {
        return;
      }
      device = next;
      fillHints();
    },
    setBoardLine(line) {
      board?.set(line);
      settle(items[menu.index] ?? score);
    },
  };
}

function pressed(edges: MenuIntents): boolean {
  return Object.values(edges).some(Boolean);
}

function inside(target: Element | null, selector: string): boolean {
  return target !== null && target.closest(selector) !== null;
}
