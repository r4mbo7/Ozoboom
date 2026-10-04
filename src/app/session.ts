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

// The loop can run several steps per frame, but the renderer and the interface only see the state
// once per frame: they read the events of every step of the frame through a view of the state,
// while the sim keeps its own last-step events.
export function createSession(options: SimulationOptions): Session {
  const simulation = createSimulation(options);
  const { state } = simulation;
  const frameEvents: SimEvent[] = [...state.events];
  const frame = new Proxy(state, {
    get(target, key, receiver) {
      return key === 'events' ? frameEvents : (Reflect.get(target, key, receiver) as unknown);
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
