import { describe, expect, it } from 'vitest';
import { MAX_PLAYER_NAME_LENGTH, trimPlayerName } from './player-name';

describe('trimPlayerName', () => {
  it('removes edge spaces', () => {
    expect(trimPlayerName('  Ana ')).toBe('Ana');
  });

  it('cuts to the maximum length', () => {
    expect(trimPlayerName('x'.repeat(50))).toHaveLength(MAX_PLAYER_NAME_LENGTH);
  });

  it('does not leave a space at the cut', () => {
    expect(trimPlayerName('abcdefghijk lmn')).toBe('abcdefghijk');
  });

  it('returns an empty string for a blank name', () => {
    expect(trimPlayerName('   ')).toBe('');
  });
});
