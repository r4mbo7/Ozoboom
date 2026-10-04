export const CLIP_KNEE = 0.7;
export const CLIP_CEILING = 0.98;
const MUTE_SECONDS = 0.003;

export interface MasterChain {
  music: GainNode;
  sfx: GainNode;
  setMuted(muted: boolean): void;
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

export function createMasterChain(context: BaseAudioContext): MasterChain {
  const music = context.createGain();
  music.gain.value = 0.5;
  const sfx = context.createGain();
  sfx.gain.value = 0.45;

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

  const mute = context.createGain();

  music.connect(glue);
  sfx.connect(glue);
  glue.connect(limiter);
  limiter.connect(clipper);
  clipper.connect(mute);
  mute.connect(context.destination);

  return {
    music,
    sfx,
    setMuted(muted) {
      const now = context.currentTime;
      mute.gain.cancelScheduledValues(now);
      mute.gain.setTargetAtTime(muted ? 0 : 1, now, MUTE_SECONDS);
    },
  };
}
