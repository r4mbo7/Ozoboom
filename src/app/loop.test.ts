import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../shared/tempo';
import { createFixedStepLoop, dueTicks, type FixedStepLoop, type LoopCallbacks } from './loop';

interface Harness {
  readonly loop: FixedStepLoop;
  readonly alphas: number[];
  readonly steps: () => number;
  readonly pendingFrames: () => number;
  readonly frame: (elapsedMs: number) => void;
  readonly frameAt: (timeMs: number) => void;
  readonly wait: (elapsedMs: number) => void;
}

function createHarness(
  tickMs: number,
  maxTicksPerFrame: number,
  onStep: (loop: FixedStepLoop) => void = () => undefined,
): Harness {
  let clockMs = 1_000;
  let nextHandle = 1;
  let stepCount = 0;
  const alphas: number[] = [];
  const pending = new Map<number, (timeMs: number) => void>();

  const callbacks: LoopCallbacks = {
    step() {
      stepCount += 1;
      onStep(loop);
    },
    render(alpha) {
      alphas.push(alpha);
    },
  };

  const loop = createFixedStepLoop(
    {
      tickMs,
      maxTicksPerFrame,
      now: () => clockMs,
      requestFrame(callback) {
        const handle = nextHandle;
        nextHandle += 1;
        pending.set(handle, callback);
        return handle;
      },
      cancelFrame(handle) {
        pending.delete(handle);
      },
    },
    callbacks,
  );

  function runPendingFrames(timeMs: number): void {
    const frames = [...pending.values()];
    pending.clear();
    for (const callback of frames) {
      callback(timeMs);
    }
  }

  return {
    loop,
    alphas,
    steps: () => stepCount,
    pendingFrames: () => pending.size,
    frame(elapsedMs) {
      clockMs += elapsedMs;
      runPendingFrames(clockMs);
    },
    frameAt(timeMs) {
      runPendingFrames(timeMs);
    },
    wait(elapsedMs) {
      clockMs += elapsedMs;
    },
  };
}

function nextPseudoRandom(seed: number): number {
  return (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;
}

describe('createFixedStepLoop', () => {
  it('steps once per elapsed tick and renders the remainder as alpha', () => {
    const harness = createHarness(34.48, 5);
    harness.loop.start();

    harness.frame(100);

    expect(harness.steps()).toBe(2);
    expect(harness.alphas).toHaveLength(1);
    expect(harness.alphas[0]).toBeCloseTo(0.9, 2);
  });

  it('caps the steps of one frame and drops the backlog after a long pause', () => {
    const harness = createHarness(34.48, 5);
    harness.loop.start();

    harness.frame(5_000);

    expect(harness.steps()).toBe(5);
    expect(harness.alphas).toEqual([0]);

    harness.frame(10);

    expect(harness.steps()).toBe(5);
    expect(harness.alphas[1]).toBeCloseTo(10 / 34.48, 12);
  });

  it('keeps the remainder when the cap is reached without a backlog', () => {
    const harness = createHarness(32, 3);
    harness.loop.start();

    harness.frame(3 * 32 + 8);

    expect(harness.steps()).toBe(3);
    expect(harness.alphas).toEqual([0.25]);
  });

  it('steps at the tick rate whatever the frame rate', () => {
    const harness = createHarness(32, 5);
    harness.loop.start();

    for (let frame = 0; frame < 10; frame += 1) {
      harness.frame(16);
    }

    expect(harness.steps()).toBe(5);
    expect(harness.alphas).toEqual([0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0]);
  });

  it('keeps alpha in [0, 1) for any sequence of frames', () => {
    const harness = createHarness(TICK_MS, 4);
    harness.loop.start();
    const deltas = [
      0,
      TICK_MS,
      2 * TICK_MS,
      TICK_MS - 1e-9,
      TICK_MS + 1e-9,
      1e-12,
      1e9,
      3 * TICK_MS,
    ];
    let seed = 42;
    for (let frame = 0; frame < 2_000; frame += 1) {
      seed = nextPseudoRandom(seed);
      deltas.push((seed / 2 ** 32) * 5 * TICK_MS);
    }

    for (const delta of deltas) {
      harness.frame(delta);
    }

    expect(harness.alphas).toHaveLength(deltas.length);
    for (const alpha of harness.alphas) {
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    }
  });

  it('ignores a frame time earlier than the start time', () => {
    const harness = createHarness(32, 5);
    harness.loop.start();

    harness.frameAt(1_000 - 5);

    expect(harness.steps()).toBe(0);
    expect(harness.alphas).toEqual([0]);
  });

  it('requests no frame before start', () => {
    const harness = createHarness(32, 5);

    expect(harness.loop.running).toBe(false);
    expect(harness.pendingFrames()).toBe(0);
  });

  it('requests a single frame when started twice', () => {
    const harness = createHarness(32, 5);

    harness.loop.start();
    harness.loop.start();

    expect(harness.loop.running).toBe(true);
    expect(harness.pendingFrames()).toBe(1);
  });

  it('cancels the pending frame on stop', () => {
    const harness = createHarness(32, 5);
    harness.loop.start();
    harness.frame(16);

    harness.loop.stop();
    harness.frame(1_000);

    expect(harness.loop.running).toBe(false);
    expect(harness.pendingFrames()).toBe(0);
    expect(harness.steps()).toBe(0);
    expect(harness.alphas).toEqual([0.5]);
  });

  it('restarts without catching up the stopped time', () => {
    const harness = createHarness(34.48, 5);
    harness.loop.start();
    harness.frame(20);
    harness.loop.stop();
    harness.wait(60_000);

    harness.loop.start();
    harness.frame(100);

    expect(harness.steps()).toBe(2);
    expect(harness.alphas[1]).toBeCloseTo(0.9, 2);
  });

  it('survives repeated start and stop', () => {
    const harness = createHarness(32, 5);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      harness.loop.start();
      harness.loop.start();
      expect(harness.pendingFrames()).toBe(1);
      harness.frame(40);
      harness.loop.stop();
      harness.loop.stop();
      expect(harness.loop.running).toBe(false);
      expect(harness.pendingFrames()).toBe(0);
      harness.wait(500);
    }

    expect(harness.steps()).toBe(3);
    expect(harness.alphas).toEqual([0.25, 0.25, 0.25]);
  });

  it('stops at once when stopped from a step', () => {
    const harness = createHarness(32, 5, (loop) => {
      loop.stop();
    });
    harness.loop.start();

    harness.frame(100);

    expect(harness.loop.running).toBe(false);
    expect(harness.steps()).toBe(1);
    expect(harness.alphas).toEqual([]);
    expect(harness.pendingFrames()).toBe(0);
  });

  it('keeps a single frame when restarted from a step', () => {
    const harness = createHarness(32, 5, (loop) => {
      loop.stop();
      loop.start();
    });
    harness.loop.start();

    harness.frame(100);

    expect(harness.loop.running).toBe(true);
    expect(harness.steps()).toBe(1);
    expect(harness.alphas).toEqual([]);
    expect(harness.pendingFrames()).toBe(1);
  });

  it('stops and rethrows when a step throws', () => {
    const failure = new Error('step failed');
    const harness = createHarness(32, 5, () => {
      throw failure;
    });
    harness.loop.start();

    expect(() => {
      harness.frame(100);
    }).toThrow(failure);
    expect(harness.loop.running).toBe(false);
    expect(harness.pendingFrames()).toBe(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects a tick of %s ms', (tickMs) => {
    expect(() => createHarness(tickMs, 5)).toThrow(RangeError);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects a cap of %s ticks per frame',
    (maxTicksPerFrame) => {
      expect(() => createHarness(32, maxTicksPerFrame)).toThrow(RangeError);
    },
  );
});

describe('a step that has nothing to run', () => {
  function waitingHarness(available: () => boolean) {
    let clockMs = 0;
    let pending: ((timeMs: number) => void) | null = null;
    let steps = 0;
    const alphas: number[] = [];
    const loop = createFixedStepLoop(
      {
        tickMs: 30,
        maxTicksPerFrame: 4,
        now: () => clockMs,
        requestFrame(callback) {
          pending = callback;
          return 1;
        },
        cancelFrame() {
          pending = null;
        },
      },
      {
        step() {
          if (!available()) {
            return false;
          }
          steps += 1;
        },
        render(alpha) {
          alphas.push(alpha);
        },
      },
    );
    return {
      loop,
      alphas,
      steps: () => steps,
      frame(elapsedMs: number) {
        clockMs += elapsedMs;
        pending?.(clockMs);
      },
    };
  }

  it('attempts one step per frame, holds the interpolation, and owes no waited time', () => {
    let ready = false;
    const attempts = { count: 0 };
    const harness = waitingHarness(() => {
      attempts.count += 1;
      return ready;
    });
    harness.loop.start();

    harness.frame(100);
    harness.frame(100);

    expect(attempts.count).toBe(2);
    expect(harness.steps()).toBe(0);
    expect(harness.alphas).toEqual([1, 1]);

    ready = true;
    harness.frame(10);

    expect(harness.steps()).toBe(1);
    expect(harness.alphas.at(-1)).toBeCloseTo(10 / 30);
  });
});

describe('dueTicks', () => {
  it('owes the whole ticks elapsed and keeps the remainder', () => {
    expect(dueTicks(100, 30, 4)).toEqual({ ticks: 3, spentMs: 90 });
  });

  it('drops the time past the bound', () => {
    expect(dueTicks(10_000, 30, 4)).toEqual({ ticks: 4, spentMs: 10_000 });
  });
});
