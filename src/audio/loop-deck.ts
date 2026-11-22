import type { MusicTrack } from '../data/types';
import { clamp, wrap } from '../shared/scalar';
import type { Tempo } from '../shared/tempo';
import type { SetSegment } from '../sim/state';
import {
  LOOKAHEAD_SECONDS,
  barSeconds,
  beatSeconds,
  tickToTime,
  type Anchor,
  type Follow,
} from './clock';
import { LOUDEST_PEAK, MUSIC_BUS_GAIN } from './master';
import { decodeSlot, type FetchFile } from './menu-track';
import { EXTINCTION_SECONDS, extinguish } from './music-hits';
import { CHOKE_SMOOTHING, type SetMoment } from './music-score';
import { CUT_SECONDS } from './music-step';
import { momentSlotIds, musicSlotOf, stemSlotId } from './slot-ids';
import type { LoopFile } from './sound-file';
import {
  SPEAKER_LAYER_IDS,
  stemCutoff,
  stemPresenceAt,
  type SpeakerLayerId,
} from './speaker-layers';

// Written from « Niveau de la musique » on dev/audio.html (`measureStageLevel`) on 2026-11-20: the
// integrated loudness, as `pnpm sounds` measures a loop, of the sequencer where it joins the music
// bus, over the first 16 bars of a buildup of the Soirée d'ouverture at its first tier, no speaker
// plugged (its drop reads -10.0). A track's loudest loop is brought to it.
export const STAGE_MUSIC_LUFS = -10.2;

// The artists' loops of the stage tracks, by slot (`FULL_SOUNDS.music`), and how they are fetched.
export interface LoopFiles {
  readonly files: Readonly<Record<string, LoopFile>>;
  readonly fetchFile?: FetchFile;
}

// What the deck follows of an update of the music while the game plays.
export interface DeckCue {
  readonly set: SetMoment;
  // The moment the set enters next, when its tick is known ahead.
  readonly ahead: SetMoment | null;
  readonly tick: number;
  readonly followed: Follow;
  readonly cutoff: number;
  readonly tempo: Tempo;
  readonly currentTime: number;
  // The speakers the sequencer hears: the beat each plugged one entered on, the charge of each one
  // being plugged.
  readonly entries: ReadonlyMap<SpeakerLayerId, number>;
  readonly plugging: ReadonlyMap<SpeakerLayerId, number>;
  // The first tick the sequencer has not scheduled yet: a stem never starts over its steps.
  readonly cursor: number;
}

// The loops of the playing track, and their openings, placed by the tick (ADR 0022).
export interface LoopDeck {
  // Starts decoding the loops and openings of a track, and gives up those of the one before; for the
  // track it holds, tries again only the files that failed.
  load(track: MusicTrack): void;
  // Settles once the files of the track loaded last have decoded or failed.
  loaded(): Promise<void>;
  // The moment has a loop, decoded or on its way: the sequencer's musical layers leave it the room.
  holds(tier: number, segment: SetSegment): boolean;
  follow(cue: DeckCue): void;
  // The stem of the speaker plays on the sequencer's step at `tick`, heard at `at`, in place of its
  // synth layer.
  stemAt(speaker: SpeakerLayerId, tick: number, at: number): boolean;
  // Fades the loop out over `seconds`; the next follow starts it again where the tick is.
  retire(at: number, seconds: number): void;
  // A loss: the loop closes down as the sequencer does, under the power down.
  extinguish(at: number): void;
  // The music faded out over it: the loop stops at `at`, where the fade ends.
  stop(at: number): void;
}

// A decoded file of a moment, and how long it lasts in bars at the stage's tempo.
interface Part {
  readonly buffer: AudioBuffer;
  readonly seconds: number;
}

// What a moment plays: its opening once, then its loop.
interface Layout {
  readonly opening: Part | null;
  readonly loop: Part;
}

interface Scheduled {
  readonly node: AudioBufferSourceNode;
  readonly at: number;
  // Where it stops of its own: an opening, on the sample its loop takes over on.
  end?: number;
}

// A speaker's stem in a voice, through its own gain and low-pass, from the tick it joined on.
interface Stem extends Scheduled {
  readonly gain: GainNode;
  readonly filter: BiquadFilterNode;
  readonly fromTick: number;
  level: number;
  open: number;
  // The entry beat whose level is scheduled.
  entry: number | null;
}

// The files of one moment, through their own low-pass and fade.
interface Voice {
  readonly moment: SetMoment;
  readonly layout: Layout;
  readonly filter: BiquadFilterNode;
  readonly fade: GainNode;
  readonly sources: Scheduled[];
  readonly stems: Map<SpeakerLayerId, Stem>;
  readonly start: number;
  cutoff: number;
  // The source heard, where it plays at `time` in seconds since its moment started, unwrapped, and
  // at what rate since.
  source: AudioBufferSourceNode;
  time: number;
  position: number;
  rate: number;
  // The loop scheduled to take over at the opening's last sample.
  handoff: Scheduled | null;
  cutAt: number | null;
  // Where its stems fall silent: the last beat of a break before its drop, as the synth layers do.
  hushAt: number | null;
}

// A loop decoded late takes over on a bar at least this far ahead, to be scheduled in time.
const TAKE_OVER_LEAD_SECONDS = 0.1;
// The rate leans toward the clock to close a gap in this many seconds, by a fraction of a percent.
const CATCH_UP_SECONDS = 2;
const MAX_NUDGE = 0.003;
const RISE_SECONDS = 0.003;
const STEM_SMOOTHING = 0.05;
// The sequencer's step and a voice's start or cut are computed from the same clock.
const SAME_TIME = 1e-6;
// A voice given back its life plays on until a cut stops it.
const NEVER_SECONDS = 1e9;
const NO_LOOPS: Promise<void> = Promise.resolve();

const sameMoment = (moment: SetMoment, other: SetMoment | null): boolean =>
  other !== null &&
  moment.tier === other.tier &&
  moment.segment === other.segment &&
  moment.segmentStartTick === other.segmentStartTick;

// A later stop of a source that has not stopped yet replaces the one before.
const stopAt = (source: Scheduled, at: number) => {
  source.node.stop(Math.min(at, source.end ?? Infinity));
};

// One gain for every file of a track, which keeps the artist's balance between them: its loudest
// loop at the level of the synthesized stage music, its loudest sample under the limiter.
export function loopGain(files: readonly LoopFile[]): number {
  const loudest = Math.max(...files.map(({ lufs }) => lufs));
  const peak = Math.max(...files.map((file) => file.peak));
  return Math.min(
    10 ** ((STAGE_MUSIC_LUFS - loudest) / 20),
    LOUDEST_PEAK / (peak * MUSIC_BUS_GAIN),
  );
}

export function createLoopDeck(out: AudioNode, { files, fetchFile }: LoopFiles): LoopDeck {
  const context = out.context;
  const level = context.createGain();
  level.connect(out);
  let trackId: string | null = null;
  let decoded = new Map<string, AudioBuffer>();
  let failed = new Set<string>();
  let loading = NO_LOOPS;
  let moment: SetMoment | null = null;
  let playing: Voice | null = null;
  // The voice of the moment ahead, scheduled to start on its tick.
  let next: Voice | null = null;
  // Where the moment ahead starts and `playing` is cut, while it is still ahead.
  let boundary: number | null = null;

  const live = (slotId: string | undefined): slotId is string =>
    slotId !== undefined && files[slotId] !== undefined && !failed.has(slotId);

  // The tier's loop, else the track's, unless its file failed, with the opening of its own slot.
  function slotsOf({
    tier,
    segment,
  }: Pick<SetMoment, 'tier' | 'segment'>): { loop: string; opening: string | null } | null {
    if (trackId === null) {
      return null;
    }
    const loops = momentSlotIds('loop', trackId, tier, segment);
    const level = loops.findIndex(live);
    const loop = loops[level];
    const opening = momentSlotIds('opening', trackId, tier, segment)[level];
    return live(loop) ? { loop, opening: live(opening) ? opening : null } : null;
  }

  function partOf(slotId: string | null, bar: number): Part | null {
    const buffer = slotId === null ? undefined : decoded.get(slotId);
    const file = slotId === null ? undefined : files[slotId];
    return buffer === undefined || file === undefined ? null : { buffer, seconds: file.bars * bar };
  }

  // Ready once its loop and its opening, when it has one, are decoded: its timeline never changes.
  function layoutOf(of: SetMoment, bar: number): Layout | null {
    const slots = slotsOf(of);
    if (slots === null) {
      return null;
    }
    const loop = partOf(slots.loop, bar);
    const opening = partOf(slots.opening, bar);
    return loop === null || (slots.opening !== null && opening === null) ? null : { opening, loop };
  }

  // An opening plays its bars once, never the padding its codec adds; a loop loops on its bars.
  function play(
    voice: Pick<Voice, 'filter' | 'sources'>,
    part: Part,
    at: number,
    offset: number,
    once: boolean,
  ) {
    const node = context.createBufferSource();
    node.buffer = part.buffer;
    node.connect(voice.filter);
    if (once) {
      node.start(at, offset, part.seconds - offset);
    } else {
      node.loop = true;
      node.loopEnd = part.seconds;
      node.start(at, offset);
    }
    voice.sources.push({ node, at });
    return node;
  }

  // Inside the opening while it lasts, then on the loop's bars from the opening's end.
  function voiceOf(
    of: SetMoment,
    layout: Layout,
    at: number,
    position: number,
    cutoff: number,
  ): Voice {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const fade = context.createGain();
    fade.gain.setValueAtTime(0, at);
    fade.gain.linearRampToValueAtTime(1, at + RISE_SECONDS);
    filter.connect(fade);
    fade.connect(level);
    const chain = { filter, sources: [] };
    const { opening, loop } = layout;
    const source =
      opening !== null && position < opening.seconds
        ? play(chain, opening, at, position, true)
        : play(chain, loop, at, wrap(position - (opening?.seconds ?? 0), loop.seconds), false);
    return {
      ...chain,
      moment: { ...of },
      layout,
      fade,
      stems: new Map(),
      start: at,
      cutoff,
      source,
      time: at,
      position,
      rate: 1,
      handoff: null,
      cutAt: null,
      hushAt: null,
    };
  }

  // Once the opening's end is within reach, its loop is scheduled on its last sample.
  function handOff(voice: Voice, currentTime: number) {
    const { opening, loop } = voice.layout;
    if (
      opening === null ||
      voice.handoff !== null ||
      voice.cutAt !== null ||
      voice.position >= opening.seconds
    ) {
      return;
    }
    const at = voice.time + (opening.seconds - voice.position) / voice.rate;
    if (at - currentTime > LOOKAHEAD_SECONDS) {
      return;
    }
    const from = Math.max(at, currentTime);
    voice.handoff = { node: play(voice, loop, from, from - at, false), at };
    // Its own length already ends it there: this stop does not hang on how a browser reads it.
    const opened = voice.sources.find(({ node }) => node === voice.source);
    if (opened !== undefined) {
      opened.end = at;
      stopAt(opened, at);
    }
  }

  // Leans its rate toward where the clock has it, as the sequencer slews its anchor; held while
  // the opening runs out to the sample its loop is scheduled on.
  function nudge(voice: Voice, origin: number, currentTime: number) {
    const { handoff } = voice;
    if (handoff !== null) {
      if (currentTime < handoff.at) {
        return;
      }
      voice.source = handoff.node;
      voice.time = handoff.at;
      voice.position = voice.layout.opening?.seconds ?? 0;
      voice.rate = 1;
      voice.handoff = null;
    }
    if (currentTime <= voice.time) {
      return;
    }
    const position = voice.position + (currentTime - voice.time) * voice.rate;
    const gap = currentTime - origin - position;
    voice.time = currentTime;
    voice.position = position;
    voice.rate = 1 + clamp(gap / CATCH_UP_SECONDS, -MAX_NUDGE, MAX_NUDGE);
    voice.source.playbackRate.value = voice.rate;
    for (const { node } of voice.stems.values()) {
      node.playbackRate.value = voice.rate;
    }
  }

  // A heard speaker's stem joins on the step the sequencer has not scheduled yet, a speaker just
  // plugged on its entry beat, never before its voice: on the grid of its loop, at its rate.
  function join(
    voice: Voice,
    speaker: SpeakerLayerId,
    cue: DeckCue,
    clock: Anchor,
    bar: number,
  ): Stem | undefined {
    const part = trackId === null ? null : partOf(stemSlotId(trackId, speaker), bar);
    if (part === null || voice.cutAt !== null) {
      return undefined;
    }
    const entry = cue.entries.get(speaker) ?? null;
    const fromTick = Math.max(cue.cursor, entry ?? cue.cursor);
    const at = Math.max(voice.start, cue.currentTime, tickToTime(clock, fromTick));
    const presence = stemPresenceAt(
      fromTick,
      entry,
      cue.plugging.get(speaker) ?? 0,
      voice.moment.segment === 'break',
    );
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(presence.level, at + RISE_SECONDS);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = stemCutoff(presence.open);
    gain.connect(filter);
    filter.connect(voice.filter);
    const node = context.createBufferSource();
    node.buffer = part.buffer;
    node.loop = true;
    node.loopEnd = part.seconds;
    node.playbackRate.value = voice.rate;
    node.connect(gain);
    const position = voice.position + (at - voice.time) * voice.rate;
    node.start(at, wrap(position - (voice.layout.opening?.seconds ?? 0), part.seconds));
    const stem: Stem = {
      node,
      at,
      gain,
      filter,
      fromTick,
      ...presence,
      entry: entry !== null && fromTick >= entry ? entry : null,
    };
    voice.sources.push(stem);
    voice.stems.set(speaker, stem);
    return stem;
  }

  // A speaker no longer heard takes its stem away at `at`; one not started by then never sounds.
  function drop(voice: Voice, speaker: SpeakerLayerId, stem: Stem, at: number) {
    voice.stems.delete(speaker);
    voice.sources.splice(voice.sources.indexOf(stem), 1);
    stem.gain.gain.cancelScheduledValues(at);
    stem.gain.gain.setTargetAtTime(0, at, CUT_SECONDS / 4);
    stem.node.stop(stem.at > at ? at : at + 2 * CUT_SECONDS);
  }

  // Each heard speaker's stem comes forward while it charges and takes its level on its entry beat,
  // where the sequencer's next step would change its synth layer.
  function followStems(voice: Voice, cue: DeckCue, clock: Anchor, bar: number) {
    const { entries, plugging, cursor, currentTime } = cue;
    const inBreak = voice.moment.segment === 'break';
    const scheduled = Math.max(currentTime, tickToTime(clock, cursor));
    for (const speaker of SPEAKER_LAYER_IDS) {
      const heard = entries.has(speaker) || plugging.has(speaker);
      const stem = voice.stems.get(speaker);
      if (!heard) {
        if (stem !== undefined) {
          drop(voice, speaker, stem, scheduled);
        }
        continue;
      }
      const joined = stem ?? join(voice, speaker, cue, clock, bar);
      if (joined === undefined) {
        continue;
      }
      const entry = entries.get(speaker) ?? null;
      const charge = plugging.get(speaker) ?? 0;
      const now = stemPresenceAt(Math.max(cursor, joined.fromTick), entry, charge, inBreak);
      const from = Math.max(scheduled, joined.at + RISE_SECONDS);
      if (voice.hushAt !== null && from >= voice.hushAt) {
        continue;
      }
      if (now.level !== joined.level || now.open !== joined.open) {
        joined.gain.gain.setTargetAtTime(now.level, from, STEM_SMOOTHING);
        joined.filter.frequency.setTargetAtTime(stemCutoff(now.open), from, STEM_SMOOTHING);
        joined.level = now.level;
        joined.open = now.open;
      }
      const entryAt = entry === null ? Infinity : Math.max(from, tickToTime(clock, entry));
      if (
        entry !== null &&
        entry > cursor &&
        joined.entry !== entry &&
        (voice.hushAt === null || entryAt < voice.hushAt)
      ) {
        const entered = stemPresenceAt(entry, entry, 0, inBreak);
        const at = entryAt;
        joined.gain.gain.setValueAtTime(entered.level, at);
        joined.filter.frequency.setValueAtTime(stemCutoff(entered.open), at);
        joined.entry = entry;
      }
    }
  }

  // A source not started yet never sounds: its rise would override a fade.
  function cut(voice: Voice | null, at: number, seconds: number) {
    if (voice === null || (voice.cutAt !== null && voice.cutAt <= at)) {
      return;
    }
    voice.cutAt = at;
    voice.fade.gain.cancelScheduledValues(at);
    voice.fade.gain.setTargetAtTime(0, at, seconds / 4);
    for (const source of voice.sources) {
      stopAt(source, source.at > at - SAME_TIME ? at : at + 2 * seconds);
    }
  }

  function cutAll(at: number, seconds: number) {
    cut(playing, at, seconds);
    cut(next, at, seconds);
    playing = null;
    next = null;
    boundary = null;
  }

  // A level given back at once, or by its rise on a start still ahead.
  function rise(param: AudioParam, to: number, start: number, currentTime: number) {
    param.cancelScheduledValues(currentTime);
    if (start > currentTime) {
      param.setValueAtTime(0, start);
      param.linearRampToValueAtTime(to, start + RISE_SECONDS);
    } else {
      param.setValueAtTime(to, currentTime);
    }
  }

  // A boundary no longer ahead, as when an upgrade choice holds the tick: the moment ahead never
  // sounds and the playing one plays on through it.
  function withdraw(currentTime: number) {
    cut(next, currentTime, CUT_SECONDS);
    next = null;
    boundary = null;
    if (playing === null) {
      return;
    }
    rise(playing.fade.gain, 1, playing.start, currentTime);
    for (const source of playing.sources) {
      stopAt(source, currentTime + NEVER_SECONDS);
    }
    if (playing.hushAt !== null) {
      for (const stem of playing.stems.values()) {
        rise(stem.gain.gain, stem.level, stem.at, currentTime);
        stem.entry = null;
      }
    }
    playing.cutAt = null;
    playing.hushAt = null;
  }

  // The last beat of a break is silent but for its loop: a stem, in every moment, cannot carry it.
  function hush(voice: Voice, at: number) {
    voice.hushAt = at;
    for (const { gain } of voice.stems.values()) {
      gain.gain.cancelScheduledValues(at);
      gain.gain.setTargetAtTime(0, at, CUT_SECONDS / 4);
    }
  }

  // The current loop stops on the tick the next moment starts, which starts there from its first bar.
  function prepare(
    ahead: SetMoment,
    origin: number,
    cutoff: number,
    currentTime: number,
    tempo: Tempo,
  ) {
    if (origin < currentTime || origin - currentTime > LOOKAHEAD_SECONDS) {
      return;
    }
    if (
      playing !== null &&
      playing.hushAt === null &&
      playing.moment.segment === 'break' &&
      ahead.segment === 'drop'
    ) {
      hush(playing, Math.max(currentTime, origin - beatSeconds(tempo)));
    }
    cut(playing, origin, RISE_SECONDS);
    boundary = origin;
    const bar = barSeconds(tempo);
    const layout = layoutOf(ahead, bar);
    if (layout !== null) {
      next = voiceOf(ahead, layout, origin, 0, cutoff);
    }
  }

  function followCutoff(voice: Voice, cutoff: number, currentTime: number) {
    if (cutoff !== voice.cutoff) {
      voice.filter.frequency.setTargetAtTime(cutoff, currentTime, CHOKE_SMOOTHING);
      voice.cutoff = cutoff;
    }
  }

  return {
    load(track) {
      const mine = Object.entries(files).filter(
        ([slotId]) => musicSlotOf(slotId)?.trackId === track.id,
      );
      const fresh = track.id !== trackId;
      if (fresh) {
        cutAll(context.currentTime, CUT_SECONDS);
        trackId = track.id;
        decoded = new Map();
        failed = new Set();
        loading = NO_LOOPS;
        if (mine.length > 0) {
          level.gain.value = loopGain(mine.map(([, file]) => file));
        }
      }
      const into = decoded;
      const lost = failed;
      const due = fresh ? mine : mine.filter(([slotId]) => lost.has(slotId));
      for (const [slotId] of due) {
        lost.delete(slotId);
      }
      const decoding = due.map(async ([slotId, file]) => {
        const buffer = await decodeSlot(context, file.files, fetchFile);
        if (buffer === null) {
          lost.add(slotId);
        } else {
          into.set(slotId, buffer);
        }
      });
      loading = Promise.all([loading, ...decoding]).then(() => undefined);
    },
    loaded() {
      return loading;
    },
    holds(tier, segment) {
      return slotsOf({ tier, segment }) !== null;
    },
    follow(cue) {
      const { set, ahead, tick, followed, cutoff, tempo, currentTime } = cue;
      const clock = followed.anchor;
      const bar = barSeconds(tempo);
      const entered = followed.resynced || !sameMoment(set, moment);
      moment = { tier: set.tier, segment: set.segment, segmentStartTick: set.segmentStartTick };
      if (entered) {
        const arrived =
          !followed.resynced && next !== null && sameMoment(set, next.moment) ? next : null;
        if (arrived === null) {
          cut(playing, currentTime, CUT_SECONDS);
          cut(next, currentTime, CUT_SECONDS);
        } else {
          // Cut where the moment arrives already, which this frame may come a little before.
          cut(playing, arrived.start, RISE_SECONDS);
        }
        playing = arrived;
        next = null;
        boundary = null;
      } else if (ahead === null && boundary !== null && currentTime < boundary) {
        withdraw(currentTime);
      }
      const origin = tickToTime(clock, set.segmentStartTick);
      if (playing === null) {
        const layout = layoutOf(set, bar);
        // On the tick a moment starts or the clock moved, else on the next bar of the moment.
        const at = entered
          ? Math.max(currentTime, tickToTime(clock, tick))
          : origin + Math.ceil((currentTime + TAKE_OVER_LEAD_SECONDS - origin) / bar) * bar;
        playing = layout === null ? null : voiceOf(set, layout, at, at - origin, cutoff);
      } else {
        nudge(playing, origin, currentTime);
      }
      for (const voice of [playing, next]) {
        if (voice !== null) {
          handOff(voice, currentTime);
          followCutoff(voice, cutoff, currentTime);
        }
      }
      if (ahead !== null && next === null) {
        prepare(ahead, tickToTime(clock, ahead.segmentStartTick), cutoff, currentTime, tempo);
      }
      for (const voice of [playing, next]) {
        if (voice !== null) {
          followStems(voice, cue, clock, bar);
        }
      }
    },
    stemAt(speaker, tick, at) {
      return [playing, next].some((voice) => {
        const stem = voice?.stems.get(speaker);
        return (
          voice !== null &&
          stem !== undefined &&
          tick >= stem.fromTick &&
          at >= voice.start - SAME_TIME &&
          (voice.cutAt === null || at < voice.cutAt - SAME_TIME)
        );
      });
    },
    retire(at, seconds) {
      cutAll(at, seconds);
    },
    extinguish(at) {
      for (const voice of [playing, next]) {
        if (voice !== null) {
          extinguish(voice.filter, at);
        }
      }
      cutAll(at, EXTINCTION_SECONDS);
    },
    // Its voices are kept, cut at `at`: a resync before then stops them at once.
    stop(at) {
      for (const voice of [playing, next]) {
        if (voice !== null && (voice.cutAt === null || voice.cutAt > at)) {
          voice.cutAt = at;
          for (const source of voice.sources) {
            stopAt(source, at);
          }
        }
      }
      boundary = null;
    },
  };
}
