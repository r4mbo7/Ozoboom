import { t } from '../shared/i18n';
import { el, setText, setVar } from './dom';
import { formatNumber } from './format';
import { TALLY_STEP_MS, type Tally, type TicketLine, shownScore, tallyMs } from './score-tally';

// The end screen's state, read by its CSS: the ticket counts over the cards, rests folded into
// the score, or opens in the cards' place.
export type TallyState = 'counting' | 'folded' | 'open';

export interface ScoreTicket {
  readonly ticket: HTMLElement;
  show(tally: Tally, counting: boolean): void;
}

export function tallyState(screen: HTMLElement): TallyState {
  const state = screen.dataset.tally;
  return state === 'counting' || state === 'open' ? state : 'folded';
}

// Fires `tally` on the screen when the state changes.
export function setTally(screen: HTMLElement, next: TallyState): void {
  if (screen.dataset.tally === next) {
    return;
  }
  screen.dataset.tally = next;
  screen.dispatchEvent(new Event('tally'));
}

// `screen` carries the state; `score` opens the ticket again; `scoreValue` shows the score as it
// counts; `record` stands on the total's line and lands with it.
export function createScoreTicket(
  screen: HTMLElement,
  score: HTMLButtonElement,
  scoreValue: HTMLElement,
  record: HTMLElement,
): ScoreTicket {
  const lines = el('ol', 'ui-end__ticket-lines');
  lines.setAttribute('aria-label', t('Détail du score'));
  const ticket = el('div', 'ui-end__ticket');
  ticket.append(lines);
  score.setAttribute('aria-expanded', 'false');
  let frame = 0;
  let total = 0;
  // A count skipped or ended shows its total at once.
  screen.addEventListener('tally', () => {
    const state = tallyState(screen);
    score.setAttribute('aria-expanded', String(state === 'open'));
    if (state !== 'counting') {
      cancelAnimationFrame(frame);
      setText(scoreValue, formatNumber(total));
    }
  });

  // The count starts on the first frame drawn, with the lines' CSS drops.
  function run(tally: Tally, startedAt: number | null): void {
    frame = requestAnimationFrame((now) => {
      const start = startedAt ?? now;
      const elapsed = now - start;
      setText(scoreValue, formatNumber(shownScore(tally, elapsed)));
      if (elapsed >= tallyMs(tally)) {
        setTally(screen, 'folded');
        return;
      }
      run(tally, start);
    });
  }

  return {
    ticket,
    show(tally, counting) {
      cancelAnimationFrame(frame);
      total = tally.total;
      lines.replaceChildren(...tally.lines.map(ticketLine), ticketTotal(tally, record));
      lines.querySelectorAll<HTMLElement>('li').forEach((item, step) => {
        setVar(item, '--drop', `${String(Math.round(step * TALLY_STEP_MS))}ms`);
      });
      setTally(screen, counting ? 'counting' : 'folded');
      setText(scoreValue, formatNumber(counting ? 0 : tally.total));
      if (counting) {
        run(tally, null);
      }
    },
  };
}

function ticketLine(line: TicketLine): HTMLElement {
  const item = el('li', 'ui-end__ticket-line');
  item.append(
    el('span', 'ui-end__ticket-label'),
    el('span', 'ui-end__ticket-price', line.price),
    el('span', 'ui-end__ticket-points', line.points),
  );
  item.firstElementChild?.append(...withCount(line.label, line.count));
  return item;
}

function ticketTotal(tally: Tally, record: HTMLElement): HTMLElement {
  const item = el('li', 'ui-end__ticket-line ui-end__ticket-line--total');
  item.append(
    el('span', 'ui-end__ticket-label', t('Total')),
    record,
    el('span', 'ui-end__ticket-points', formatNumber(tally.total)),
  );
  return item;
}

// The count drawn bold inside its sentence, wherever the language puts it.
function withCount(text: string, count: string): (string | HTMLElement)[] {
  const at = text.indexOf(count);
  if (at < 0) {
    return [text];
  }
  return [text.slice(0, at), el('strong', '', count), text.slice(at + count.length)].filter(
    (part) => part !== '',
  );
}
