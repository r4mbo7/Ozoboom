import { LOUDEST_PEAK, MUSIC_BUS_GAIN, SFX_BUS_GAIN } from './master';
import { decodeSlot, type FetchFile } from './menu-track';
import { parseNote, semitonesToRoot } from './pitch';
import type { MusicKey } from './scale';
import type { SampleVoice, SfxSamples } from './sfx';
import { hitNameOf, hitSlotId, sfxSlotId, shotSlotId, type HitName } from './slot-ids';
import type { SampleFile } from './sound-file';

// The artists' files of the effects and of the music's own hits, decoded for one context (ADR 0022,
// ADR 0027).
export interface SampleBank extends SfxSamples {
  // Settles once every file has decoded or failed: an offline render waits for it.
  readonly loaded: Promise<void>;
  // One of the game's own music sounds, absent until it has a decoded file (ADR 0027).
  hit(name: HitName, key: MusicKey): SampleVoice | undefined;
}

// The file brought to the level of the synth voice it replaces, never louder than the limiter takes
// on its bus.
function sampleGain(slotId: string, { lufs, peak }: SampleFile, referenceLufs: number): number {
  const bus = hitNameOf(slotId) === undefined ? SFX_BUS_GAIN : MUSIC_BUS_GAIN;
  return Math.min(10 ** ((referenceLufs - lufs) / 20), LOUDEST_PEAK / (peak * bus));
}

// A shot of an attack kind replaces the shared shot.
function referenceOf(slotId: string, references: Readonly<Record<string, number>>): number {
  const sound = slotId.startsWith(shotSlotId(''))
    ? 'playerFired'
    : slotId.slice(slotId.indexOf('/') + 1);
  const reference = references[sound];
  if (reference === undefined) {
    throw new Error(`No reference level for the sound of the slot ${slotId}`);
  }
  return reference;
}

// A decoded file of a slot, with the MIDI note it was declared in, null when it has none.
interface DecodedFile {
  readonly buffer: AudioBuffer;
  readonly gain: number;
  readonly seconds: number;
  readonly midi: number | null;
}

function midiOf(slotId: string, { note }: SampleFile): number | null {
  if (note === undefined) {
    return null;
  }
  const parsed = parseNote(note);
  if (parsed === null) {
    throw new Error(`Unknown note ${note} on the slot ${slotId}`);
  }
  return parsed.midi;
}

// A small sampler (K7): the decoded file nearest to the root of the track, repitched to it, the
// lowest on a tie; a file with no note plays as it is.
function voiceAt(
  files: readonly (DecodedFile | undefined)[] | undefined,
  { rootMidi }: Pick<MusicKey, 'rootMidi'>,
): SampleVoice | undefined {
  let nearest: { readonly file: DecodedFile; readonly semitones: number } | undefined;
  for (const file of files ?? []) {
    if (file === undefined) {
      continue;
    }
    const semitones = file.midi === null ? 0 : semitonesToRoot(file.midi, rootMidi);
    if (nearest === undefined || Math.abs(semitones) < Math.abs(nearest.semitones)) {
      nearest = { file, semitones };
    }
  }
  if (nearest === undefined) {
    return undefined;
  }
  const { buffer, gain, seconds } = nearest.file;
  const rate = 2 ** (nearest.semitones / 12);
  return {
    seconds: seconds / rate,
    play(out, at) {
      const source = out.context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      const level = out.context.createGain();
      level.gain.value = gain;
      source.connect(level);
      level.connect(out);
      source.start(at);
    },
  };
}

// Starts decoding at once; each sound plays its synth voice until a file of its slot is decoded,
// and for good when they are absent or do not decode. A slot holds one file without a note, or
// noted files from the lowest pitch up, each at its own gain.
export function loadSamples(
  context: BaseAudioContext,
  samples: Readonly<Record<string, readonly SampleFile[]>>,
  references: Readonly<Record<string, number>>,
  fetchFile?: FetchFile,
): SampleBank {
  // By slot, in the registry's order; a file is set once decoded.
  const decoded = new Map<string, (DecodedFile | undefined)[]>();
  const loads = Object.entries(samples).flatMap(([slotId, files]) => {
    if (files.length === 0) {
      return [];
    }
    const reference = referenceOf(slotId, references);
    const slot: (DecodedFile | undefined)[] = files.map(() => undefined);
    decoded.set(slotId, slot);
    return files.map((file, index) => {
      const midi = midiOf(slotId, file);
      const gain = sampleGain(slotId, file, reference);
      return decodeSlot(context, file.files, fetchFile).then((buffer) => {
        if (buffer !== null) {
          slot[index] = { buffer, gain, seconds: file.seconds, midi };
        }
      });
    });
  });
  return {
    loaded: Promise.all(loads).then(() => undefined),
    sound: (name, key) => voiceAt(decoded.get(sfxSlotId(name)), key),
    shot: (attackKind, key) => voiceAt(decoded.get(shotSlotId(attackKind)), key),
    hit: (name, key) => voiceAt(decoded.get(hitSlotId(name)), key),
  };
}
