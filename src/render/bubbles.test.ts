import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR } from '../shared/tempo';
import { BUBBLE_TICKS, BubbleLog, MAX_BUBBLES, bubbleAlpha } from './bubbles';

describe('BubbleLog', () => {
  it('drops a bubble two bars after it opened', () => {
    const log = new BubbleLog();
    log.open(1, 100, 0, 0);

    const before = log.live(100 + 2 * TICKS_PER_BAR - 1).length;
    const after = log.live(100 + 2 * TICKS_PER_BAR).length;

    expect(before).toBe(1);
    expect(after).toBe(0);
  });

  it('never keeps more than three bubbles, the oldest making room', () => {
    const log = new BubbleLog();

    for (let id = 1; id <= MAX_BUBBLES + 2; id += 1) {
      log.open(id, id, 0, 0);
    }

    const ids = log.live(MAX_BUBBLES + 2).map((bubble) => bubble.enemyId);
    expect(ids).toEqual([3, 4, 5]);
  });

  it('restarts the bubble of a Bavard who babbles again instead of adding one', () => {
    const log = new BubbleLog();
    log.open(1, 0, 0, 0);
    log.open(2, 5, 0, 0);

    log.open(1, 50, 0, 0);

    const live = log.live(60);
    expect(live.map((bubble) => bubble.enemyId)).toEqual([2, 1]);
    expect(live.at(-1)?.start).toBe(50);
  });
});

describe('bubbleAlpha', () => {
  it('opens quickly, stays opaque, then fades out before the end', () => {
    expect(bubbleAlpha(0)).toBe(0);
    expect(bubbleAlpha(BUBBLE_TICKS / 2)).toBe(1);
    expect(bubbleAlpha(BUBBLE_TICKS - 1)).toBeLessThan(0.2);
    expect(bubbleAlpha(BUBBLE_TICKS)).toBe(0);
  });
});
