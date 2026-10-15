import type { Tempo } from '../shared/tempo';

export const VIBE_GLOW = { perVibe: 0.55, cap: 1.6, decayBeats: 0.39, bounce: 0.1 } as const;

// The level it had at a tick: what it is at any later moment follows, with nothing to step.
export interface VibeGlow {
  level: number;
  tick: number;
}

export function createVibeGlow(): VibeGlow {
  return { level: 0, tick: 0 };
}

export function glowAt(glow: VibeGlow, now: number, { ticksPerBeat }: Tempo): number {
  const beats = Math.max(0, now - glow.tick) / ticksPerBeat;
  return glow.level * Math.exp(-beats / VIBE_GLOW.decayBeats);
}

export function lightUp(glow: VibeGlow, now: number, tempo: Tempo): void {
  glow.level = Math.min(VIBE_GLOW.cap, glowAt(glow, now, tempo) + VIBE_GLOW.perVibe);
  glow.tick = now;
}

export function glowLit(level: number, calm: boolean): number {
  return Math.min(level, 1) * (calm ? 0.5 : 1);
}

export function glowBounce(level: number, calm: boolean): number {
  return calm ? 1 : 1 + VIBE_GLOW.bounce * Math.min(level, 1);
}
