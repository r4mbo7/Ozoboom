import type { BlackoutState, SimState } from '../sim/state';
import { tickToTime, type Follow } from './clock';
import { playNoise, playTone } from './synth';

export interface MusicGain {
  gain: {
    cancelScheduledValues(at: number): void;
    setTargetAtTime(value: number, at: number, timeConstant: number): void;
  };
}

export interface Blank {
  follow(state: Pick<SimState, 'status' | 'blackout'>, followed: Follow, currentTime: number): void;
}

// The blank is heard only while the game runs: a level offer suspends it, and the music plays on.
export function heardBlackout(
  state: Pick<SimState, 'status' | 'blackout'>,
): BlackoutState | undefined {
  return state.status === 'running' ? state.blackout : undefined;
}

export function silentStep(blackout: BlackoutState | undefined, step: number): boolean {
  return blackout !== undefined && step >= blackout.startTick && step < blackout.endTick;
}

// The last beat before the blank stutters: each of its steps plays its first.
export function soundingStep(
  blackout: BlackoutState | undefined,
  step: number,
  ticksPerBeat: number,
): number {
  if (blackout === undefined) {
    return step;
  }
  const lastBeat = blackout.startTick - ticksPerBeat;
  return step >= lastBeat && step < blackout.startTick ? lastBeat : step;
}

// The music cuts dead and comes back as sharp on the one.
const CUT = { fall: 0.006, rise: 0.003 };
const CRACKLES = 7;

function clack(out: AudioNode, at: number): void {
  playNoise(out, at, {
    gain: 0.35,
    attack: 0.001,
    hold: 0.008,
    release: 0.04,
    filter: { type: 'highpass', hz: 1500 },
  });
  playTone(out, at, {
    wave: 'sine',
    hz: 110,
    toHz: 40,
    glide: 0.06,
    gain: 0.3,
    attack: 0.001,
    hold: 0.01,
    release: 0.08,
  });
}

// The returned stop ends the blank at once and drops what it has yet to play: on a clack when the plug is chased before, silently when a level offer suspends it or the clock moves.
function scheduleBlank(
  music: MusicGain,
  out: AudioNode,
  at: number,
  back: number,
  currentTime: number,
  opening: boolean,
): (now: number, clacking: boolean) => void {
  const context = out.context;
  music.gain.cancelScheduledValues(currentTime);
  music.gain.setTargetAtTime(0, at, CUT.fall);
  music.gain.setTargetAtTime(1, back, CUT.rise);
  const voice = context.createGain();
  voice.connect(out);
  if (opening) {
    clack(voice, at);
  }
  const length = Math.max(0.05, back - at);
  playTone(voice, at, {
    wave: 'sawtooth',
    hz: 50,
    gain: 0.05,
    attack: 0.04,
    hold: length - 0.07,
    release: 0.03,
    filter: { type: 'lowpass', hz: 320 },
  });
  for (let index = 0; index < CRACKLES; index += 1) {
    playNoise(voice, at + ((index + Math.random()) / CRACKLES) * length, {
      gain: 0.18,
      attack: 0.001,
      hold: 0.004,
      release: 0.015,
      filter: { type: 'highpass', hz: 3000 },
    });
  }
  clack(voice, back);
  let stopped = false;
  return (now, clacking) => {
    if (stopped || now >= back) {
      return;
    }
    stopped = true;
    voice.gain.setTargetAtTime(0, now, 0.01);
    music.gain.cancelScheduledValues(now);
    music.gain.setTargetAtTime(1, now, CUT.rise);
    if (clacking) {
      clack(out, now);
    }
  };
}

// The blank cuts tails and echoes too; a level offer suspends it until the game runs again, and a clock moved by a pause or a hidden tab plays it again where the game now has it.
export function createBlank(music: MusicGain, out: AudioNode): Blank {
  let silenced: BlackoutState | null = null;
  let stop: ((now: number, clacking: boolean) => void) | null = null;
  return {
    follow(state, followed, currentTime) {
      const blackout = heardBlackout(state);
      const clock = followed.anchor;
      if (
        blackout !== undefined &&
        (followed.resynced || blackout.startTick !== silenced?.startTick)
      ) {
        const at = tickToTime(clock, blackout.startTick);
        // A blank already under way goes on without a second clack.
        const opening = blackout.startTick !== silenced?.startTick || at > currentTime;
        stop?.(currentTime, false);
        silenced = { ...blackout };
        stop = scheduleBlank(
          music,
          out,
          Math.max(currentTime, at),
          Math.max(currentTime, tickToTime(clock, blackout.endTick)),
          currentTime,
          opening,
        );
      } else if (blackout === undefined && silenced !== null) {
        stop?.(currentTime, state.status === 'running');
        stop = null;
        silenced = null;
      }
    },
  };
}
