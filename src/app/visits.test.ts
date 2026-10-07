import { describe, expect, it } from 'vitest';
import { countVisit } from './visits';

function recording(answer: () => Promise<Response>) {
  const urls: string[] = [];
  return {
    urls,
    fetch: (url: string) => {
      urls.push(url);
      return answer();
    },
  };
}

describe('countVisit', () => {
  it('counts a visit to the published game and returns the total', async () => {
    const counter = recording(() => Promise.resolve(Response.json({ value: 1234 })));

    const total = await countVisit('r4mbo7.github.io', counter.fetch);

    expect(total).toBe(1234);
    expect(counter.urls).toEqual(['https://abacus.jasoncameron.dev/hit/r4mbo7-ozoboom/visits']);
  });

  it('never counts a local or test build', async () => {
    const counter = recording(() => Promise.resolve(Response.json({ value: 1 })));

    const total = await countVisit('localhost', counter.fetch);

    expect(total).toBeNull();
    expect(counter.urls).toEqual([]);
  });

  it.each([
    ['unreachable', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['failing', () => Promise.resolve(new Response('', { status: 503 }))],
    ['malformed', () => Promise.resolve(Response.json({ error: 'nope' }))],
  ])('shows no total when the counter is %s', async (_, answer) => {
    const total = await countVisit('r4mbo7.github.io', recording(answer).fetch);

    expect(total).toBeNull();
  });
});
