import type { PlayerCommand } from '../sim/commands';
import { createSimulation, type SimulationOptions } from '../sim';
import type { SimEvent, SimState } from '../sim/state';

export interface Session {
  // The live sim state: its events are those of the last step only.
  readonly state: SimState;
  // The same state, whose events are those of every step since the last endFrame().
  readonly frame: SimState;
  step(commands: readonly PlayerCommand[]): void;
  endFrame(): void;
}

// The renderer and the interface see the state once a frame, the sim once a step.
export function createSession(options: SimulationOptions): Session {
  const simulation = createSimulation(options);
  const { state } = simulation;
  const frameEvents: SimEvent[] = [...state.events];
  const frame = new Proxy(state, {
    get(target, key, receiver) {
      if (key === 'events') {
        return frameEvents;
      }
      const value: unknown = Reflect.get(target, key, receiver);
      return value;
    },
  });

  return {
    state,
    frame,
    step(commands) {
      simulation.step(commands);
      frameEvents.push(...state.events);
    },
    endFrame() {
      frameEvents.length = 0;
    },
  };
}
