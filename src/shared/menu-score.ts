export const CHORD_EIGHTHS = 16;
export const ARP_NOTES = 5;
// Steps up the chord from its lowest note; null is a rest.
const ARP_PATTERN = [0, 2, 1, 3, null, 2, 4, null, 0, 3, 1, 4, null, 2, null, 1] as const;

export function arpStepAt(eighth: number): number | null {
  return ARP_PATTERN[((eighth % CHORD_EIGHTHS) + CHORD_EIGHTHS) % CHORD_EIGHTHS] ?? null;
}

// What the menus play as it is heard: the synthesized ambience, or the menu track.
export interface MenuHeard {
  readonly music: 'ambience' | 'track';
  // In beats since its first note: one eighth of the half-time ambience lasts a beat.
  readonly beats: number;
}
