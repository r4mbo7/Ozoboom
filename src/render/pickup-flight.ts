import type { PickupState } from '../sim/state';
import { lerp } from './motion';

export const ARC_HEIGHT = 150;
const ARC_GROWTH = 0.7;
// Share of the flight after which the vibe is fully lit.
const FADE_IN = 0.25;

export interface FlightPose {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  // 0 as it leaves its speaker, 1 once on the ground.
  progress: number;
}

// Where a vibe is drawn: a bell from its speaker to its landing spot while it flies. In calm mode
// it does not fly, it fades in where it lands.
export function flightPose(pickup: PickupState, alpha: number, calm: boolean): FlightPose {
  const { flight } = pickup;
  if (flight === undefined) {
    return {
      x: lerp(pickup.prevX, pickup.x, alpha),
      y: lerp(pickup.prevY, pickup.y, alpha),
      scale: 1,
      alpha: 1,
      progress: 1,
    };
  }
  const progress = Math.min(1, (flight.ticks - flight.ticksLeft + alpha) / flight.ticks);
  if (calm) {
    return { x: pickup.x, y: pickup.y, scale: 1, alpha: progress, progress };
  }
  const bell = Math.sin(Math.PI * progress);
  return {
    x: lerp(flight.fromX, pickup.x, progress),
    y: lerp(flight.fromY, pickup.y, progress) - ARC_HEIGHT * bell,
    scale: 1 + ARC_GROWTH * bell,
    alpha: Math.min(1, progress / FADE_IN),
    progress,
  };
}
