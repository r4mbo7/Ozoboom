import type { MusicTrack, SetDefinition } from '../data/types';
import { nextFloat, seedRng } from '../shared/prng';

// Any track but the last one played, so that two games in a row never sound the same.
export function drawTrack(
  tracks: readonly MusicTrack[],
  lastId: string,
  random: () => number,
): MusicTrack {
  const fresh = tracks.filter((track) => track.id !== lastId);
  const pool = fresh.length > 0 ? fresh : tracks;
  return pickOf(pool, Math.floor(random() * pool.length));
}

export function stageTracks(
  tracks: readonly MusicTrack[],
  trackIds: readonly string[],
): readonly MusicTrack[] {
  return tracks.filter((track) => trackIds.includes(track.id));
}

// A track sent by another device that this one does not know plays as the first.
export function trackOf(tracks: readonly MusicTrack[], id: string): MusicTrack {
  return tracks.find((track) => track.id === id) ?? pickOf(tracks, 0);
}

// The line-up poster a run of `trackId` opens on: one of those that list it, the same on every peer.
export function posterOf(set: SetDefinition, trackId: string, seed: number): string {
  const posters = set.posters ?? [];
  const listed = posters.filter((poster) => poster.trackIds.includes(trackId));
  const pool = listed.length > 0 ? listed : posters.slice(0, 1);
  const poster = pool[Math.floor(seededRandom(seed, 'poster')() * pool.length)];
  if (poster === undefined) {
    throw new Error(`No poster for the stage ${set.id}`);
  }
  return poster.id;
}

function pickOf(tracks: readonly MusicTrack[], index: number): MusicTrack {
  const track = tracks[index];
  if (track === undefined) {
    throw new Error('No track to play');
  }
  return track;
}

// The same draw on every peer of a game: a generator seeded by the game's seed and `key`.
export function seededRandom(seed: number, key: string): () => number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (const char of key) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  const rng = seedRng(hash);
  return () => nextFloat(rng);
}
