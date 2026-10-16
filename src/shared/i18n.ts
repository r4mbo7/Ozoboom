import { FULL_CATALOGS } from './full';
import en from './locales/en.json';

// The game is written in French and translated at each release (ADR 0017): a French text is its own key, and
// stands in for a translation the catalog lacks.
export const LOCALES = [
  { id: 'fr', name: 'Français' },
  { id: 'en', name: 'English' },
] as const;

export type Locale = (typeof LOCALES)[number]['id'];

export const SOURCE_LOCALE: Locale = 'fr';

// The language of a browser the game does not speak.
export const FALLBACK_LOCALE: Locale = 'en';

const isLocale = (id: string): id is Locale => LOCALES.some((entry) => entry.id === id);

// The player's choice first, then the first language of the browser the game speaks (`en-GB` gives `en`).
export function pickLocale(saved: string | null, browser: readonly string[]): Locale {
  if (saved !== null && isLocale(saved)) {
    return saved;
  }
  return (
    browser.map((tag) => tag.split('-')[0]?.toLowerCase() ?? '').find(isLocale) ?? FALLBACK_LOCALE
  );
}

// The language after `current` on the side of `side`, around the list.
export function stepLocale(current: Locale, side: -1 | 1): Locale {
  const index = LOCALES.findIndex((entry) => entry.id === current);
  return LOCALES[(index + side + LOCALES.length) % LOCALES.length]?.id ?? current;
}

export type Catalog = Readonly<Record<string, string>>;

export type Params = Readonly<Record<string, string | number>>;

const CATALOGS: Readonly<Record<Locale, Catalog>> = { fr: {}, en };

export function catalogOf(locale: Locale): Catalog {
  return { ...CATALOGS[locale], ...FULL_CATALOGS[locale] };
}

let current: Locale = SOURCE_LOCALE;
let translations: Catalog = {};

export function setLocale(locale: Locale, catalog: Catalog): void {
  current = locale;
  translations = locale === SOURCE_LOCALE ? {} : catalog;
}

export function locale(): Locale {
  return current;
}

const PARAM = /\{(\w+)\}/g;

export function t(source: string, params?: Params): string {
  const translation = translations[source];
  const text = translation === undefined || translation === '' ? source : translation;
  if (params === undefined) {
    return text;
  }
  return text.replace(PARAM, (_, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing parameter {${name}} for "${source}"`);
    }
    return String(value);
  });
}
