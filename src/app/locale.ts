import { type Locale, catalogOf, pickLocale, setLocale, t } from '../shared/i18n';

const KEY = 'ozoboom.locale';

export function startLocale(): void {
  const chosen = pickLocale(readChoice(), navigator.languages);
  setLocale(chosen, catalogOf(chosen));
  document.documentElement.lang = chosen;
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
