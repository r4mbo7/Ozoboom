export interface FpsMeter {
  frame(timeMs: number): void;
  // Frames per second since the page loaded, or null before two frames.
  average(): number | null;
}

// Past this gap the tab was hidden or the machine asleep: no frame was drawn, nothing to count.
const MAX_FRAME_MS = 1000;

export function createFpsMeter(): FpsMeter {
  let last: number | null = null;
  let frames = 0;
  let elapsedMs = 0;
  return {
    frame(timeMs) {
      if (last !== null) {
        const delta = timeMs - last;
        if (delta > 0 && delta <= MAX_FRAME_MS) {
          frames += 1;
          elapsedMs += delta;
        }
      }
      last = timeMs;
    },
    average() {
      return elapsedMs > 0 ? (frames * 1000) / elapsedMs : null;
    },
  };
}
