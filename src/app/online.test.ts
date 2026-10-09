import { describe, expect, it } from 'vitest';
import { HOST_SILENCE_MS, connectionText, createSilenceWatchdog } from './online';

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

describe('connectionText', () => {
  it('tells the guest the networks cannot reach each other when ICE fails', () => {
    const error = new Error('the room ABCD exists but the networks cannot reach each other');

    const text = connectionText(error);

    expect(text).toBe('Le salon existe, mais vos réseaux n’arrivent pas à se joindre');
  });

  it('keeps the timeout message for a room that never answered', () => {
    const error = new Error('no answer from the room ABCD within 15000 ms');

    const text = connectionText(error);

    expect(text).toBe('Pas de réponse : réessaie, ou vérifie le code');
  });
});
