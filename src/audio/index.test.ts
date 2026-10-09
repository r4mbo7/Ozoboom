import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_OPTIONS } from '../sim/fixtures';
import { createSimulation } from '../sim/index';
import { createAudioEngine } from './index';

// Any node, param or method of the audio graph: enough to build the engine without Web Audio.
const anyNode: unknown = new Proxy(() => undefined, {
  get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : key === 'then' ? undefined : anyNode),
  apply: () => anyNode,
  set: () => true,
});

// A context the browser keeps suspended until a gesture.
class GatedAudioContext {
  state: AudioContextState = 'suspended';
  readonly currentTime = 0;
  readonly resume = vi.fn(() => Promise.resolve());

  constructor() {
    return new Proxy(this, {
      get: (target, key) => (key in target ? Reflect.get(target, key) : anyNode),
    });
  }
}

describe('createAudioEngine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resumes on each start a context opened before any gesture, until it runs', async () => {
    vi.stubGlobal('AudioContext', GatedAudioContext);
    const context = new GatedAudioContext();
    const engine = createAudioEngine({
      createContext: () => context as unknown as BaseAudioContext,
    });
    await engine.start();

    await engine.start();
    context.state = 'running';
    await engine.start();

    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it('creates no audio context and plays nothing before start', () => {
    const createContext = vi.fn<() => BaseAudioContext>();
    const engine = createAudioEngine({ createContext });
    const { state } = createSimulation(FIXTURE_OPTIONS);
    state.events.push({ type: 'gameWon' });

    engine.setMuted(true);
    engine.update(state);
    engine.setMuted(false);
    engine.destroy();

    expect(createContext).not.toHaveBeenCalled();
  });

  it('plays no cue and creates no audio context before start', () => {
    const createContext = vi.fn<() => BaseAudioContext>();
    const engine = createAudioEngine({ createContext });

    engine.cue('seatTaken');
    engine.cue('launch');
    engine.destroy();

    expect(createContext).not.toHaveBeenCalled();
  });

  it('starts no menu ambience and no timer before start', () => {
    const createContext = vi.fn<() => BaseAudioContext>();
    const repeat = vi.fn<(callback: () => void) => () => void>();
    const engine = createAudioEngine({ createContext, repeat });

    engine.setMood('menu');
    engine.setMood('set');
    engine.setMood('menu');
    engine.destroy();

    expect(createContext).not.toHaveBeenCalled();
    expect(repeat).not.toHaveBeenCalled();
  });
});
