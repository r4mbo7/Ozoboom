export const RING_STEPS = 24;

// The help ring is drawn in RING_STEPS cuts: the cut to show for helpTicks out of helpTotal.
export function ringStep(helpTicks: number, helpTotal: number): number {
  if (!(helpTotal > 0)) {
    return 0;
  }
  return Math.round(Math.min(1, Math.max(0, helpTicks / helpTotal)) * RING_STEPS);
}
