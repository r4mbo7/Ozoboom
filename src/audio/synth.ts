export interface Envelope {
  gain: number;
  attack: number;
  hold: number;
  release: number;
  pan?: number;
}

export interface Vibrato {
  hz: number;
  cents: number;
  delay: number;
}

export interface FilterSpec {
  type: BiquadFilterType;
  hz: number;
  toHz?: number;
  glide?: number;
  q?: number;
}

export interface ToneSpec extends Envelope {
  wave: OscillatorType;
  hz: number;
  toHz?: number;
  glide?: number;
  detune?: number;
  vibrato?: Vibrato;
  filter?: FilterSpec;
}

export interface NoiseSpec extends Envelope {
  filter: FilterSpec;
}

const SILENCE = 0.0001;
const NOISE_SECONDS = 2;
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(context: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(context);
  if (buffer === undefined) {
    buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * NOISE_SECONDS),
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    let seed = 0x9e3779b9;
    for (let index = 0; index < samples.length; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[index] = seed / 2 ** 31 - 1;
    }
    noiseBuffers.set(context, buffer);
  }
  return buffer;
}

function glide(param: AudioParam, from: number, to: number | undefined, at: number, seconds = 0) {
  param.setValueAtTime(from, at);
  if (to !== undefined && seconds > 0) {
    param.exponentialRampToValueAtTime(to, at + seconds);
  }
}

function shape(context: BaseAudioContext, at: number, envelope: Envelope): [GainNode, number] {
  const amp = context.createGain();
  const peakAt = at + envelope.attack;
  const holdUntil = peakAt + envelope.hold;
  const end = holdUntil + envelope.release;
  amp.gain.setValueAtTime(0, at);
  amp.gain.linearRampToValueAtTime(envelope.gain, peakAt);
  amp.gain.setValueAtTime(envelope.gain, holdUntil);
  amp.gain.exponentialRampToValueAtTime(SILENCE, end);
  amp.gain.setValueAtTime(0, end);
  return [amp, end];
}

function panned(amp: GainNode, out: AudioNode, pan: number | undefined): void {
  if (pan === undefined) {
    amp.connect(out);
    return;
  }
  const panner = amp.context.createStereoPanner();
  panner.pan.value = pan;
  amp.connect(panner);
  panner.connect(out);
}

function wobble(oscillator: OscillatorNode, at: number, end: number, vibrato: Vibrato): void {
  const context = oscillator.context;
  const lfo = context.createOscillator();
  lfo.frequency.value = vibrato.hz;
  const depth = context.createGain();
  const from = Math.min(at + vibrato.delay, end);
  depth.gain.setValueAtTime(0, at);
  depth.gain.setValueAtTime(0, from);
  depth.gain.linearRampToValueAtTime(vibrato.cents, Math.min(from + 0.12, end));
  lfo.connect(depth);
  depth.connect(oscillator.detune);
  lfo.start(at);
  lfo.stop(end);
}

function filtered(
  context: BaseAudioContext,
  source: AudioNode,
  at: number,
  spec: FilterSpec | undefined,
): AudioNode {
  if (spec === undefined) {
    return source;
  }
  const filter = context.createBiquadFilter();
  filter.type = spec.type;
  filter.Q.value = spec.q ?? 0.7;
  glide(filter.frequency, spec.hz, spec.toHz, at, spec.glide);
  source.connect(filter);
  return filter;
}

export function playTone(out: AudioNode, at: number, spec: ToneSpec): number {
  const context = out.context;
  const oscillator = context.createOscillator();
  oscillator.type = spec.wave;
  oscillator.detune.value = spec.detune ?? 0;
  glide(oscillator.frequency, spec.hz, spec.toHz, at, spec.glide);
  const [amp, end] = shape(context, at, spec);
  filtered(context, oscillator, at, spec.filter).connect(amp);
  panned(amp, out, spec.pan);
  if (spec.vibrato !== undefined) {
    wobble(oscillator, at, end, spec.vibrato);
  }
  oscillator.start(at);
  oscillator.stop(end);
  return end;
}

export function playNoise(out: AudioNode, at: number, spec: NoiseSpec): number {
  const context = out.context;
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  source.loop = true;
  const [amp, end] = shape(context, at, spec);
  filtered(context, source, at, spec.filter).connect(amp);
  panned(amp, out, spec.pan);
  source.start(at, (at * 0.618) % NOISE_SECONDS);
  source.stop(end);
  return end;
}
