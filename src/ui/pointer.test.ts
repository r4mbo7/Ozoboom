import { describe, expect, it } from 'vitest';
import { isMouseMove } from './pointer';

describe('isMouseMove', () => {
  it('counts a mouse that moves', () => {
    expect(isMouseMove({ pointerType: 'mouse', movementX: 3, movementY: 0 })).toBe(true);
    expect(isMouseMove({ pointerType: 'mouse', movementX: 0, movementY: -1 })).toBe(true);
  });

  it('ignores the hover a menu gets when it opens under a resting cursor', () => {
    expect(isMouseMove({ pointerType: 'mouse', movementX: 0, movementY: 0 })).toBe(false);
  });

  it('ignores a finger or a pen, which select with their tap', () => {
    expect(isMouseMove({ pointerType: 'touch', movementX: 5, movementY: 5 })).toBe(false);
    expect(isMouseMove({ pointerType: 'pen', movementX: 5, movementY: 5 })).toBe(false);
  });
});
