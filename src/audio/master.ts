import { clamp01 } from '../shared/scalar';
import type { BusLevels } from './types';

const CLIP_KNEE = 0.7;
export const CLIP_CEILING = 0.98;
const MUTE_SECONDS = 0.003;
// What the effects and music buses pass on to the master chain.
export const SFX_BUS_GAIN = 0.45;
export const MUSIC_BUS_GAIN = 0.5;
// What a bus may feed the limiter, whose threshold (-6 dB) a single file never reaches, from the
// loudest sample of that file.
export const LOUDEST_PEAK = 0.475;

export const FULL_LEVELS: BusLevels = { music: 1, effects: 1 };

export interface MasterChain {
  music: GainNode;
  sfx: GainNode;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setLevels(levels: BusLevels): void;
}

interface MasterOptions {
  readonly muted?: boolean;
  readonly volume?: number;
  readonly levels?: BusLevels;
  // For a film: music and effects each through a chain of their own, on the first and the second
  // stereo pair of a four-channel output, so that a montage can lay one music under its cuts.
  readonly stems?: boolean;
}

// The ear hears loudness on a log scale: a squared level spreads its steps evenly.
export function loudness(volume: number): number {
  return clamp01(volume) ** 2;
}

export function softClipCurve(size = 4097): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  const room = CLIP_CEILING - CLIP_KNEE;
  for (let index = 0; index < size; index += 1) {
    const x = (index / (size - 1)) * 2 - 1;
    const magnitude = Math.abs(x);
    const y =
      magnitude <= CLIP_KNEE
        ? magnitude
        : CLIP_KNEE + room * Math.tanh((magnitude - CLIP_KNEE) / room);
    curve[index] = Math.sign(x) * y;
  }
  return curve;
}

export function createMasterChain(
  context: BaseAudioContext,
  options: MasterOptions = {},
): MasterChain {
  let { muted = false, volume = 1 } = options;
  const levels = options.levels ?? FULL_LEVELS;
  const music = context.createGain();
  music.gain.value = MUSIC_BUS_GAIN;
  const sfx = context.createGain();
  sfx.gain.value = SFX_BUS_GAIN;
  // Each bus through a glue of its own, so that an effect never pushes the music down, then the
  // player's level of that bus: after the glue, so that a lower level keeps the bus's dynamics.
  const musicLevel = context.createGain();
  musicLevel.gain.value = loudness(levels.music);
  const sfxLevel = context.createGain();
  sfxLevel.gain.value = loudness(levels.effects);
  music.connect(glueOf(context)).connect(musicLevel);
  sfx.connect(glueOf(context)).connect(sfxLevel);
  const outputs: GainNode[] = [];
  const master = (...inputs: AudioNode[]): GainNode => {
    const output = masterOf(context, inputs, muted ? 0 : loudness(volume));
    outputs.push(output);
    return output;
  };

  if (options.stems === true) {
    const merger = context.createChannelMerger(4);
    [master(musicLevel), master(sfxLevel)].forEach((output, pair) => {
      const splitter = context.createChannelSplitter(2);
      output.connect(splitter);
      splitter.connect(merger, 0, pair * 2);
      splitter.connect(merger, 1, pair * 2 + 1);
    });
    context.destination.channelInterpretation = 'discrete';
    merger.connect(context.destination);
  } else {
    master(musicLevel, sfxLevel).connect(context.destination);
  }

  function glideTo(gain: AudioParam, level: number): void {
    const now = context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(level, now, MUTE_SECONDS);
  }

  function glide(): void {
    for (const output of outputs) {
      glideTo(output.gain, muted ? 0 : loudness(volume));
    }
  }

  return {
    music,
    sfx,
    setMuted(value) {
      muted = value;
      glide();
    },
    setVolume(value) {
      volume = value;
      glide();
    },
    setLevels(value) {
      glideTo(musicLevel.gain, loudness(value.music));
      glideTo(sfxLevel.gain, loudness(value.effects));
    },
  };
}

function glueOf(context: BaseAudioContext): DynamicsCompressorNode {
  const glue = context.createDynamicsCompressor();
  glue.threshold.value = -18;
  glue.knee.value = 12;
  glue.ratio.value = 3;
  glue.attack.value = 0.01;
  glue.release.value = 0.2;
  return glue;
}

// The buses meet only at the limiter.
function masterOf(
  context: BaseAudioContext,
  inputs: readonly AudioNode[],
  level: number,
): GainNode {
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;

  const clipper = context.createWaveShaper();
  clipper.curve = softClipCurve();
  clipper.oversample = 'none';

  // After the limiter, so that a lower level keeps the same mix and dynamics.
  const output = context.createGain();
  output.gain.value = level;

  for (const input of inputs) {
    input.connect(limiter);
  }
  limiter.connect(clipper);
  clipper.connect(output);
  return output;
}
