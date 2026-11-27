import { wrap } from '../shared/scalar';
import { BEATS_PER_BAR, barOfTick, type Tempo } from '../shared/tempo';
import { REPLAY_BEATS, type ReplayBeats } from '../sim/commands';
import { TICK_SECONDS, beatSeconds, tickToTime, type Anchor } from './clock';
import { CUT_SECONDS } from './music-step';

// The bar an upgrade choice holds `tick` in, looped whole: from `fromTick` to the next bar's first
// tick, `untilTick`, on the grid and with the drop the choice opened on; the tick its break falls
// silent on when it is the last bar of a break. Its passes replay it from `passFrom`: past its end
// until the game resumes, then, once the resume is set on a beat line of the loop at `resumesAt`, on
// the clock moved back by `clockShift` ticks so that the game's next tick falls there, until its end.
export interface HeldBar {
  readonly tick: number;
  readonly tempo: Tempo;
  readonly dropTick: number | null;
  readonly fromTick: number;
  readonly untilTick: number;
  readonly cutTick: number | null;
  readonly passFrom: number;
  readonly clockShift: number;
  readonly resumesAt: number | null;
}

// The beat line a choice resumes on, and the beats of the held bar the game plays again from there.
export interface ResumeLine {
  readonly at: number;
  readonly beats: ReplayBeats;
}

const ON_LINE_TOLERANCE_SECONDS = 1e-6;
// The beats the game leaves at least between the last pick and the line it resumes on: a sixteenth.
const RESUME_LEAD_BEATS = 1 / 4;

// Where a decoded file is read, `from` seconds into its part that loops every `seconds`.
export interface FileSpot {
  readonly buffer: AudioBuffer;
  readonly from: number;
  readonly seconds: number;
}

// Long enough to take the click out of a wrap, too short to soften a hit.
const WRAP_SECONDS = 0.003;

// The seconds the game leaves at least between the last pick and the line it resumes on, on an
// output heard `latency` seconds after it is scheduled: a sixteenth, or the time to schedule the
// loop's cut ahead of the output.
function resumeLead(tempo: Tempo, latency: number): number {
  return Math.max(RESUME_LEAD_BEATS * beatSeconds(tempo), latency + 2 * CUT_SECONDS);
}

export function heldBarOf(tick: number, tempo: Tempo, dropTick: number | null): HeldBar {
  const untilTick = tempo.originTick + (barOfTick(tick, tempo) + 1) * tempo.ticksPerBar;
  return {
    tick,
    tempo,
    dropTick,
    fromTick: untilTick - tempo.ticksPerBar,
    untilTick,
    cutTick: dropTick === untilTick ? dropTick - tempo.ticksPerBeat : null,
    passFrom: untilTick,
    clockShift: 0,
    resumesAt: null,
  };
}

function loopTicks(hold: HeldBar): number {
  return hold.untilTick - hold.fromTick;
}

export function loopSeconds(hold: HeldBar): number {
  return loopTicks(hold) * TICK_SECONDS;
}

// The first beat line of the loop a sixteenth after `now` at least, or the output's latency, where
// the cut can still be scheduled; with `beats`, the first such line the game playing those beats
// again lands on, a bar later at most. Passes start at the end of the first, on the loop's beat 1.
export function resumeLine(
  hold: HeldBar,
  clock: Anchor,
  { now, currentTime }: { readonly now: number; readonly currentTime: number },
  beats?: ReplayBeats,
): ResumeLine {
  const { tempo } = hold;
  const end = tickToTime(clock, hold.untilTick);
  const beat = beatSeconds(tempo);
  const earliest = now + resumeLead(tempo, currentTime - now);
  const first = Math.max(0, Math.ceil((earliest - end) / beat - ON_LINE_TOLERANCE_SECONDS));
  const lines = beats === undefined ? first : first + wrap(-beats - first, BEATS_PER_BAR);
  return { at: end + lines * beat, beats: beatsLeft(lines) };
}

// The game resumes on `line`, by default the one `resumeLine` finds: the hold with its passes before
// it, the clock moved back by the beats between the end of the first pass and that line.
export function resumedOnBeat(
  hold: HeldBar,
  clock: Anchor,
  times: { readonly now: number; readonly currentTime: number },
  beats?: ReplayBeats,
  line: ResumeLine = resumeLine(hold, clock, times, beats),
): HeldBar {
  const { at } = line;
  const end = tickToTime(clock, hold.untilTick);
  const clockShift = Math.round((at - end) / beatSeconds(hold.tempo)) * hold.tempo.ticksPerBeat;
  return { ...hold, passFrom: hold.untilTick - clockShift, clockShift, resumesAt: at };
}

// The beats of the held bar the game plays again, read off the grid it plays on now: the pick that
// ended the choice moved it that many beats on from the grid the hold opened on.
export function replayedBeats(hold: HeldBar, played: Tempo): ReplayBeats {
  const beats = (played.originTick - hold.tempo.originTick) / hold.tempo.ticksPerBeat;
  return REPLAY_BEATS.find((candidate) => candidate === beats) ?? 0;
}

// The line `lines` beats past the first pass's end is beat `lines % 4 + 1` of the loop: the game
// plays again the beats left before the bar's end, none on a beat 1.
function beatsLeft(lines: number): ReplayBeats {
  return REPLAY_BEATS[wrap(-lines, BEATS_PER_BAR)] ?? 0;
}

export function inPass(hold: HeldBar | null, step: number): boolean {
  return (
    hold !== null && step >= hold.passFrom && (hold.resumesAt === null || step < hold.untilTick)
  );
}

// The game steps on the line it resumes on half a tick early at most, as a step lands on its tick.
export function reachesLine(now: number, line: number): boolean {
  return now >= line - TICK_SECONDS / 2;
}

// The ticks a step of a loop pass falls back by, onto the step of the held loop it replays: forward
// past its end, backward before it once the resume is set.
export function heldShift(hold: HeldBar | null, step: number): number {
  if (hold === null || !inPass(hold, step)) {
    return 0;
  }
  const into = wrap(step + hold.clockShift - hold.fromTick, loopTicks(hold));
  return step - (hold.fromTick + into);
}

// The clock a step fallen back by `ticks` is heard on, where the step it replaces would have been.
export function shiftedClock(clock: Anchor, ticks: number): Anchor {
  return ticks === 0 ? clock : { tick: clock.tick - ticks, time: clock.time };
}

function frameOf({ buffer, from, seconds }: FileSpot): number {
  const frame = Math.round(from * buffer.sampleRate) % Math.round(seconds * buffer.sampleRate);
  return Math.min(frame, buffer.length - 1);
}

// The `seconds` of a file a choice holds, to loop on their own: their first samples fade in from
// those that follow them, so that their last sample runs into their first as into what comes after;
// with nothing after them, from silence. From `silentFrom` seconds, it falls silent as a stem hushed
// on a break's last beat.
export function loopableBar(
  context: BaseAudioContext,
  bar: FileSpot,
  after: FileSpot | null,
  seconds: number,
  silentFrom: number | null,
): AudioBuffer {
  const { buffer } = bar;
  const rate = buffer.sampleRate;
  const length = Math.round(seconds * rate);
  const fade = Math.min(length, Math.round(WRAP_SECONDS * rate));
  const silent = silentFrom === null ? length : Math.round(silentFrom * rate);
  const hushFrames = (CUT_SECONDS / 4) * rate;
  const looped = context.createBuffer(buffer.numberOfChannels, length, rate);
  const samples = new Float32Array(length);
  const following = new Float32Array(fade);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    samples.fill(0);
    following.fill(0);
    buffer.copyFromChannel(samples, channel, frameOf(bar));
    if (after !== null) {
      const channels = after.buffer.numberOfChannels;
      after.buffer.copyFromChannel(following, Math.min(channel, channels - 1), frameOf(after));
    }
    for (let index = 0; index < fade; index += 1) {
      const share = index / fade;
      samples[index] = (samples[index] ?? 0) * share + (following[index] ?? 0) * (1 - share);
    }
    for (let index = silent; index < length; index += 1) {
      samples[index] = (samples[index] ?? 0) * Math.exp(-(index - silent) / hushFrames);
    }
    looped.copyToChannel(samples, channel);
  }
  return looped;
}
