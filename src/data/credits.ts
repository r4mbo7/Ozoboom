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
    // As Timo asks to be named; a line break never parts "aka" from the artist name.
    name: 'Timo Lissy aka\u00a0Futurum Sonat',
    link: 'https://soundcloud.com/futurum-sonat-psytrance',
  },
  thanks: [
    { name: 'Hélène Burgholzer' },
    { name: 'Zizou Goodgirl', role: 'Unfailing support' },
    { name: 'Max Race', role: 'Psychologist, writer, teacher' },
    { name: 'Lubin Basty', role: 'Railway works cost estimating lead' },
    { name: 'Quentin Morvan', role: 'Emeritus doctor of letters' },
    { name: 'James Brown', role: 'Tester from day one' },
    { name: 'Amaury', role: 'Lightning-fast tester' },
    { name: 'Alexandre Chavenon', role: 'Psytrance partner' },
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
