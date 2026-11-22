// Where a word too long for its tile, even at its smallest size, may break once: at the hyphen of a
// compound, else after an apostrophe that joins two words, else between two syllables, the nearest
// its middle.

const VOWEL = /^[aeiouyàâäéèêëîïôöùûüÿœæ]$/iu;
const LETTER = /^\p{L}$/u;
const APOSTROPHE = /^['’]$/u;
// Syllables are found in Latin script only: a word of any other script never breaks.
const NOT_LATIN = /(?!\p{Script=Latin})\p{L}/u;
// Two consonants a syllable never splits.
const BOUND = new Set([
  'bl',
  'br',
  'ch',
  'cl',
  'cr',
  'dr',
  'fl',
  'fr',
  'gl',
  'gn',
  'gr',
  'ph',
  'pl',
  'pr',
  'qu',
  'sh',
  'th',
  'tr',
  'vr',
]);
// Each side keeps this many characters at least.
const SIDE = 3;
// A word shorter than this never breaks.
const LONGEST_WHOLE = 7;
const SOFT_HYPHEN = '\u00ad';
const ZERO_WIDTH_SPACE = '\u200b';
const WORD_JOINER = '\u2060';
const HYPHEN = /-(?=\p{L})/gu;
const COMPOUND = /-\p{L}/u;

const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

const graphemes = (word: string): string[] =>
  Array.from(GRAPHEMES.segment(word), ({ segment }) => segment);

const isVowel = (char: string | undefined): boolean => char !== undefined && VOWEL.test(char);
const isConsonant = (char: string | undefined): boolean =>
  char !== undefined && LETTER.test(char) && !VOWEL.test(char);

// A syllable starts at `at`: two consonants part there, or one consonant, or a pair that never
// parts, opens a syllable after a vowel.
function opensSyllable(chars: readonly string[], at: number): boolean {
  const before = chars[at - 1];
  const first = chars[at];
  const second = chars[at + 1];
  const pair = `${first ?? ''}${second ?? ''}`.toLowerCase();
  if (isConsonant(before) && isConsonant(first)) {
    return !BOUND.has(`${before ?? ''}${first ?? ''}`.toLowerCase());
  }
  if (!isVowel(before)) {
    return false;
  }
  return isConsonant(first) && (isVowel(second) || (BOUND.has(pair) && isVowel(chars[at + 2])));
}

// Where the word breaks, and with what: a hyphen between two syllables, nothing after an apostrophe.
function breakPoint(word: string): { readonly at: number; readonly mark: string } | null {
  const chars = graphemes(word);
  if (chars.length < LONGEST_WHOLE || NOT_LATIN.test(word)) {
    return null;
  }
  const middle = chars.length / 2;
  let best: { at: number; mark: string; rank: number } | null = null;
  for (let at = SIDE; at <= chars.length - SIDE; at += 1) {
    const joined = APOSTROPHE.test(chars[at - 1] ?? '');
    if (!joined && !opensSyllable(chars, at)) {
      continue;
    }
    // An apostrophe first; then the nearest the middle, the later of two as near.
    const rank = (joined ? 0 : chars.length) + Math.abs(at - middle) - at / (4 * chars.length);
    if (best === null || rank < best.rank) {
      best = { at, mark: joined ? ZERO_WIDTH_SPACE : SOFT_HYPHEN, rank };
    }
  }
  return best === null ? null : { at: best.at, mark: best.mark };
}

// The name with no line break inside a hyphenated compound: « Ruban arc-en-ciel » breaks at its space,
// never as « Ruban arc- / en-ciel ».
export function gluedName(name: string): string {
  return name.replace(HYPHEN, `-${WORD_JOINER}`);
}

// A compound breaks at its hyphen the nearest its middle, the others kept glued.
function breakableCompound(word: string): string {
  const hyphens = [...word.matchAll(HYPHEN)].map(({ index }) => index);
  const middle = word.length / 2;
  const at = hyphens.reduce((best, index) =>
    Math.abs(index + 1 - middle) < Math.abs(best + 1 - middle) ? index : best,
  );
  return gluedName(word.slice(0, at + 1)) + gluedName(word.slice(at + 1));
}

// The name with each long word allowed to break once: the line breaks there only if it must.
export function breakableName(name: string): string {
  return name
    .split(' ')
    .map((word) => {
      if (COMPOUND.test(word)) {
        return breakableCompound(word);
      }
      const point = breakPoint(word);
      if (point === null) {
        return word;
      }
      const chars = graphemes(word);
      return chars.slice(0, point.at).join('') + point.mark + chars.slice(point.at).join('');
    })
    .join(' ');
}
