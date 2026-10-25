import { FULL_CATALOGS } from './full';
import { LOCALES, type Locale, isLocale } from './languages';
import ar from './locales/ar.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import es from './locales/es.json' with { type: 'json' };
import ptBR from './locales/pt-BR.json' with { type: 'json' };

// A French text is its own key, and stands in for a missing translation (ADR 0017).
export { LOCALES, type Locale };

export type Direction = (typeof LOCALES)[number]['dir'];

export const SOURCE_LOCALE: Locale = 'fr';

export const FALLBACK_LOCALE: Locale = 'en';

const mainTag = (tag: string): string => tag.split('-')[0]?.toLowerCase() ?? '';

function spoken(tag: string): Locale | undefined {
  return (
    LOCALES.find((entry) => entry.id.toLowerCase() === tag.toLowerCase()) ??
    LOCALES.find((entry) => mainTag(entry.id) === mainTag(tag))
  )?.id;
}

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

export type PluralForms = Readonly<Partial<Record<Intl.LDMLPluralRule, string>>>;

export type Catalog = Readonly<Record<string, string | PluralForms>>;

export type Params = Readonly<Record<string, string | number>>;

const CATALOGS: Readonly<Record<Locale, Catalog>> = { fr: {}, en, es, 'pt-BR': ptBR, ar };

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

// An Arabic screen mirrors its layout, never the game's world.
export function direction(): Direction {
  return LOCALES.find((entry) => entry.id === current)?.dir ?? 'ltr';
}

const PARAM = /\{(\w+)\}/g;

export function t(source: string, params?: Params): string {
  const translation = translations[source];
  return fill(
    source,
    typeof translation === 'string' && translation !== '' ? translation : source,
    params,
  );
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

function pluralOf(locale: Locale, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(locale);
  if (rules === undefined) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

// `one` and `other` are the French forms, `other` the key; a language holds one per plural category.
export function tn(count: number, one: string, other: string, params?: Params): string {
  const translation = translations[other];
  const form = typeof translation === 'object' ? translation[pluralOf(current, count)] : undefined;
  const french = pluralOf(SOURCE_LOCALE, count) === 'one' ? one : other;
  return fill(other, form === undefined || form === '' ? french : form, params);
}

function fill(source: string, text: string, params: Params | undefined): string {
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

export function defaultName(playerId: number): string {
  return t('Joueur {number}', { number: playerId + 1 });
}
