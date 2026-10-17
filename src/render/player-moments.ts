import type { PlayerId } from '../sim/state';

const NEVER = Number.NEGATIVE_INFINITY;

export interface Moments {
  fired: number;
  fireCount: number;
  hit: number;
  skill: number;
}

// The last ticks a player fired, was hit or used its skill, for what the looks and the arcs show of them.
export class MomentLog {
  private readonly items = new Map<PlayerId, Moments>();

  of(id: PlayerId): Moments {
    let found = this.items.get(id);
    if (found === undefined) {
      found = { fired: NEVER, fireCount: 0, hit: NEVER, skill: NEVER };
      this.items.set(id, found);
    }
    return found;
  }

  clear(): void {
    this.items.clear();
  }
}
