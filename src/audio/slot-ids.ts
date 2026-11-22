import type { SetSegment } from '../sim/state';

// The ids of the slots an artist's file goes on (ADR 0022), as a person types them. Apart from the
// content, so that the engine reaches them without loading it.

export const sfxSlotId = (soundName: string): string => `sfx/${soundName}`;

export const shotSlotId = (attackKind: string): string => `shot/${attackKind}`;

export const stemSlotId = (trackId: string, speakerId: string): string =>
  `stem/${trackId}/${speakerId}`;

// The tier's slot, counted from 1 (`tierIndex` is `SetProgress.tier`, from 0), then the track's.
export function momentSlotIds(
  part: 'loop' | 'opening',
  trackId: string,
  tierIndex: number,
  moment: SetSegment,
): readonly [tier: string, track: string] {
  return [`${part}/${trackId}/${String(tierIndex + 1)}/${moment}`, `${part}/${trackId}/${moment}`];
}

const MUSIC_PARTS = ['loop', 'opening', 'stem'] as const;

// The track a music slot belongs to, and which part of it; null for a sample slot.
export function musicSlotOf(
  slotId: string,
): { readonly part: (typeof MUSIC_PARTS)[number]; readonly trackId: string } | null {
  const [part, trackId] = slotId.split('/');
  const known = MUSIC_PARTS.find((candidate) => candidate === part);
  return known === undefined || trackId === undefined ? null : { part: known, trackId };
}
