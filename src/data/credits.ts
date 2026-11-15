// The people and the free work behind the game.
// A person's name is never translated. The line under it is either a role, translated at the release
// (ADR 0017), or an alias, a name shown as written: a pseudonym, an artist name, a festival.
export interface Credit {
  readonly name: string;
  readonly role?: string;
  readonly alias?: string;
}

export interface Credits {
  readonly author: Credit;
  readonly music: Credit & { readonly link: string };
  readonly thanks: readonly Credit[];
  readonly libraries: readonly { readonly name: string; readonly licence: string }[];
  readonly fonts: { readonly names: readonly string[]; readonly licence: string };
}

export const CREDITS: Credits = {
  author: { name: 'Constantin De La Roche', alias: 'BrotherCos' },
  music: {
    name: 'Timo Lissy',
    alias: 'FuTurum SonaT',
    link: 'https://soundcloud.com/futurum-sonat-psytrance',
  },
  thanks: [
    { name: 'Hélène Burgholzer' },
    { name: 'Zizou Goodgirl', role: 'Support indéfectible' },
    { name: 'Max Race', role: 'Psychologue, écrivain, professeur' },
    { name: 'Lubin Basty', role: 'Responsable études de prix travaux ferroviaires' },
    { name: 'Quentin Morvan', role: 'Docteur émérite en lettres' },
    { name: 'James Brown', role: 'Testeur de la première heure' },
    { name: 'Amaury', role: 'Testeur ultrarapide' },
    { name: 'Alexandre Chavenon', role: 'Partenaire psytrance' },
    { name: 'bno', alias: 'Boom ’25' },
    { name: 'Jeppe', alias: 'Boom ’25' },
  ],
  libraries: [
    { name: 'PixiJS', licence: 'MIT' },
    { name: 'PeerJS', licence: 'MIT' },
  ],
  fonts: {
    names: ['Cinzel Decorative', 'Space Grotesk', 'Readex Pro', 'Reem Kufi'],
    licence: 'OFL',
  },
};

// What the translators get: the roles, never a name nor an alias.
export function creditRoles(credits: Credits = CREDITS): string[] {
  return [credits.author, credits.music, ...credits.thanks].flatMap(({ role }) =>
    role === undefined ? [] : [role],
  );
}
