import { describe, expect, it } from 'vitest';
import { PALETTE_TOKENS, SUN_PALETTES } from '../shared/palette';
import { createSunFollower, cssName } from './sun';

function fakeTarget() {
  const written = new Map<string, string>();
  let writes = 0;
  const target = {
    style: {
      removeProperty(name: string) {
        written.delete(name);
      },
      setProperty(name: string, value: string) {
        written.set(name, value);
        writes += 1;
      },
    },
  } as unknown as HTMLElement;
  return { target, written, writes: () => writes };
}

describe('cssName', () => {
  it('turns a palette token into a kebab-case custom property', () => {
    expect(cssName('solClair')).toBe('--sol-clair');
    expect(cssName('badVibe')).toBe('--bad-vibe');
    expect(cssName('or')).toBe('--or');
  });
});

describe('createSunFollower', () => {
  it('writes every token of the palette at the set time', () => {
    const { target, written } = fakeTarget();

    createSunFollower(target).follow(0.4);

    expect([...written.keys()].sort()).toEqual(PALETTE_TOKENS.map(cssName).sort());
    expect(written.get('--sol')).toBe(SUN_PALETTES.nuit.sol);
  });

  it('does not write again for a change of a hundredth or less', () => {
    const { target, writes } = fakeTarget();
    const sun = createSunFollower(target);
    sun.follow(0.1);
    const afterFirst = writes();

    sun.follow(0.11);
    sun.follow(0.095);

    expect(writes()).toBe(afterFirst);
  });

  it('writes again past a hundredth', () => {
    const { target, writes } = fakeTarget();
    const sun = createSunFollower(target);
    sun.follow(0.1);
    const afterFirst = writes();

    sun.follow(0.12);

    expect(writes()).toBeGreaterThan(afterFirst);
  });

  it('removes every token it wrote when cleared', () => {
    const { target, written } = fakeTarget();
    const sun = createSunFollower(target);
    sun.follow(0.4);

    sun.clear();

    expect(written.size).toBe(0);
  });

  it('fixes the full day palette, then follows again', () => {
    const { target, written } = fakeTarget();
    const sun = createSunFollower(target);
    sun.follow(0.4);

    sun.fix('jour');
    expect(written.get('--sol')).toBe(SUN_PALETTES.jour.sol);
    sun.follow(0.4);

    expect(written.get('--sol')).toBe(SUN_PALETTES.nuit.sol);
  });
});
