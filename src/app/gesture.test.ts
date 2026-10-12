import { describe, expect, it } from 'vitest';
import { openAudioOnGesture, type GestureSource } from './gesture';

type Listener = (event: Event) => void;

function page() {
  const listeners = new Map<string, Listener>();
  const source: GestureSource = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
  };
  return {
    source,
    listeners,
    fire: (type: string, pointerType?: string) => {
      listeners.get(type)?.({ type, pointerType } as unknown as Event);
    },
  };
}

// An audio the browser keeps shut until it counts a gesture: a start asked before never settles.
function gatedAudio() {
  const waiting: (() => void)[] = [];
  let starts = 0;
  return {
    get starts() {
      return starts;
    },
    start: () => {
      starts += 1;
      return new Promise<void>((resolve) => waiting.push(resolve));
    },
    async accept() {
      waiting.splice(0).forEach((resolve) => {
        resolve();
      });
      await Promise.resolve();
    },
  };
}

describe('openAudioOnGesture', () => {
  it('asks again on the next gesture when the browser did not count the first one', () => {
    const { source, fire } = page();
    const audio = gatedAudio();
    openAudioOnGesture(source, audio.start);
    fire('keydown');

    fire('pointerdown', 'mouse');

    expect(audio.starts).toBe(2);
  });

  it('stops listening once the audio runs', async () => {
    const { source, listeners, fire } = page();
    const audio = gatedAudio();
    openAudioOnGesture(source, audio.start);
    fire('keydown');
    fire('keydown');

    await audio.accept();

    expect([...listeners.keys()]).toEqual([]);
  });

  it('counts a finger only when it lifts', () => {
    const { source, fire } = page();
    const audio = gatedAudio();
    openAudioOnGesture(source, audio.start);

    fire('pointerdown', 'touch');
    fire('pointerup', 'touch');

    expect(audio.starts).toBe(1);
  });

  it('counts a pad button once per press, until the audio runs', async () => {
    const { source } = page();
    const audio = gatedAudio();
    const gate = openAudioOnGesture(source, audio.start);
    gate.pad(() => true);
    gate.pad(() => true);
    gate.pad(() => false);
    gate.pad(() => true);
    await audio.accept();

    gate.pad(() => false);
    gate.pad(() => true);

    expect(audio.starts).toBe(2);
  });
});
