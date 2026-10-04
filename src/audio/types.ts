import type { SimState } from '../sim/state';

export interface AudioEngine {
  start(): Promise<void>;
  update(state: SimState): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}
