import { describe, expect, it } from 'vitest';
import { VOLUME_STEPS, stepSound } from './volume';

describe('stepSound', () => {
  it('raises and lowers the level by one step', () => {
    expect(stepSound({ volume: 5, muted: false }, 1)).toEqual({ volume: 6, muted: false });
    expect(stepSound({ volume: 5, muted: false }, -1)).toEqual({ volume: 4, muted: false });
  });

  it('stays at the loudest level', () => {
    expect(stepSound({ volume: VOLUME_STEPS, muted: false }, 1)).toEqual({
      volume: VOLUME_STEPS,
      muted: false,
    });
  });

  it('cuts the sound below the quietest level and keeps that level', () => {
    expect(stepSound({ volume: 1, muted: false }, -1)).toEqual({ volume: 1, muted: true });
    expect(stepSound({ volume: 1, muted: true }, -1)).toEqual({ volume: 1, muted: true });
  });

  it('brings a cut sound back at its level before raising it', () => {
    expect(stepSound({ volume: 7, muted: true }, 1)).toEqual({ volume: 7, muted: false });
  });
});
