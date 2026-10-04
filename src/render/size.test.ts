import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MAX_LINES = 300;
const dir = new URL('./', import.meta.url);

describe('src/render', () => {
  it(`keeps every file under ${String(MAX_LINES)} lines`, () => {
    const lengths = Object.fromEntries(
      readdirSync(dir)
        .filter((name) => name.endsWith('.ts'))
        .map((name) => [name, readFileSync(new URL(name, dir), 'utf8').split('\n').length]),
    );

    const tooLong = Object.entries(lengths).filter(([, lines]) => lines > MAX_LINES);

    expect(tooLong).toEqual([]);
  });
});
