import type { MusicTrack } from '../data/types';
import type { Tempo } from '../shared/tempo';
import { beatSeconds } from './clock';
import { levelledFiles, loopGain } from './loop-deck';
import { decodeSlot, type FetchFile } from './menu-track';
import { type MusicKey, midiToHz } from './scale';
import { entrySlotId, musicSlotOf } from './slot-ids';
import type { LoopFile } from './sound-file';
import { playNoise, playTone } from './synth';

const ENTRY_BEATS = 8;
const TEAR_BEAT = 4;
const KICK_FROM_HZ = 150;

type Cue = (out: AudioNode, at: number, beat: number) => void;

// Under the poster, a riser over both bars and a muffled kick on each beat that falls to the root.
function poster(key: MusicKey): [number, Cue][] {
  const riser: Cue = (out, at, beat) =>
    playNoise(out, at, {
      gain: 0.22,
      attack: ENTRY_BEATS * beat - 0.02,
      hold: 0,
      release: 0.02,
      filter: { type: 'bandpass', hz: 300, toHz: 7000, glide: ENTRY_BEATS * beat, q: 1.2 },
    });
  const kicks = [0, 1, 2, 3].map((beatIndex): [number, Cue] => {
    const swell = beatIndex / 3;
    return [
      beatIndex,
      (out, at) =>
        playTone(out, at, {
          wave: 'sine',
          hz: KICK_FROM_HZ,
          toHz: midiToHz(key.rootMidi),
          glide: 0.09,
          gain: 0.4 + 0.3 * swell,
          attack: 0.001,
          hold: 0.03,
          release: 0.2,
          filter: { type: 'lowpass', hz: 120 + 100 * swell, q: 0.7 },
        }),
    ];
  });
  return [[0, riser], ...kicks];
}

// The tear, then the whoosh of the dive down to the landing.
function dive(): [number, Cue][] {
  const rip: Cue = (out, at) =>
    playNoise(out, at, {
      gain: 0.26,
      attack: 0.002,
      hold: 0.06,
      release: 0.14,
      filter: { type: 'bandpass', hz: 2600, toHz: 700, glide: 0.18, q: 2.5 },
    });
  const whoosh: Cue = (out, at, beat) => {
    const seconds = (ENTRY_BEATS - TEAR_BEAT) * beat;
    for (const [pan, hz, q] of [
      [-0.35, 3600, 1.6],
      [0.35, 2600, 2.2],
    ] as const) {
      playNoise(out, at, {
        gain: 0.26,
        attack: seconds * 0.9,
        hold: seconds * 0.06,
        release: 0.12,
        pan,
        filter: { type: 'bandpass', hz, toHz: 180, glide: seconds, q },
      });
    }
  };
  return [
    [TEAR_BEAT, rip],
    [TEAR_BEAT, whoosh],
  ];
}

const crash: Cue = (out, at) => {
  playNoise(out, at, {
    gain: 0.2,
    attack: 0.001,
    hold: 0.02,
    release: 1.4,
    filter: { type: 'highpass', hz: 4500 },
  });
  playNoise(out, at, {
    gain: 0.1,
    attack: 0.001,
    hold: 0.01,
    release: 0.6,
    filter: { type: 'bandpass', hz: 8000, q: 0.8 },
  });
};

// The entry's sounds in the key and at the tempo of the track, the landing at `landsAt`, each on its
// beat of the two bars before; one already due before `now` stays unplayed.
export function playEntrySounds(
  out: AudioNode,
  landsAt: number,
  now: number,
  tempo: Tempo,
  key: MusicKey,
): void {
  const beat = beatSeconds(tempo);
  const startsAt = landsAt - ENTRY_BEATS * beat;
  const cues: [number, Cue][] = [...poster(key), ...dive(), [ENTRY_BEATS, crash]];
  for (const [beatIndex, cue] of cues) {
    const at = startsAt + beatIndex * beat;
    if (at >= now) {
      cue(out, at, beat);
    }
  }
}

export interface EntrySounds {
  // Settles once every entry file has decoded or failed.
  readonly loaded: Promise<void>;
  // The entry of `track` landing at `landsAt` (ADR 0027): its artist's file once decoded, from where
  // it is at `now` when it starts late; nothing when he silenced it; the synth's sounds otherwise.
  play(out: AudioNode, landsAt: number, now: number, tempo: Tempo, track: MusicTrack): void;
}

interface DecodedEntry {
  readonly buffer: AudioBuffer;
  readonly gain: number;
}

// Decodes every track's entry at once, so that the first run already opens on it, each at the gain
// of its track's files: the artist's balance between the entry and the buildup it lands in.
export function loadEntrySounds(
  context: BaseAudioContext,
  music: Readonly<Record<string, LoopFile>>,
  silent: readonly string[] = [],
  fetchFile?: FetchFile,
): EntrySounds {
  const decoded = new Map<string, DecodedEntry>();
  const loads = Object.entries(music).flatMap(([slotId, file]) => {
    const slot = musicSlotOf(slotId);
    if (slot?.part !== 'entry') {
      return [];
    }
    const gain = loopGain(levelledFiles(music, slot.trackId));
    return [
      decodeSlot(context, file.files, fetchFile).then((buffer) => {
        if (buffer !== null) {
          decoded.set(slot.trackId, { buffer, gain });
        }
      }),
    ];
  });
  return {
    loaded: Promise.all(loads).then(() => undefined),
    play(out, landsAt, now, tempo, track) {
      if (silent.includes(entrySlotId(track.id))) {
        return;
      }
      const file = decoded.get(track.id);
      if (file === undefined) {
        playEntrySounds(out, landsAt, now, tempo, track);
        return;
      }
      const startsAt = landsAt - ENTRY_BEATS * beatSeconds(tempo);
      const late = Math.max(0, now - startsAt);
      if (late >= file.buffer.duration) {
        return;
      }
      const source = out.context.createBufferSource();
      source.buffer = file.buffer;
      const level = out.context.createGain();
      level.gain.value = file.gain;
      source.connect(level);
      level.connect(out);
      source.start(startsAt + late, late);
    },
  };
}
