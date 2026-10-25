// Apart from the catalogs, so the stats Worker reads them without carrying the translations.
export const LOCALES = [
  { id: 'fr', name: 'Français', dir: 'ltr' },
  { id: 'en', name: 'English', dir: 'ltr' },
  { id: 'es', name: 'Español', dir: 'ltr' },
  { id: 'pt-BR', name: 'Português', dir: 'ltr' },
  { id: 'ar', name: 'العربية', dir: 'rtl' },
] as const;

export type Locale = (typeof LOCALES)[number]['id'];

export const isLocale = (id: unknown): id is Locale => LOCALES.some((entry) => entry.id === id);
