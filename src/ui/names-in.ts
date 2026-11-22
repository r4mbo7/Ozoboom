import { el } from './dom';

// The two names a translated sentence carries stand out in it: the sentence holds their marks.
export const MARKS = ['', ''] as const;

export function namesIn(
  className: string,
  text: string,
  names: readonly [string, string],
): HTMLElement {
  const node = el('span', className);
  for (const part of text.split(/(|)/u)) {
    const mark = MARKS.findIndex((candidate) => candidate === part);
    node.append(mark < 0 ? part : el('b', '', names[mark]));
  }
  return node;
}
