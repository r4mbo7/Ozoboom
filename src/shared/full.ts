import type { Catalog, Locale } from './i18n';
import type { ClassTint } from './palette';

export const FULL_TINTS = {} satisfies Readonly<Record<string, ClassTint>>;

export const FULL_CATALOGS: Readonly<Partial<Record<Locale, Catalog>>> = {};
