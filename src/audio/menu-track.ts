import type { Ambience } from './ambience';
import { createFader } from './fade';

// A part of a recording: its files under public/, in the order to try (the first one this browser
// decodes plays), and how many bars it lasts.
interface RecordingPart {
  readonly files: readonly string[];
  readonly bars: number;
}

// An artist's recording, played as it was mastered: only its level changes (ADR 0020). Its own files
// and bars are its loop: it loops on its last bar, its first beat on its first sample.
export interface Recording extends RecordingPart {
  // Played once, at the first entrance; at its last bar the loop takes over from its first sample.
  readonly opening?: RecordingPart;
  // The first bars of whichever part plays first, light enough to play at once while that part
  // decodes; they loop if it is late.
  readonly intro: RecordingPart;
  readonly bpm: number;
  // Integrated loudness of its master, one level for both parts.
  readonly lufs: number;
}

// « Ozoboom home screen 1.1 » by Timo Lissy: scripts/menu-track.ts writes its files from its parts.
export const MENU_RECORDING: Recording = {
  opening: { files: ['music/ozoboom-opening.webm', 'music/ozoboom-opening.m4a'], bars: 128 },
  files: ['music/ozoboom.webm', 'music/ozoboom.m4a'],
  intro: { files: ['music/ozoboom-intro.webm', 'music/ozoboom-intro.m4a'], bars: 8 },
  bpm: 145,
  bars: 128,
  lufs: -11.8,
};

// The synthesized ambience where it joins the music bus, which a recording matches.
const AMBIENCE_LUFS = -20.8;
// A part takes over from the one before on a bar at least this far ahead, to be scheduled in time.
const TAKE_OVER_LEAD_SECONDS = 0.2;

export function recordingGain(recording: Recording): number {
  return 10 ** ((AMBIENCE_LUFS - recording.lufs) / 20);
}

export function loopSeconds(recording: Recording, bars = recording.bars): number {
  return (bars * 4 * 60) / recording.bpm;
}

export type FetchFile = (file: string) => Promise<ArrayBuffer>;

const fetchPublic: FetchFile = async (file) => {
  const response = await fetch(`${import.meta.env.BASE_URL}${file}`);
  if (!response.ok) {
    throw new TypeError(`${file}: HTTP ${String(response.status)}`);
  }
  return response.arrayBuffer();
};

// Starts loading the first file of each part at once, so that they are there when the audio opens,
// at the first gesture; the others only if those do not decode. A failed load reaches decodeFiles,
// which awaits it: it is marked handled only so that the browser does not report it before.
export function prefetchRecording(recording: Recording, fetchFile = fetchPublic): FetchFile {
  const early = new Map<string, Promise<ArrayBuffer>>();
  for (const [first] of [recording.intro.files, recording.opening?.files ?? [], recording.files]) {
    if (first !== undefined) {
      const bytes = fetchFile(first);
      bytes.catch(() => undefined);
      early.set(first, bytes);
    }
  }
  return (file) => early.get(file) ?? fetchFile(file);
}

// null when no file decodes here, or the network fails.
export async function decodeFiles(
  context: BaseAudioContext,
  files: readonly string[],
  fetchFile: FetchFile = fetchPublic,
): Promise<AudioBuffer | null> {
  for (const file of files) {
    let bytes: ArrayBuffer;
    try {
      bytes = await fetchFile(file);
    } catch (error) {
      if (error instanceof TypeError) {
        return null;
      }
      throw error;
    }
    try {
      return await context.decodeAudioData(bytes);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'EncodingError')) {
        throw error;
      }
    }
  }
  return null;
}

// null as well on an unexpected failure, which still reaches the crash report, a tick later: a slot
// that fails this way plays its synth voice and never holds up the load of the others.
export async function decodeSlot(
  context: BaseAudioContext,
  files: readonly string[],
  fetchFile?: FetchFile,
): Promise<AudioBuffer | null> {
  try {
    return await decodeFiles(context, files, fetchFile);
  } catch (error) {
    queueMicrotask(() => {
      throw error;
    });
    return null;
  }
}

export type RecordingPartName = 'intro' | 'opening' | 'loop';

export interface RecordingLoad {
  readonly intro: Promise<AudioBuffer | null>;
  // Only for a recording with an opening. null here or for the loop: the ambience keeps the menus.
  readonly opening?: Promise<AudioBuffer | null>;
  readonly loop: Promise<AudioBuffer | null>;
}

export function loadRecording(
  context: BaseAudioContext,
  recording: Recording,
  fetchFile: FetchFile = fetchPublic,
): RecordingLoad {
  return {
    intro: decodeFiles(context, recording.intro.files, fetchFile),
    ...(recording.opening === undefined
      ? {}
      : { opening: decodeFiles(context, recording.opening.files, fetchFile) }),
    loop: decodeFiles(context, recording.files, fetchFile),
  };
}

export interface RecordingVoice extends Ambience {
  // Entered, it waits in silence for its first part; each part takes over from the one before.
  take(buffer: AudioBuffer, part: RecordingPartName): void;
}

interface Playing {
  readonly source: AudioBufferSourceNode;
  // When it sounds, and where its first beat falls, on the clock of the context.
  readonly from: number;
  readonly origin: number;
}

// The recording in place of the ambience: the same entrance and exit, over a bar.
export function createRecordingVoice(out: AudioNode, recording: Recording): RecordingVoice {
  const context = out.context;
  const level = context.createGain();
  level.gain.value = recordingGain(recording);
  const fade = context.createGain();
  const fader = createFader(fade.gain, context, 0);
  level.connect(fade);
  fade.connect(out);
  const beat = 60 / recording.bpm;
  const bar = 4 * beat;
  const introSeconds = loopSeconds(recording, recording.intro.bars);
  const openingBars = recording.opening?.bars ?? 0;
  const openingSeconds = loopSeconds(recording, openingBars);
  let first: 'opening' | 'loop' = recording.opening === undefined ? 'loop' : 'opening';
  let openingPlayed = false;
  const buffers: Record<RecordingPartName, AudioBuffer | null> = {
    intro: null,
    opening: null,
    loop: null,
  };
  const playing: Record<RecordingPartName, Playing | null> = {
    intro: null,
    opening: null,
    loop: null,
  };
  let wanted = false;
  let stopAt: number | null = null;

  const silent = () => Object.values(playing).every((part) => part === null);

  function play(buffer: AudioBuffer, from: number, offset: number, loopEnd?: number): Playing {
    const source = context.createBufferSource();
    source.buffer = buffer;
    if (loopEnd !== undefined) {
      source.loop = true;
      source.loopEnd = loopEnd;
    }
    source.connect(level);
    source.start(from, offset);
    return { source, from, origin: from - offset };
  }

  // The loop from its first sample, at the last bar of the opening, or on the first bar after it is
  // ready when it decoded late: the opening never repeats.
  function follow(opening: Playing, loop: AudioBuffer) {
    const ready = context.currentTime + TAKE_OVER_LEAD_SECONDS - opening.origin;
    const at = opening.origin + Math.max(openingBars, Math.ceil(ready / bar)) * bar;
    playing.loop = play(loop, at, 0, loopSeconds(recording));
  }

  function playFirst(buffer: AudioBuffer, from: number, offset: number) {
    if (first === 'loop') {
      playing.loop = play(buffer, from, offset, loopSeconds(recording));
      return;
    }
    const opening = play(buffer, from, offset);
    opening.source.stop(opening.origin + openingSeconds);
    playing.opening = opening;
    if (buffers.loop !== null) {
      follow(opening, buffers.loop);
    }
  }

  // Every entrance from silence starts on the first part: the opening until it has played once.
  function begin(at: number) {
    const head = buffers[first];
    if (head !== null) {
      playFirst(head, at, 0);
    } else if (buffers.intro !== null) {
      playing.intro = play(buffers.intro, at, 0, introSeconds);
    }
  }

  // On the next bar, where the first part plays the very note the intro would.
  function takeOver(intro: Playing, buffer: AudioBuffer) {
    const bars = Math.ceil((context.currentTime + TAKE_OVER_LEAD_SECONDS - intro.origin) / bar);
    const at = intro.origin + bars * bar;
    intro.source.stop(at);
    playFirst(buffer, at, (bars * bar) % introSeconds);
  }

  // Lets the decoded opening and intro be collected: every later entrance starts on the loop.
  function letOpeningGo() {
    for (const part of ['intro', 'opening'] as const) {
      playing[part]?.source.disconnect();
      playing[part] = null;
      buffers[part] = null;
    }
    first = 'loop';
    openingPlayed = true;
  }

  function silence() {
    for (const part of Object.values(playing)) {
      part?.source.stop();
      part?.source.disconnect();
    }
    playing.intro = null;
    playing.opening = null;
    playing.loop = null;
    stopAt = null;
  }

  return {
    enter(at) {
      wanted = true;
      stopAt = null;
      fader.to(1);
      if (silent()) {
        begin(Math.max(at, context.currentTime));
      }
    },
    leave() {
      wanted = false;
      if (silent()) {
        return;
      }
      stopAt = fader.to(0);
    },
    take(buffer, part) {
      if (openingPlayed && part !== 'loop') {
        return;
      }
      buffers[part] = buffer;
      if (!wanted) {
        return;
      }
      const { intro, opening, loop } = playing;
      if (silent()) {
        begin(context.currentTime);
      } else if (part === first && intro !== null && playing[first] === null) {
        takeOver(intro, buffer);
      } else if (part === 'loop' && opening !== null && loop === null) {
        follow(opening, buffer);
      }
    },
    pump() {
      if (silent()) {
        return false;
      }
      // Without this each entrance replays the opening; a bar late, as the output latency lags.
      if (
        first === 'opening' &&
        playing.loop !== null &&
        context.currentTime >= playing.loop.from + bar
      ) {
        letOpeningGo();
      }
      if (stopAt !== null && context.currentTime >= stopAt) {
        silence();
        return false;
      }
      return true;
    },
    // In beats since the first beat of the recording, its opening counted once.
    position(now) {
      const { intro, opening, loop } = playing;
      if (loop !== null && now >= loop.from) {
        return openingBars * 4 + (now - loop.origin) / beat;
      }
      if (opening !== null && now >= opening.from) {
        return now < opening.origin + openingSeconds ? (now - opening.origin) / beat : null;
      }
      if (intro !== null && now >= intro.from) {
        return ((now - intro.origin) % introSeconds) / beat;
      }
      return null;
    },
  };
}
