import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_TEMPLATE,
  FEEDBACK_TYPES,
  MAX_URL_LENGTH,
  clipboardText,
  githubFormLink,
  githubFormUrl,
} from './github';
import type { FeedbackDraft } from './types';

const template = readFileSync(
  new URL(`../../.github/ISSUE_TEMPLATE/${FEEDBACK_TEMPLATE}`, import.meta.url),
  'utf8',
);

const CONTEXT = [
  'version: 7643844469c2f8dc8e89881b3494cedff25a9a7b',
  'seed: 42',
  'class: mage',
  'tier: 1',
  'phrase: 6',
  'tick: 4782 (2:44)',
  'status: lost',
  'stats: kills 1042, phrasesHeld 6, damageDealt 30500, vibesCollected 700, wattsSpent 320',
  'device: gamepad',
  `browser: ${'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '.repeat(4)}`,
  'screen: 1280x800 @2x',
  'calm: no',
  'fps: 59',
].join('\n');

function draft(overrides: Partial<FeedbackDraft> = {}): FeedbackDraft {
  return {
    type: 'bug',
    message: 'Le Relou traverse le caisson de basse.\nÇa arrive au drop.',
    context: CONTEXT,
    ...overrides,
  };
}

function graphemes(text: string): string[] {
  return Array.from(
    new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(text),
    (part) => part.segment,
  );
}

function fields(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe('githubFormUrl', () => {
  it('prefills every field of the in-game form', () => {
    const { url, truncated } = githubFormUrl(draft());

    const params = fields(url);
    expect(url.startsWith('https://github.com/r4mbo7/Ozoboom/issues/new?')).toBe(true);
    expect(params.get('template')).toBe('feedback-in-game.yml');
    expect(params.get('title')).toBe('[Avis] Le Relou traverse le caisson de basse.');
    expect(params.get('type')).toBe('Un bug');
    expect(params.get('message')).toBe(draft().message);
    expect(params.get('context')).toBe(CONTEXT);
    expect(truncated).toBe(false);
  });

  it('leaves the context out when the player does not attach it', () => {
    const { url } = githubFormUrl(draft({ context: null }));

    expect(fields(url).has('context')).toBe(false);
  });

  it('encodes spaces as %20 so no reader can take a plus sign for a space', () => {
    const { url } = githubFormUrl(draft({ message: '1 + 1 = 2' }));

    expect(url).toContain('message=1%20%2B%201%20%3D%202');
    expect(fields(url).get('message')).toBe('1 + 1 = 2');
  });

  it('shortens a long first line into the title', () => {
    const message = `${'Les lasers sont trop beaux '.repeat(4)}\nla suite`;

    const { url } = githubFormUrl(draft({ message }));

    const title = fields(url).get('title') ?? '';
    expect(graphemes(title.slice('[Avis] '.length))).toHaveLength(61);
    expect(title.endsWith('…')).toBe(true);
  });

  it('takes the title from the first line with text', () => {
    const { url } = githubFormUrl(draft({ message: '  \n\n  Trop dur au palier 2  \nVraiment' }));

    expect(fields(url).get('title')).toBe('[Avis] Trop dur au palier 2');
  });

  it('falls back on the type for a title when the message is blank', () => {
    const { url } = githubFormUrl(draft({ type: 'balance', message: ' \n ' }));

    expect(fields(url).get('title')).toBe('[Avis] Trop dur, trop facile ou trop long');
  });

  it('fills a URL up to the limit when the message is too long', () => {
    const message = 'a'.repeat(9000);

    const { url, truncated } = githubFormUrl(draft({ message }));

    expect(url.length).toBe(MAX_URL_LENGTH);
    expect(truncated).toBe(true);
    expect(fields(url).get('context')).toBe(CONTEXT);
  });

  it.each([
    ['emoji', '🔊'],
    ['family emoji', '👨‍👩‍👧'],
    ['combining accent', 'é'],
    ['CJK', '漢'],
    ['flag', '🇵🇹'],
  ])('cuts a %s message on a whole character and marks the cut', (_, unit) => {
    const message = unit.repeat(2000);

    const { url, truncated } = githubFormUrl(draft({ message }));

    const sent = fields(url).get('message') ?? '';
    const kept = graphemes(sent.slice(0, -1));
    expect(url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    expect(truncated).toBe(true);
    expect(sent.endsWith('…')).toBe(true);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.every((part) => part === unit)).toBe(true);
    expect(fields(url).get('context')).toBe(CONTEXT);
  });

  it('keeps the longest message that fits', () => {
    const message = '🔊'.repeat(2000);

    const { url } = githubFormUrl(draft({ message }));

    expect(url.length).toBeGreaterThan(MAX_URL_LENGTH - encodeURIComponent('🔊').length);
  });

  it('drops trailing spaces before the cut mark', () => {
    const message = `${'x'.repeat(1000)}${' '.repeat(5000)}`;

    const { url } = githubFormUrl(draft({ message }));

    expect(fields(url).get('message')).toBe(`${'x'.repeat(1000)}…`);
  });

  it('shortens the context too when even an empty message cannot fit', () => {
    const context = `browser: ${'漢'.repeat(5000)}`;

    const { url, truncated } = githubFormUrl(draft({ context }));

    expect(url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    expect(truncated).toBe(true);
    expect(fields(url).get('message')).toBe('…');
    expect(fields(url).get('context')).toMatch(/^browser: 漢+…$/);
  });
});

describe('the in-game GitHub form', () => {
  it.each(['type', 'message', 'context'])('has a field with id %s', (id) => {
    expect(template).toMatch(new RegExp(`^\\s+id: ${id}$`, 'm'));
  });

  it('offers exactly the options the game sends', () => {
    const options = /options:\n((?:\s+- .+\n)+)/.exec(template)?.[1] ?? '';

    expect(
      options
        .trim()
        .split('\n')
        .map((line) => line.replace(/^\s*- /, '')),
    ).toEqual(FEEDBACK_TYPES.map((type) => type.formOption));
  });
});

describe('githubFormLink', () => {
  it('opens the prefilled form in a new tab', async () => {
    const opened: string[] = [];
    const transport = githubFormLink((url) => {
      opened.push(url);
      return true;
    });

    const outcome = await transport.send(draft());

    expect(outcome).toEqual({ status: 'opened', truncated: false });
    expect(opened).toEqual([githubFormUrl(draft()).url]);
  });

  it('reports the truncation to the player', async () => {
    const transport = githubFormLink(() => true);

    const outcome = await transport.send(draft({ message: '漢'.repeat(2000) }));

    expect(outcome).toEqual({ status: 'opened', truncated: true });
  });

  it('fails when the browser blocks the new tab', async () => {
    const transport = githubFormLink(() => false);

    const outcome = await transport.send(draft());

    expect(outcome).toEqual({ status: 'failed' });
  });
});

describe('clipboardText', () => {
  it('keeps the type, the whole message and the context', () => {
    const message = '漢'.repeat(2000);

    const text = clipboardText(draft({ message }));

    expect(text).toBe(`Un bug\n\n${message}\n\n${CONTEXT}`);
  });

  it('starts with the message when no type is chosen yet', () => {
    expect(clipboardText({ type: null, message: 'Plus de lasers', context: 'seed: 42' })).toBe(
      'Plus de lasers\n\nseed: 42',
    );
  });

  it('skips the context the player did not attach', () => {
    expect(clipboardText(draft({ type: 'idea', message: 'Plus de lasers', context: null }))).toBe(
      'Une idée\n\nPlus de lasers',
    );
  });
});
