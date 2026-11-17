import type { Ambience } from './ambience';
import { createFader } from './fade';

// An artist's recording, played as it was mastered: only its level changes (ADR 0020).
export interface Recording {
  // Under public/, in the order to try: the first one this browser decodes plays.
  readonly files: readonly string[];
  // Its first bars, light enough to play at once while the whole decodes; they loop if it is late.
  readonly intro: { readonly files: readonly string[]; readonly bars: number };
  readonly bpm: number;
  // It loops on its last bar, its first beat on its first sample.
  readonly bars: number;
  // Integrated loudness of its master.
  readonly lufs: number;
}

// « Ozoboom » by Timo Lissy, for the menus. scripts/menu-track.ts writes its files from the master.
export const MENU_RECORDING: Recording = {
  files: ['music/ozoboom.webm', 'music/ozoboom.m4a'],
  intro: { files: ['music/ozoboom-intro.webm', 'music/ozoboom-intro.m4a'], bars: 8 },
  bpm: 145,
  bars: 128,
  lufs: -8.7,
};

// The synthesized ambience where it joins the music bus, which a recording matches.
const AMBIENCE_LUFS = -20.8;
// The whole takes over from the intro on a bar at least this far ahead, to be scheduled in time.
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

// Starts loading the first file of the intro and of the whole at once, so that they are there when
// the audio opens, at the first gesture; the others only if those do not decode. A failed load
// reaches decodeFiles, which awaits it: it is marked handled only so that the browser does not
// report it before.
export function prefetchRecording(recording: Recording, fetchFile = fetchPublic): FetchFile {
  const early = new Map<string, Promise<ArrayBuffer>>();
  for (const [first] of [recording.intro.files, recording.files]) {
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

export interface RecordingLoad {
  readonly intro: Promise<AudioBuffer | null>;
  // null: the ambience keeps the menus.
  readonly whole: Promise<AudioBuffer | null>;
}

export function loadRecording(
  context: BaseAudioContext,
  recording: Recording,
  fetchFile: FetchFile = fetchPublic,
): RecordingLoad {
  return {
    intro: decodeFiles(context, recording.intro.files, fetchFile),
    whole: decodeFiles(context, recording.files, fetchFile),
  };
}

export interface RecordingVoice extends Ambience {
  // Entered, it waits in silence for its first part, and the whole takes over from the intro.
  take(buffer: AudioBuffer, part: 'intro' | 'whole'): void;
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
  const buffers: { intro: AudioBuffer | null; whole: AudioBuffer | null } = {
    intro: null,
    whole: null,
  };
  let intro: Playing | null = null;
  let whole: Playing | null = null;
  let wanted = false;
  let stopAt: number | null = null;

  function play(buffer: AudioBuffer, loopEnd: number, from: number, offset: number): Playing {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopEnd = loopEnd;
    source.connect(level);
    source.start(from, offset);
    return { source, from, origin: from - offset };
  }

  function begin(at: number) {
    if (buffers.whole !== null) {
      whole = play(buffers.whole, loopSeconds(recording), at, 0);
    } else if (buffers.intro !== null) {
      intro = play(buffers.intro, introSeconds, at, 0);
    }
  }

  // On the next bar, where the whole plays the very note the intro would.
  function takeOver(from: Playing, buffer: AudioBuffer) {
    const bars = Math.ceil((context.currentTime + TAKE_OVER_LEAD_SECONDS - from.origin) / bar);
    const at = from.origin + bars * bar;
    from.source.stop(at);
    whole = play(buffer, loopSeconds(recording), at, (bars * bar) % introSeconds);
  }

  function silence() {
    for (const playing of [intro, whole]) {
      playing?.source.stop();
      playing?.source.disconnect();
    }
    intro = null;
    whole = null;
    stopAt = null;
  }

  return {
    enter(at) {
      wanted = true;
      stopAt = null;
      fader.to(1);
      if (intro === null && whole === null) {
        begin(Math.max(at, context.currentTime));
      }
    },
    leave() {
      wanted = false;
      if (intro === null && whole === null) {
        return;
      }
      stopAt = fader.to(0);
    },
    take(buffer, part) {
      buffers[part] = buffer;
      if (!wanted) {
        return;
      }
      if (intro === null && whole === null) {
        begin(context.currentTime);
      } else if (part === 'whole' && intro !== null && whole === null) {
        takeOver(intro, buffer);
      }
    },
    pump() {
      if (intro === null && whole === null) {
        return false;
      }
      if (stopAt !== null && context.currentTime >= stopAt) {
        silence();
        return false;
      }
      return true;
    },
    position(now) {
      if (whole !== null && now >= whole.from) {
        return (now - whole.origin) / beat;
      }
      if (intro !== null && now >= intro.from) {
        return ((now - intro.origin) % introSeconds) / beat;
      }
      return null;
    },
  };
}
