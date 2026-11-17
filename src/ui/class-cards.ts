import { setVar } from './dom';

const MIN_NAME_SIZE = 9;

// A name whose words still overflow its card steps its size down, half a pixel at a time. Every size
// is reset before any is read: a card's width does not depend on its name, and the page lays out once.
function fitNames(row: HTMLElement): void {
  const names = [...row.querySelectorAll<HTMLElement>('.ui-classcard__name')].flatMap((name) =>
    name.parentElement === null ? [] : [{ name, card: name.parentElement }],
  );
  for (const { name } of names) {
    name.style.removeProperty('font-size');
  }
  const measured = names.map(({ name, card }) => {
    const frame = getComputedStyle(card);
    return {
      name,
      room: card.clientWidth - parseFloat(frame.paddingLeft) - parseFloat(frame.paddingRight),
      size: parseFloat(getComputedStyle(name).fontSize),
    };
  });
  for (const { name, room, size: start } of measured) {
    let size = start;
    while (name.scrollWidth > room && size > MIN_NAME_SIZE) {
      size -= 0.5;
      name.style.fontSize = `${String(size)}px`;
    }
  }
}

export interface CardBox {
  readonly width: number;
  readonly height: number;
  readonly gap: number;
  readonly rowGap: number;
  readonly most: number;
  // A card's height for its width.
  readonly ratio: number;
}

export interface CardFit {
  readonly columns: number;
  readonly card: number;
}

// The widest cards whose rows all hold in the box, shared evenly between the rows.
export function fitCards(count: number, box: CardBox): CardFit {
  let best: CardFit = { columns: count, card: 0 };
  for (let rows = 1; rows <= count; rows += 1) {
    const columns = Math.ceil(count / rows);
    const card = Math.min(
      box.most,
      (box.width - (columns - 1) * box.gap) / columns,
      (box.height - (rows - 1) * box.rowGap) / (rows * box.ratio),
    );
    if (card > best.card) {
      best = { columns, card };
    }
  }
  return best;
}

const FIT_STEP = 8;

function placeCards(row: HTMLElement, width: number, gap: number, fit: CardFit): void {
  setVar(row, '--card-width', `${String(fit.card)}px`);
  setVar(
    row,
    '--cards-inset',
    `${String(Math.floor((width - fit.columns * fit.card - (fit.columns - 1) * gap) / 2))}px`,
  );
  fitNames(row);
}

// The cards, of their --card-ratio and at most --card-most wide, fit the room the screen leaves them,
// smaller still while a long name makes a card taller than its ratio. The padding centres the rows of
// cards that stop there.
export function spreadCards(row: HTMLElement): void {
  // Its fraction of a pixel left out: the cards it is shared between never wrap one too many.
  const box = row.getBoundingClientRect();
  const width = Math.floor(box.width);
  if (width === 0) {
    return;
  }
  const style = getComputedStyle(row);
  const gap = parseFloat(style.columnGap);
  const most = parseFloat(style.getPropertyValue('--card-most'));
  const ratio = parseFloat(style.getPropertyValue('--card-ratio'));
  const count = row.children.length;
  const rowGap = parseFloat(style.rowGap);
  const room = box.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  let placed: CardFit = { columns: -1, card: -1 };
  for (let height = Math.floor(room); height > 0; height -= FIT_STEP) {
    const fit = fitCards(count, { width, height, gap, rowGap, most, ratio });
    // A fraction of a pixel more and the last card of a row wraps to the next.
    const card = Math.floor(fit.card);
    // The same cards as the step before overflow as they did.
    if (placed.card === card && placed.columns === fit.columns) {
      continue;
    }
    placed = { columns: fit.columns, card };
    placeCards(row, width, gap, placed);
    if (row.scrollHeight <= row.clientHeight) {
      return;
    }
  }
}
