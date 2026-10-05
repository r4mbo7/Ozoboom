import { describe, expect, it } from 'vitest';
import { HOST_SILENCE_MS, createSilenceWatchdog } from './online';

describe('createSilenceWatchdog', () => {
  it('expires once the host has been silent for longer than the limit', () => {
    let clock = 1000;
    const watchdog = createSilenceWatchdog(() => clock, HOST_SILENCE_MS);

    clock += HOST_SILENCE_MS;
    expect(watchdog.expired()).toBe(false);
    clock += 1;

    expect(watchdog.expired()).toBe(true);
  });

  it('starts counting again at every message heard', () => {
    let clock = 0;
    const watchdog = createSilenceWatchdog(() => clock, HOST_SILENCE_MS);
    clock += HOST_SILENCE_MS;

    watchdog.heard();
    clock += HOST_SILENCE_MS;

    expect(watchdog.expired()).toBe(false);
  });
});
