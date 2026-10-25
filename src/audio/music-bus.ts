import type { MusicTrack } from '../data/types';
import { LOOKAHEAD_SECONDS } from './clock';
import { createReverb, type Acoustics, type Reverb } from './reverb';

export interface Bus {
  input: BiquadFilterNode;
  cutoff: number;
  output: GainNode;
  lead: GainNode;
  echo: DelayNode;
  echoFeedback: GainNode;
  echoReturn: GainNode;
  feedback: number;
  ret: number;
}

export interface Room {
  send(output: AudioNode, acoustics: Acoustics | undefined): void;
}

const ECHO_FEEDBACK = 0.38;
const ECHO_RETURN = 0.32;
const ECHO_TONE = 2600;
const ECHO_SPREAD = 0.85;
const BUS_TAIL_SECONDS = 2;

export function createBus(
  level: AudioNode,
  cutoff: number,
  trackEcho: MusicTrack['echo'],
  echoSeconds: number,
): Bus {
  const context = level.context;
  const input = context.createBiquadFilter();
  input.type = 'lowpass';
  input.frequency.value = cutoff;
  input.Q.value = 0.7;
  const output = context.createGain();
  input.connect(output);
  output.connect(level);
  const lead = context.createGain();
  const echo = context.createDelay(1);
  echo.delayTime.value = echoSeconds;
  const echoTone = context.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = trackEcho?.tone ?? ECHO_TONE;
  const feedback = trackEcho?.feedback ?? ECHO_FEEDBACK;
  const ret = trackEcho?.ret ?? ECHO_RETURN;
  const echoFeedback = context.createGain();
  echoFeedback.gain.value = feedback;
  const echoReturn = context.createGain();
  echoReturn.gain.value = ret;
  lead.connect(input);
  lead.connect(echo);
  echo.connect(echoTone);
  if (trackEcho?.wide === true) {
    const left = context.createStereoPanner();
    left.pan.value = -ECHO_SPREAD;
    const right = context.createStereoPanner();
    right.pan.value = ECHO_SPREAD;
    const second = context.createDelay(1);
    second.delayTime.value = echoSeconds;
    echoTone.connect(left);
    left.connect(echoReturn);
    echoTone.connect(second);
    second.connect(right);
    right.connect(echoReturn);
    second.connect(echoFeedback);
  } else {
    echoTone.connect(echoFeedback);
    echoTone.connect(echoReturn);
  }
  echoFeedback.connect(echo);
  echoReturn.connect(input);
  return { input, cutoff, output, lead, echo, echoFeedback, echoReturn, feedback, ret };
}

export function retireBus(old: Bus | null, fadeSeconds: number) {
  if (old === null) {
    return;
  }
  old.output.gain.setTargetAtTime(0, old.output.context.currentTime, fadeSeconds / 4);
  setTimeout(
    () => {
      old.output.disconnect();
      old.echoFeedback.disconnect();
    },
    (fadeSeconds + LOOKAHEAD_SECONDS + BUS_TAIL_SECONDS) * 1000,
  );
}

export function setEcho(target: Bus, at: number, open: boolean) {
  target.echoFeedback.gain.setTargetAtTime(open ? target.feedback : 0, at, 0.01);
  target.echoReturn.gain.setTargetAtTime(open ? target.ret : 0, at, 0.01);
}

// One room for every bus: a bus opens on each resync, its own reverb would pile up.
export function createRoom(level: AudioNode): Room {
  let room: { acoustics: Acoustics; reverb: Reverb } | null = null;
  return {
    send(output, acoustics) {
      if (room?.acoustics !== acoustics) {
        const left = room;
        if (left !== null) {
          setTimeout(
            () => {
              left.reverb.disconnect();
            },
            (left.acoustics.reverbSeconds + BUS_TAIL_SECONDS) * 1000,
          );
        }
        room =
          acoustics === undefined ? null : { acoustics, reverb: createReverb(level, acoustics) };
      }
      if (room !== null) {
        output.connect(room.reverb.input);
      }
    },
  };
}
