import { FULL_CATALOGS } from './full';
import en from './locales/en.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';

// The game is written in French and translated at each release (ADR 0017): a French text is its own key, and
// stands in for a translation the catalog lacks.
export const LOCALES = [
  { id: 'fr', name: 'Français' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
  { id: 'pt-BR', name: 'Português' },
] as const;

export type Locale = (typeof LOCALES)[number]['id'];

export const SOURCE_LOCALE: Locale = 'fr';

// The language of a browser the game does not speak.
export const FALLBACK_LOCALE: Locale = 'en';

const isLocale = (id: string): id is Locale => LOCALES.some((entry) => entry.id === id);

const mainTag = (tag: string): string => tag.split('-')[0]?.toLowerCase() ?? '';

// A browser tag, whole or by its main language: `en-GB` gives `en`, `pt-PT` gives `pt-BR`.
function spoken(tag: string): Locale | undefined {
  return (
    LOCALES.find((entry) => entry.id.toLowerCase() === tag.toLowerCase()) ??
    LOCALES.find((entry) => mainTag(entry.id) === mainTag(tag))
  )?.id;
}

// The player's choice first, then the first language of the browser the game speaks.
export function pickLocale(saved: string | null, browser: readonly string[]): Locale {
  if (saved !== null && isLocale(saved)) {
    return saved;
  }
  for (const tag of browser) {
    const locale = spoken(tag);
    if (locale !== undefined) {
      return locale;
    }
  }
  return FALLBACK_LOCALE;
}

export type Catalog = Readonly<Record<string, string>>;

export type Params = Readonly<Record<string, string | number>>;

const CATALOGS: Readonly<Record<Locale, Catalog>> = { fr: {}, en, es, 'pt-BR': ptBR };

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

// What a player who typed no name is called, in the language of the screen that shows them.
export function defaultName(playerId: number): string {
  return t('Joueur {number}', { number: playerId + 1 });
}
