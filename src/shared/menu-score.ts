// The score of the menu ambience: the audio plays it and the title screen follows it.
export const CHORD_EIGHTHS = 16;
export const ARP_NOTES = 5;
// A step into the notes of the chord, from the lowest; null is a rest.
const ARP_PATTERN = [0, 2, 1, 3, null, 2, 4, null, 0, 3, 1, 4, null, 2, null, 1] as const;

export function arpStepAt(eighth: number): number | null {
  return ARP_PATTERN[((eighth % CHORD_EIGHTHS) + CHORD_EIGHTHS) % CHORD_EIGHTHS] ?? null;
}
