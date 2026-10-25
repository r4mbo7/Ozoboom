const ROUND_TRIP_REFRESH_MS = 2000;
const WATCH_MS = 1000;

export interface SilenceWatchdog {
  heard(): void;
  expired(): boolean;
}

export function createSilenceWatchdog(now: () => number, timeoutMs: number): SilenceWatchdog {
  let last = now();
  return {
    heard() {
      last = now();
    },
    expired() {
      return now() - last > timeoutMs;
    },
  };
}

export interface HostWatch {
  heard(): void;
  start(): void;
  stop(): void;
}

export interface HostWatchEnv {
  now(): number;
  readonly timeoutMs: number;
  watching(): boolean;
  silent(): void;
}

export function createHostWatch(env: HostWatchEnv): HostWatch {
  const silence = createSilenceWatchdog(() => env.now(), env.timeoutMs);
  let watch: ReturnType<typeof setInterval> | undefined;
  return {
    heard() {
      silence.heard();
    },
    start() {
      silence.heard();
      clearInterval(watch);
      watch = setInterval(() => {
        if (env.watching() && silence.expired()) {
          env.silent();
        }
      }, WATCH_MS);
    },
    stop() {
      clearInterval(watch);
      watch = undefined;
    },
  };
}

export interface RoundTripProbe {
  readonly ms: number | null;
  start(): void;
  stop(): void;
}

export function createRoundTripProbe(
  measure: () => Promise<number | null> | undefined,
): RoundTripProbe {
  let ms: number | null = null;
  let refresh: ReturnType<typeof setInterval> | undefined;
  return {
    get ms() {
      return ms;
    },
    start() {
      clearInterval(refresh);
      refresh = setInterval(() => {
        void measure()?.then((value) => {
          ms = value;
        });
      }, ROUND_TRIP_REFRESH_MS);
    },
    stop() {
      clearInterval(refresh);
      refresh = undefined;
      ms = null;
    },
  };
}
