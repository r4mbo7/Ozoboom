import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_OPTIONS } from '../sim/fixtures';
import { createSimulation } from '../sim/index';
import { createAudioEngine } from './index';

describe('createAudioEngine', () => {
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
});
