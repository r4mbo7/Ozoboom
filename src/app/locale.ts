import { type Locale, catalogOf, direction, pickLocale, setLocale, t } from '../shared/i18n';

const KEY = 'ozoboom.locale';

export function startLocale(): void {
  const chosen = pickLocale(readChoice(), navigator.languages);
  setLocale(chosen, catalogOf(chosen));
  document.documentElement.lang = chosen;
  document.documentElement.dir = direction();
  if (chosen === 'ar') {
    // A font loads at its first glyph: the menus would flash in a fallback face the first time.
    void document.fonts.load('700 1em "Reem Kufi"', 'ع');
    void document.fonts.load('400 1em "Readex Pro"', 'ع');
  }
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute(
      'content',
      t('Jeu web léger de survie coopérative dans un festival de psytrance.'),
    );
}

// Every screen is built in the language of the start: the game reloads in the new one.
export function chooseLocale(next: Locale): void {
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    return;
  }
  window.location.reload();
}

function readChoice(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
