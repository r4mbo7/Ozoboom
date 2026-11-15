import { CREDITS, type Credit, type Credits } from '../data/credits';
import { locale, t } from '../shared/i18n';
import { el } from './dom';

export interface CreditsPage {
  readonly element: HTMLElement;
  // The music's page: a menu item too, so that a keyboard or a pad reaches it.
  readonly link: HTMLAnchorElement;
  // Lays the poster out for the screen and says how long one loop lasts, in seconds.
  open(): number;
  scroll(side: -1 | 1): void;
}

const FRAME_SECONDS = 24;
const ROLLING_SHARE = 0.9;

function names(entries: readonly string[], className = ''): HTMLUListElement {
  const list = el('ul', `ui-credits__names ${className}`.trim());
  list.append(...entries.map((entry) => el('li', '', entry)));
  return list;
}

// The line under a name: a role in the player's language, an alias as written.
export function lineOf({ role, alias }: Credit): string | undefined {
  return role === undefined ? alias : t(role);
}

function person(credit: Credit, nameClass: string): HTMLElement {
  const block = el('div', 'ui-credits__person');
  block.append(el('p', nameClass, credit.name));
  const line = lineOf(credit);
  if (line !== undefined) {
    block.append(el('p', 'ui-credits__note', line));
  }
  return block;
}

// In order, who has a line gets a block of their own; the others next to each other share a row.
export function castOf(credits: readonly Credit[]): (Credit | string[])[] {
  const cast: (Credit | string[])[] = [];
  for (const credit of credits) {
    const last = cast.at(-1);
    if (lineOf(credit) !== undefined) {
      cast.push(credit);
    } else if (Array.isArray(last)) {
      last.push(credit.name);
    } else {
      cast.push([credit.name]);
    }
  }
  return cast;
}

// The poster rolls a frame height in about 24 s whatever the screen, then the night comes back for
// the last tenth of the loop (ui.css); nothing rolls in a frame not laid out yet.
export function loopSeconds(frame: number, poster: number): number {
  return frame > 0 ? (FRAME_SECONDS * (frame + poster)) / frame / ROLLING_SHARE : 0;
}

// Which names of a wrapped row start a line, from their heights.
export function lineStarts(tops: readonly number[]): boolean[] {
  return tops.map((top, index) => index === 0 || top !== tops[index - 1]);
}

// The dot between two names never starts a line: measured with every dot shown, marked after.
function markLineStarts(lists: readonly HTMLElement[]): void {
  for (const list of lists) {
    const items = [...list.children].filter((item) => item instanceof HTMLElement);
    for (const item of items) {
      item.removeAttribute('data-line-start');
    }
    const starts = lineStarts(items.map((item) => item.offsetTop));
    items.forEach((item, index) => {
      item.toggleAttribute('data-line-start', starts[index] === true);
    });
  }
}

function rule(): HTMLElement {
  const node = el('div', 'ui-credits__rule');
  node.setAttribute('aria-hidden', 'true');
  node.append(el('span', 'ui-credits__star'));
  return node;
}

export function createCredits(credits: Credits = CREDITS): CreditsPage {
  const element = el('div', 'ui-credits');
  const poster = el('div', 'ui-credits__poster');
  const label = (text: string) => el('h3', 'ui-credits__label', text);
  const link = el('a', 'ui-credits__link', credits.music.link.replace(/^https:\/\//, ''));
  link.href = credits.music.link;
  link.target = '_blank';
  link.rel = 'noopener';
  link.tabIndex = -1;
  // The menu opens it, whatever reaches it: the browser does not open it a second time.
  link.addEventListener('click', (event) => {
    event.preventDefault();
  });
  const cast = castOf(credits.thanks).map((entry) =>
    Array.isArray(entry) ? names(entry) : person(entry, 'ui-credits__name'),
  );
  const rows = cast.filter((entry) => entry instanceof HTMLUListElement);
  const libraries = names(
    credits.libraries.map(({ name, licence }) => `${name} · ${licence}`),
    'ui-credits__names--fine',
  );
  const fonts = new Intl.ListFormat(locale(), { type: 'unit' }).format(credits.fonts.names);

  poster.append(
    el('p', 'ui-credits__logo', 'Ozoboom'),
    label(t('Un jeu de')),
    person(credits.author, 'ui-credits__headliner'),
    rule(),
    label(t('Musique')),
    person(credits.music, 'ui-credits__headliner ui-credits__headliner--second'),
    link,
    rule(),
    label(t('Merci à')),
    ...cast,
    rule(),
    label(t('Bibliothèques libres')),
    libraries,
    label(t('Polices')),
    el('p', 'ui-credits__fine', `${fonts} · ${credits.fonts.licence}`),
  );
  element.append(poster);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      markLineStarts([...rows, libraries]);
    }).observe(element);
  }

  return {
    element,
    link,
    open() {
      element.scrollTop = 0;
      markLineStarts([...rows, libraries]);
      return loopSeconds(element.clientHeight, poster.offsetHeight);
    },
    scroll(side) {
      element.scrollBy({ top: side * element.clientHeight * 0.4 });
    },
  };
}
