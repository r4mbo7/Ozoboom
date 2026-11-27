import type { MusicTrack, SetDefinition } from '../data/types';
import { clamp, wrap } from '../shared/scalar';
import type { Tempo } from '../shared/tempo';
import type { SetSegment } from '../sim/state';
import {
  LOOKAHEAD_SECONDS,
  TICK_SECONDS,
  barSeconds,
  beatSeconds,
  tickToTime,
  type Anchor,
  type Follow,
} from './clock';
import { loopSeconds, loopableBar, type FileSpot, type HeldBar } from './held-bar';
import { LOUDEST_PEAK, MUSIC_BUS_GAIN } from './master';
import { decodeSlot, type FetchFile } from './menu-track';
import { EXTINCTION_SECONDS } from './music-hits';
import { PULSE_GAIN, barsIntoTier, segmentMusicStart, type SetMoment } from './music-score';
import { CUT_SECONDS, type HeartbeatLoop } from './music-step';
import { heartbeatSlotId, momentSlotIds, musicSlotOf, stemSlotId } from './slot-ids';
import type { LoopFile } from './sound-file';
import {
  SPEAKER_LAYER_IDS,
  stemCutoff,
  stemPresenceAt,
  type Presence,
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
  readonly silent?: readonly string[] | undefined;
  // The loudness of the synth's heartbeat, which a track's heartbeat loop is brought to.
  readonly heartbeatLufs?: number | undefined;
}

// What the deck follows of an update of the music while the game plays.
export interface DeckCue {
  readonly set: SetMoment;
  // The moment the set enters next, when its tick is known ahead.
  readonly ahead: SetMoment | null;
  readonly tick: number;
  readonly followed: Follow;
  readonly tempo: Tempo;
  readonly stage: SetDefinition;
  readonly currentTime: number;
  // The speakers the sequencer hears: the beat each plugged one entered on, the charge of each one
  // being plugged.
  readonly entries: ReadonlyMap<SpeakerLayerId, number>;
  readonly plugging: ReadonlyMap<SpeakerLayerId, number>;
  // The first tick the sequencer has not scheduled yet: a stem never starts over its steps.
  readonly cursor: number;
  // The bar an upgrade choice loops while it holds the tick; the game resumes on a resync, or on the
  // beat line of the loop the hold resumes on.
  readonly hold: HeldBar | null;
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
  // The track's heartbeat loop once decoded, 'silent' once its artist silenced it, else null: the
  // shared heartbeat beats.
  heartbeat(): HeartbeatLoop | 'silent' | null;
  // The stem of the speaker plays on the sequencer's step at `tick`, heard at `at`, in place of its
  // synth layer.
  stemAt(speaker: SpeakerLayerId, tick: number, at: number): boolean;
  // Fades the loop out over `seconds`; the next follow starts it again where the tick is.
  retire(at: number, seconds: number): void;
  // A loss: the loop fades out under the power down, as the danger filters close it.
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

// The files of one moment, through their own fade.
interface Voice {
  readonly moment: SetMoment;
  readonly layout: Layout;
  readonly fade: GainNode;
  readonly sources: Scheduled[];
  readonly stems: Map<SpeakerLayerId, Stem>;
  readonly start: number;
  readonly riseSeconds: number;
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

const spot = ({ buffer, seconds }: Part, from: number): FileSpot => ({ buffer, from, seconds });

// Where a drop and its loop sit in their tier, in seconds from its buildup's start.
interface DropGrid {
  readonly start: number;
  // Where its loop starts, after its opening, and how long it lasts.
  readonly from: number;
  readonly seconds: number;
}

function tierGrid(
  moment: SetMoment,
  { opening, loop }: Layout,
  stage: SetDefinition,
  bar: number,
): { readonly since: number; readonly drop: DropGrid | null } {
  const since = barsIntoTier(moment, stage) * bar;
  return {
    since,
    drop:
      moment.segment === 'drop'
        ? { start: since, from: since + (opening?.seconds ?? 0), seconds: loop.seconds }
        : null,
  };
}

// Where a stem of `seconds` plays `into` seconds into its tier, and where its source loops back to.
// It runs through its file from its tier's buildup, a file shorter than the moments before the drop
// looping whole. In a drop, past its end, it loops its last part, as long as the drop's loop: on from
// its end when the file runs into the drop, on that loop's grid when it ends before the drop.
function stemLoop(
  into: number,
  seconds: number,
  drop: DropGrid | null,
): { readonly offset: number; readonly loopStart: number } {
  if (drop === null) {
    return { offset: wrap(into, seconds), loopStart: 0 };
  }
  const last = Math.min(drop.seconds, seconds);
  const loopStart = seconds - last;
  if (into < seconds) {
    return { offset: into, loopStart };
  }
  const from = seconds > drop.start ? seconds : drop.from;
  return { offset: loopStart + wrap(into - from, last), loopStart };
}

const sameMoment = (moment: SetMoment, other: SetMoment | null): boolean =>
  other !== null &&
  moment.tier === other.tier &&
  moment.segment === other.segment &&
  moment.segmentStartTick === other.segmentStartTick;

// A later stop of a source that has not stopped yet replaces the one before.
const stopAt = (source: Scheduled, at: number) => {
  source.node.stop(Math.min(at, source.end ?? Infinity));
};

function trackFiles(
  files: Readonly<Record<string, LoopFile>>,
  trackId: string,
): [slotId: string, file: LoopFile][] {
  return Object.entries(files).filter(([slotId]) => musicSlotOf(slotId)?.trackId === trackId);
}

// The files of a track that share its gain: all but its heartbeat loop, levelled as a hit is.
export function levelledFiles(
  files: Readonly<Record<string, LoopFile>>,
  trackId: string,
): LoopFile[] {
  return trackFiles(files, trackId)
    .filter(([slotId]) => musicSlotOf(slotId)?.part !== 'heartbeat')
    .map(([, file]) => file);
}

export function heartbeatGain({ lufs, peak }: LoopFile, heartbeatLufs: number): number {
  return Math.min(
    PULSE_GAIN * 10 ** ((heartbeatLufs - lufs) / 20),
    LOUDEST_PEAK / (peak * MUSIC_BUS_GAIN),
  );
}

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

export function createLoopDeck(
  out: AudioNode,
  { files, fetchFile, silent = [], heartbeatLufs }: LoopFiles,
): LoopDeck {
  const context = out.context;
  const level = context.createGain();
  level.connect(out);
  const heartbeatGains = new Map(
    Object.entries(files).flatMap(([slotId, file]) => {
      if (musicSlotOf(slotId)?.part !== 'heartbeat') {
        return [];
      }
      if (heartbeatLufs === undefined) {
        throw new Error(`No reference level for the heartbeat loop ${slotId}`);
      }
      return [[slotId, heartbeatGain(file, heartbeatLufs)] as const];
    }),
  );
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
  // The bar an upgrade choice loops, from the end of that bar.
  let held: Voice | null = null;

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
    voice: Pick<Voice, 'fade' | 'sources'>,
    part: Part,
    at: number,
    offset: number,
    once: boolean,
  ) {
    const node = context.createBufferSource();
    node.buffer = part.buffer;
    node.connect(voice.fade);
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
    riseSeconds = position > SAME_TIME ? RISE_SECONDS : 0,
  ): Voice {
    const fade = context.createGain();
    if (riseSeconds > 0) {
      fade.gain.setValueAtTime(0, at);
      fade.gain.linearRampToValueAtTime(1, at + riseSeconds);
    } else {
      fade.gain.setValueAtTime(1, at);
    }
    fade.connect(level);
    const chain = { fade, sources: [] };
    const { opening, loop } = layout;
    const source =
      opening !== null && position < opening.seconds
        ? play(chain, opening, at, position, true)
        : play(chain, loop, at, wrap(position - (opening?.seconds ?? 0), loop.seconds), false);
    return {
      ...chain,
      moment: { ...of },
      layout,
      stems: new Map(),
      start: at,
      riseSeconds,
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
  // plugged on its entry beat, never before its voice: where its tier has it, at its loop's rate.
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
    const position = voice.position + (at - voice.time) * voice.rate;
    const { since, drop } = tierGrid(voice.moment, voice.layout, cue.stage, bar);
    const { offset, loopStart } = stemLoop(since + position, part.seconds, drop);
    const joined = entry !== null && fromTick >= entry ? entry : null;
    return addStem(voice, speaker, part, presence, {
      at,
      offset,
      loopStart,
      fromTick,
      entry: joined,
    });
  }

  // A stem starts at `at`, `offset` seconds into its part, heard from `fromTick`.
  function addStem(
    voice: Voice,
    speaker: SpeakerLayerId,
    part: Part,
    presence: Presence,
    {
      at,
      offset,
      loopStart,
      fromTick,
      entry,
    }: Pick<Stem, 'at' | 'fromTick' | 'entry'> & { offset: number; loopStart: number },
  ): Stem {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(presence.level, at + RISE_SECONDS);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = stemCutoff(presence.open);
    gain.connect(filter);
    filter.connect(voice.fade);
    const node = context.createBufferSource();
    node.buffer = part.buffer;
    node.loop = true;
    node.loopStart = loopStart;
    node.loopEnd = part.seconds;
    node.playbackRate.value = voice.rate;
    node.connect(gain);
    node.start(at, offset);
    const stem: Stem = { node, at, gain, filter, fromTick, ...presence, entry };
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
    cut(held, at, seconds);
    playing = null;
    next = null;
    held = null;
    boundary = null;
  }

  // A level given back at once, or by its rise on a start still ahead.
  function rise(
    param: AudioParam,
    to: number,
    start: number,
    currentTime: number,
    seconds: number,
  ) {
    param.cancelScheduledValues(currentTime);
    if (start > currentTime && seconds > 0) {
      param.setValueAtTime(0, start);
      param.linearRampToValueAtTime(to, start + seconds);
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
    rise(playing.fade.gain, 1, playing.start, currentTime, playing.riseSeconds);
    for (const source of playing.sources) {
      stopAt(source, currentTime + NEVER_SECONDS);
    }
    if (playing.hushAt !== null) {
      for (const stem of playing.stems.values()) {
        rise(stem.gain.gain, stem.level, stem.at, currentTime, RISE_SECONDS);
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
  function prepare(ahead: SetMoment, origin: number, currentTime: number, tempo: Tempo) {
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
      next = voiceOf(ahead, layout, origin, 0);
    }
  }

  // The `seconds` of the moment's file from `position`, looped on their own.
  function heldFile({ opening, loop }: Layout, position: number, seconds: number): AudioBuffer {
    if (opening !== null && position < opening.seconds) {
      const after =
        position + seconds < opening.seconds - SAME_TIME
          ? spot(opening, position + seconds)
          : spot(loop, 0);
      return loopableBar(context, spot(opening, position), after, seconds, null);
    }
    const from = wrap(position - (opening?.seconds ?? 0), loop.seconds);
    return loopableBar(context, spot(loop, from), spot(loop, from + seconds), seconds, null);
  }

  // A heard speaker's stem loops the same beats, `into` seconds into its tier, at its level at the
  // bar's end; on a break's last bar, it falls silent on its last beat, as `hush` silences it.
  function holdStem(
    voice: Voice,
    speaker: SpeakerLayerId,
    cue: DeckCue,
    hold: HeldBar,
    { into, drop }: { readonly into: number; readonly drop: DropGrid | null },
    bar: number,
  ) {
    const { entries, plugging, set } = cue;
    const part = trackId === null ? null : partOf(stemSlotId(trackId, speaker), bar);
    if (part === null || !(entries.has(speaker) || plugging.has(speaker))) {
      return;
    }
    const seconds = loopSeconds(hold);
    const from = stemLoop(into, part.seconds, drop).offset;
    const silentFrom = hold.cutTick === null ? null : (hold.cutTick - hold.fromTick) * TICK_SECONDS;
    const after =
      silentFrom === null ? spot(part, stemLoop(into + seconds, part.seconds, drop).offset) : null;
    const buffer = loopableBar(context, spot(part, from), after, seconds, silentFrom);
    const presence = stemPresenceAt(
      hold.untilTick - 1,
      entries.get(speaker) ?? null,
      plugging.get(speaker) ?? 0,
      set.segment === 'break',
    );
    addStem(voice, speaker, { buffer, seconds }, presence, {
      at: voice.start,
      offset: wrap(voice.position, seconds),
      loopStart: 0,
      fromTick: hold.fromTick,
      entry: null,
    });
  }

  // An upgrade choice holds the tick: the moment plays on to the end of its bar, then that bar of its
  // file and of its heard stems loops until the game resumes. A loop decoded since the choice began
  // takes over on a pass far enough ahead to be scheduled in time.
  function holdBar(cue: DeckCue, hold: HeldBar, clock: Anchor, bar: number): Voice | null {
    const { set, currentTime } = cue;
    const layout = layoutOf(set, bar);
    if (layout === null) {
      return null;
    }
    const seconds = loopSeconds(hold);
    const end = tickToTime(clock, hold.untilTick);
    const into = playing === null ? 0 : Math.max(0, currentTime - end);
    const passes =
      playing === null
        ? Math.max(0, Math.ceil((currentTime + TAKE_OVER_LEAD_SECONDS - end) / seconds))
        : 0;
    const at = end + passes * seconds + into;
    cut(next, currentTime, CUT_SECONDS);
    next = null;
    boundary = null;
    if (playing !== null && hold.cutTick !== null && playing.hushAt === null) {
      hush(playing, Math.max(currentTime, tickToTime(clock, hold.cutTick)));
    }
    cut(playing, at, RISE_SECONDS);
    // Where the held bar sits in its file, from the music start the hold opened on: a file decoded
    // after the pick finds the beats it replays added to the segment already.
    const replayedSince = cue.tempo.originTick - hold.tempo.originTick;
    const start = segmentMusicStart(set) - replayedSince;
    const position = Math.max(0, (hold.fromTick - start) * TICK_SECONDS);
    const file = { buffer: heldFile(layout, position, seconds), seconds };
    // Beats cut from inside their file: they rise, even from their first sample.
    const voice = voiceOf(set, { opening: null, loop: file }, at, into, RISE_SECONDS);
    const { since, drop } = tierGrid(set, layout, cue.stage, bar);
    for (const speaker of SPEAKER_LAYER_IDS) {
      holdStem(voice, speaker, cue, hold, { into: since + position, drop }, bar);
    }
    return voice;
  }

  // The game resumes on a beat line of the held loop: the loop stops there, and the moment goes on
  // from where its music is then, the held bar's beat the game plays again, or the moment that starts
  // on it.
  function playResumedHold(cue: DeckCue, hold: HeldBar, clock: Anchor, bar: number) {
    const { set, ahead } = cue;
    const at = tickToTime(clock, hold.untilTick);
    cut(held, at, RISE_SECONDS);
    playing = null;
    if (ahead?.segmentStartTick === hold.untilTick) {
      return;
    }
    const layout = layoutOf(set, bar);
    const origin = tickToTime(clock, segmentMusicStart(set));
    playing = layout === null ? null : voiceOf(set, layout, at, at - origin);
  }

  return {
    load(track) {
      const mine = trackFiles(files, track.id);
      const fresh = track.id !== trackId;
      if (fresh) {
        cutAll(context.currentTime, CUT_SECONDS);
        trackId = track.id;
        decoded = new Map();
        failed = new Set();
        loading = NO_LOOPS;
        const levelled = mine
          .filter(([slotId]) => musicSlotOf(slotId)?.part !== 'heartbeat')
          .map(([, file]) => file);
        if (levelled.length > 0) {
          level.gain.value = loopGain(levelled);
        }
      }
      const into = decoded;
      const lost = failed;
      // The entry plays before the set, from the bank that decoded it at the opening.
      const played = mine.filter(([slotId]) => musicSlotOf(slotId)?.part !== 'entry');
      const due = fresh ? played : played.filter(([slotId]) => lost.has(slotId));
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
      const { set, ahead, tick, followed, tempo, currentTime, hold } = cue;
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
        // A loop already cut on the line the game resumes on plays until there.
        cut(held, followed.resynced ? currentTime : (held?.cutAt ?? currentTime), CUT_SECONDS);
        held = null;
      } else if (ahead === null && boundary !== null && currentTime < boundary) {
        withdraw(currentTime);
      }
      const origin = tickToTime(clock, segmentMusicStart(set));
      if (playing === null && (hold === null || entered)) {
        const layout = layoutOf(set, bar);
        // On the tick a moment starts or the clock moved, else on the next bar of the moment.
        const at = entered
          ? Math.max(currentTime, tickToTime(clock, tick))
          : origin +
            Math.max(0, Math.ceil((currentTime + TAKE_OVER_LEAD_SECONDS - origin) / bar)) * bar;
        playing = layout === null ? null : voiceOf(set, layout, at, at - origin);
      } else if (playing !== null) {
        nudge(playing, origin, currentTime);
      }
      for (const voice of [playing, next]) {
        if (voice !== null) {
          handOff(voice, currentTime);
        }
      }
      if (hold !== null && held === null) {
        held = holdBar(cue, hold, clock, bar);
      }
      if (typeof hold?.resumesAt === 'number' && held?.cutAt === null) {
        playResumedHold(cue, hold, clock, bar);
      } else if (hold === null && held !== null && held.cutAt !== null) {
        held = null;
      }
      if (ahead !== null && next === null) {
        prepare(ahead, tickToTime(clock, ahead.segmentStartTick), currentTime, tempo);
      }
      for (const voice of [playing, next]) {
        if (voice !== null) {
          followStems(voice, cue, clock, bar);
        }
      }
    },
    heartbeat() {
      if (trackId === null) {
        return null;
      }
      const slotId = heartbeatSlotId(trackId);
      if (silent.includes(slotId)) {
        return 'silent';
      }
      const buffer = decoded.get(slotId);
      const gain = heartbeatGains.get(slotId);
      return buffer === undefined || gain === undefined ? null : { buffer, gain };
    },
    stemAt(speaker, tick, at) {
      return [playing, next, held].some((voice) => {
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
      cutAll(at, EXTINCTION_SECONDS);
    },
    // Its voices are kept, cut at `at`: a resync before then stops them at once.
    stop(at) {
      for (const voice of [playing, next, held]) {
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
