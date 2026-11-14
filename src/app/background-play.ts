import { dueTicks } from './loop';

export interface BackgroundEnv {
  readonly tickMs: number;
  now(): number;
  hiddenOnline(): boolean;
  standStill(): void;
  play(ticks: number): void;
}

export interface BackgroundPlay {
  start(): void;
  stop(): void;
}

// Chrome wakes a hidden tab's timers once a second: a wake plays every tick it owes, up to two
// seconds' worth, and a tab frozen longer drops the rest.
const WAKE_BUDGET_MS = 2000;

// A hidden tab gets no animation frames; browsers slow timers in the background, so best effort.
export function createBackgroundPlay(env: BackgroundEnv): BackgroundPlay {
  const maxTicks = Math.ceil(WAKE_BUDGET_MS / env.tickMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let since = 0;

  function run(): void {
    timer = undefined;
    if (!env.hiddenOnline()) {
      return;
    }
    const now = env.now();
    const { ticks, spentMs } = dueTicks(now - since, env.tickMs, maxTicks);
    since = ticks === 0 ? since : Math.min(now, since + spentMs);
    env.play(ticks);
    timer = setTimeout(run, env.tickMs);
  }

  return {
    start() {
      if (timer === undefined && env.hiddenOnline()) {
        env.standStill();
        since = env.now();
        timer = setTimeout(run, env.tickMs);
      }
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
