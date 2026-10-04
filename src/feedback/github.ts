import type { FeedbackDraft, FeedbackTransport, FeedbackType } from './types';

export const FEEDBACK_TEMPLATE = 'feedback-in-game.yml';
export const MAX_URL_LENGTH = 8000;

const NEW_ISSUE = 'https://github.com/r4mbo7/Ozoboom/issues/new';
const TITLE_PREFIX = '[Avis] ';
const TITLE_GRAPHEMES = 60;
const CUT = '…';

export interface FeedbackTypeOption {
  id: FeedbackType;
  label: string;
  formOption: string;
}

export const FEEDBACK_TYPES: readonly FeedbackTypeOption[] = [
  { id: 'idea', label: 'Idée', formOption: 'Une idée' },
  { id: 'bug', label: 'Bug', formOption: 'Un bug' },
  { id: 'balance', label: 'Équilibrage', formOption: 'Trop dur, trop facile ou trop long' },
  { id: 'other', label: 'Autre', formOption: 'Autre chose' },
];

const segmenter = new Intl.Segmenter('fr', { granularity: 'grapheme' });

export function githubFormUrl(draft: FeedbackDraft): { url: string; truncated: boolean } {
  const message = wellFormed(draft.message);
  const context = draft.context === null ? null : wellFormed(draft.context);
  const option = formOption(draft.type);
  const urlFor = (text: string, attached: string | null) => formUrl(option, text, attached);

  const full = urlFor(message, context);
  if (full.length <= MAX_URL_LENGTH) {
    return { url: full, truncated: false };
  }
  const shortMessage = longestFit((text) => urlFor(text, context), message);
  if (shortMessage !== null) {
    return { url: shortMessage, truncated: true };
  }
  const shortContext = longestFit((text) => urlFor(CUT, text), context ?? '');
  return { url: shortContext ?? urlFor(CUT, null), truncated: true };
}

export function githubFormLink(
  openTab: (url: string) => boolean = openInNewTab,
): FeedbackTransport {
  return {
    send(draft) {
      const { url, truncated } = githubFormUrl(draft);
      return Promise.resolve(openTab(url) ? { status: 'opened', truncated } : { status: 'failed' });
    },
  };
}

export function clipboardText(
  draft: Omit<FeedbackDraft, 'type'> & { type: FeedbackType | null },
): string {
  return [draft.type === null ? null : formOption(draft.type), draft.message, draft.context]
    .filter((part) => part !== null && part !== '')
    .join('\n\n');
}

function openInNewTab(url: string): boolean {
  const tab = window.open(url, '_blank');
  if (tab === null) {
    return false;
  }
  tab.opener = null;
  return true;
}

function formOption(type: FeedbackType): string {
  const option = FEEDBACK_TYPES.find((entry) => entry.id === type);
  if (option === undefined) {
    throw new Error(`Unknown feedback type ${type}`);
  }
  return option.formOption;
}

function formUrl(option: string, message: string, context: string | null): string {
  const fields: [string, string][] = [
    ['template', FEEDBACK_TEMPLATE],
    ['title', `${TITLE_PREFIX}${titleExcerpt(message) ?? option}`],
    ['type', option],
    ['message', message],
  ];
  if (context !== null) {
    fields.push(['context', context]);
  }
  const query = fields.map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('&');
  return `${NEW_ISSUE}?${query}`;
}

function titleExcerpt(message: string): string | null {
  const line = message
    .split('\n')
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .find((text) => text !== '');
  if (line === undefined) {
    return null;
  }
  const parts = graphemes(line);
  return parts.length > TITLE_GRAPHEMES ? cut(parts, TITLE_GRAPHEMES) : line;
}

// The longest prefix of `text`, cut on a grapheme and marked, whose URL fits; null if none does.
function longestFit(urlFor: (text: string) => string, text: string): string | null {
  const parts = graphemes(text);
  let best: string | null = null;
  let low = 0;
  let high = parts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const url = urlFor(cut(parts, middle));
    if (url.length <= MAX_URL_LENGTH) {
      best = url;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

function cut(parts: readonly string[], count: number): string {
  return `${parts.slice(0, count).join('').trimEnd()}${CUT}`;
}

function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

function wellFormed(text: string): string {
  return text.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    '�',
  );
}
