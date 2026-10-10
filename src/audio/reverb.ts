import type { SetDefinition } from '../data/types';

export type Acoustics = NonNullable<SetDefinition['acoustics']>;

export interface Reverb {
  // Feed it with what the room should ring with.
  input: AudioNode;
  disconnect(): void;
}

const PRE_DELAY_SECONDS = 0.025;
const DECAY_DB = 60;
const LEFT_SEED = 0x1234567;
const RIGHT_SEED = 0x51ed27;
const impulses = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();

function noise(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 31 - 1;
  };
}

// Decaying stereo noise: it falls by 60 dB over `seconds`, after a short pre-delay.
export function fillImpulse(
  samples: Float32Array,
  sampleRate: number,
  seconds: number,
  seed: number,
) {
  const random = noise(seed);
  const pre = Math.floor(PRE_DELAY_SECONDS * sampleRate);
  const decay = (DECAY_DB / 20) * Math.LN10;
  for (let index = pre; index < samples.length; index += 1) {
    const t = (index - pre) / sampleRate;
    samples[index] = random() * Math.exp((-t * decay) / seconds) * (1 - Math.exp(-t * 60)) * 0.5;
  }
}

function impulseOf(context: BaseAudioContext, seconds: number): AudioBuffer {
  let byLength = impulses.get(context);
  if (byLength === undefined) {
    byLength = new Map();
    impulses.set(context, byLength);
  }
  let buffer = byLength.get(seconds);
  if (buffer === undefined) {
    const rate = context.sampleRate;
    buffer = context.createBuffer(2, Math.ceil((seconds + PRE_DELAY_SECONDS) * rate), rate);
    fillImpulse(buffer.getChannelData(0), rate, seconds, LEFT_SEED);
    fillImpulse(buffer.getChannelData(1), rate, seconds, RIGHT_SEED);
    byLength.set(seconds, buffer);
  }
  return buffer;
}

// A room that rings `acoustics.reverbSeconds`, mixed back into `out` at `acoustics.wet`.
export function createReverb(out: AudioNode, acoustics: Acoustics): Reverb {
  const context = out.context;
  const input = context.createGain();
  const convolver = context.createConvolver();
  convolver.buffer = impulseOf(context, acoustics.reverbSeconds);
  const wet = context.createGain();
  wet.gain.value = acoustics.wet;
  input.connect(convolver);
  convolver.connect(wet);
  wet.connect(out);
  return {
    input,
    disconnect() {
      input.disconnect();
      wet.disconnect();
    },
  };
}
