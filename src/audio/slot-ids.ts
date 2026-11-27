import type { SetSegment } from '../sim/state';

// The ids of the slots an artist's file goes on (ADR 0022), as a person types them. Apart from the
// content, so that the engine reaches them without loading it.

export const sfxSlotId = (soundName: string): string => `sfx/${soundName}`;

export const shotSlotId = (attackKind: string): string => `shot/${attackKind}`;

// The game's own music sounds (ADR 0027), each one slot shared by every track.
export const HIT_NAMES = [
  'downlifter',
  'impact',
  'heartbeat',
  'arrival',
  'sunrise',
  'powerDown',
] as const;

export type HitName = (typeof HIT_NAMES)[number];

export const hitSlotId = (name: HitName): string => `hit/${name}`;

export const hitNameOf = (slotId: string): HitName | undefined =>
  HIT_NAMES.find((name) => hitSlotId(name) === slotId);

export const stemSlotId = (trackId: string, speakerId: string): string =>
  `stem/${trackId}/${speakerId}`;

export const entrySlotId = (trackId: string): string => `entry/${trackId}`;

export const heartbeatSlotId = (trackId: string): string => `heartbeat/${trackId}`;

// The tier's slot, counted from 1 (`tierIndex` is `SetProgress.tier`, from 0), then the track's.
export function momentSlotIds(
  part: 'loop' | 'opening',
  trackId: string,
  tierIndex: number,
  moment: SetSegment,
): readonly [tier: string, track: string] {
  return [`${part}/${trackId}/${String(tierIndex + 1)}/${moment}`, `${part}/${trackId}/${moment}`];
}

const MUSIC_PARTS = ['loop', 'opening', 'stem', 'entry', 'heartbeat'] as const;

// The track a music slot belongs to, and which part of it; null for a sample slot.
export function musicSlotOf(
  slotId: string,
): { readonly part: (typeof MUSIC_PARTS)[number]; readonly trackId: string } | null {
  const [part, trackId] = slotId.split('/');
  const known = MUSIC_PARTS.find((candidate) => candidate === part);
  return known === undefined || trackId === undefined ? null : { part: known, trackId };
}
