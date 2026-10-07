import type { MusicTrack } from '../data/types';

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

// A track sent by another device that this one does not know plays as the first.
export function trackOf(tracks: readonly MusicTrack[], id: string): MusicTrack {
  return tracks.find((track) => track.id === id) ?? pickOf(tracks, 0);
}

function pickOf(tracks: readonly MusicTrack[], index: number): MusicTrack {
  const track = tracks[index];
  if (track === undefined) {
    throw new Error('No track to play');
  }
  return track;
}
