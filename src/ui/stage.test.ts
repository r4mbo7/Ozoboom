import { describe, expect, it } from 'vitest';
import { STAGE_CARDS } from './lobby-fixtures';
import { stepStage } from './stage';

describe('stepStage', () => {
  it('moves to the other scene and wraps both ways', () => {
    expect(stepStage(STAGE_CARDS, 'main', 1)).toBe('dome');
    expect(stepStage(STAGE_CARDS, 'dome', 1)).toBe('main');
    expect(stepStage(STAGE_CARDS, 'main', -1)).toBe('dome');
  });

  it('has nothing to choose with one scene or none', () => {
    expect(stepStage(STAGE_CARDS.slice(0, 1), 'main', 1)).toBeNull();
    expect(stepStage([], '', 1)).toBeNull();
  });
});
