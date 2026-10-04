export interface LoopOptions {
  tickMs: number;
  maxTicksPerFrame: number;
  now(): number;
  requestFrame(callback: (timeMs: number) => void): number;
  cancelFrame(handle: number): void;
}

export interface LoopCallbacks {
  step(): void;
  render(alpha: number): void;
}

export interface FixedStepLoop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export function createFixedStepLoop(options: LoopOptions, callbacks: LoopCallbacks): FixedStepLoop {
  const { tickMs, maxTicksPerFrame } = options;
  if (!(tickMs > 0 && Number.isFinite(tickMs))) {
    throw new RangeError(`tickMs must be a positive finite number, got ${String(tickMs)}`);
  }
  if (!(Number.isInteger(maxTicksPerFrame) && maxTicksPerFrame > 0)) {
    throw new RangeError(
      `maxTicksPerFrame must be a positive integer, got ${String(maxTicksPerFrame)}`,
    );
  }

  let running = false;
  let session = 0;
  let handle: number | undefined;
  let lastTimeMs = 0;
  let accumulatorMs = 0;

  function start(): void {
    if (running) {
      return;
    }
    running = true;
    accumulatorMs = 0;
    lastTimeMs = options.now();
    handle = options.requestFrame(frame);
  }

  function stop(): void {
    if (!running) {
      return;
    }
    running = false;
    session += 1;
    if (handle !== undefined) {
      options.cancelFrame(handle);
      handle = undefined;
    }
  }

  function frame(timeMs: number): void {
    handle = undefined;
    const frameSession = session;
    try {
      advance(timeMs, frameSession);
    } catch (error) {
      stop();
      throw error;
    }
    if (session === frameSession) {
      handle = options.requestFrame(frame);
    }
  }

  function advance(timeMs: number, frameSession: number): void {
    // The frame timestamp can precede the now() read in start().
    accumulatorMs += Math.max(0, timeMs - lastTimeMs);
    lastTimeMs = timeMs;
    let ticks = 0;
    while (accumulatorMs >= tickMs) {
      if (ticks === maxTicksPerFrame) {
        accumulatorMs = 0;
        break;
      }
      accumulatorMs -= tickMs;
      ticks += 1;
      callbacks.step();
      if (session !== frameSession) {
        return;
      }
    }
    callbacks.render(accumulatorMs / tickMs);
  }

  return {
    start,
    stop,
    get running() {
      return running;
    },
  };
}
