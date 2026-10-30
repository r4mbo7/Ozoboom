import { clamp01 } from '../shared/scalar';

const CLIP_KNEE = 0.7;
export const CLIP_CEILING = 0.98;
const MUTE_SECONDS = 0.003;

export interface MasterChain {
  music: GainNode;
  sfx: GainNode;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
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

// `stems`, for a film: music and effects each through a chain of their own, on the first and the
// second stereo pair of a four-channel output, so that a montage can lay one music under its cuts.
export function createMasterChain(
  context: BaseAudioContext,
  muted = false,
  volume = 1,
  stems = false,
): MasterChain {
  const music = context.createGain();
  music.gain.value = 0.5;
  const sfx = context.createGain();
  sfx.gain.value = 0.45;
  const outputs: GainNode[] = [];
  const master = (...inputs: AudioNode[]): GainNode => {
    const output = masterOf(context, inputs, muted ? 0 : loudness(volume));
    outputs.push(output);
    return output;
  };

  if (stems) {
    const merger = context.createChannelMerger(4);
    [master(music), master(sfx)].forEach((output, pair) => {
      const splitter = context.createChannelSplitter(2);
      output.connect(splitter);
      splitter.connect(merger, 0, pair * 2);
      splitter.connect(merger, 1, pair * 2 + 1);
    });
    context.destination.channelInterpretation = 'discrete';
    merger.connect(context.destination);
  } else {
    master(music, sfx).connect(context.destination);
  }

  function glide(): void {
    const now = context.currentTime;
    for (const output of outputs) {
      output.gain.cancelScheduledValues(now);
      output.gain.setTargetAtTime(muted ? 0 : loudness(volume), now, MUTE_SECONDS);
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
  };
}

function masterOf(
  context: BaseAudioContext,
  inputs: readonly AudioNode[],
  level: number,
): GainNode {
  const glue = context.createDynamicsCompressor();
  glue.threshold.value = -18;
  glue.knee.value = 12;
  glue.ratio.value = 3;
  glue.attack.value = 0.01;
  glue.release.value = 0.2;

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
    input.connect(glue);
  }
  glue.connect(limiter);
  limiter.connect(clipper);
  clipper.connect(output);
  return output;
}
