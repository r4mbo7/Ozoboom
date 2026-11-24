import { wrap } from '../shared/scalar';
import { barOfTick, type Tempo } from '../shared/tempo';
import { TICK_SECONDS, beatSeconds, tickToTime, type Anchor } from './clock';
import { CUT_SECONDS } from './music-step';

// The bar the music loops while an upgrade choice holds `tick`, from its first tick to the next
// bar's; the tick its break falls silent on when it is the last bar of a break. Its loop passes
// replay it from `passFrom`: past its end until the game resumes, then, once the resume is set on a
// beat line of the loop at `resumesAt`, on the clock moved back by `clockShift` ticks so that its end
// falls there, until its end, the last pass cut short on that beat.
export interface HeldBar {
  readonly tick: number;
  readonly fromTick: number;
  readonly untilTick: number;
  readonly cutTick: number | null;
  readonly passFrom: number;
  readonly clockShift: number;
  readonly resumesAt: number | null;
}

const ON_LINE_TOLERANCE_SECONDS = 1e-6;

// Where a decoded file is read, `from` seconds into its part that loops every `seconds`.
export interface FileSpot {
  readonly buffer: AudioBuffer;
  readonly from: number;
  readonly seconds: number;
}

// Long enough to take the click out of a wrap, too short to soften a hit.
const WRAP_SECONDS = 0.003;

export function heldBarOf(tick: number, tempo: Tempo, dropTick: number | null): HeldBar {
  const fromTick = tempo.originTick + barOfTick(tick, tempo) * tempo.ticksPerBar;
  const untilTick = fromTick + tempo.ticksPerBar;
  return {
    tick,
    fromTick,
    untilTick,
    cutTick: dropTick === untilTick ? dropTick - tempo.ticksPerBeat : null,
    passFrom: untilTick,
    clockShift: 0,
    resumesAt: null,
  };
}

// The game resumes on the first beat line of the loop a sixteenth after `now` at least, where the
// bar after the held one starts: the hold with its passes before its end, the clock moved back by
// whole beats so that its end falls on that line. A line the output latency would put behind
// `currentTime`, where the loop's cut could no longer be scheduled, gives way to the next.
export function resumedOnBeat(
  hold: HeldBar,
  clock: Anchor,
  { now, currentTime }: { readonly now: number; readonly currentTime: number },
  tempo: Tempo,
): HeldBar {
  const end = tickToTime(clock, hold.untilTick);
  const beat = beatSeconds(tempo);
  const earliest = Math.max(now + beat / 4, currentTime + 2 * CUT_SECONDS);
  const beats = Math.max(0, Math.ceil((earliest - end) / beat - ON_LINE_TOLERANCE_SECONDS));
  const clockShift = beats * tempo.ticksPerBeat;
  return {
    ...hold,
    passFrom: hold.untilTick - clockShift,
    clockShift,
    resumesAt: end + beats * beat,
  };
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

// The ticks a step of a loop pass falls back by, onto the step of the held bar it replays: forward
// past its end, backward before it once the resume is set.
export function heldShift(hold: HeldBar | null, step: number): number {
  if (hold === null || !inPass(hold, step)) {
    return 0;
  }
  const bar = hold.untilTick - hold.fromTick;
  const into = wrap(step + hold.clockShift - hold.fromTick, bar);
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

// One bar of a file, to loop on its own: its first samples fade in from those that follow the bar,
// so that its last sample runs into its first as into the bar after it; with nothing after it, from
// silence. From `silentFrom` seconds, it falls silent as a stem hushed on a break's last beat.
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
