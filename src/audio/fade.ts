import { TICKS_PER_BAR } from '../shared/tempo';
import { TICK_SECONDS } from './clock';

export const CROSSFADE_SECONDS = TICKS_PER_BAR * TICK_SECONDS;

const CURVE_POINTS_PER_SECOND = 200;

// A layer's presence moves linearly from 0 to 1; its gain follows a quarter sine, so a layer
// fading out and another fading in over the same time keep the total power constant.
export interface Fade {
  readonly from: number;
  readonly to: number;
  readonly start: number;
  readonly seconds: number;
}

export interface Fader {
  // Fades from wherever the layer is now, and returns when the fade ends.
  to(presence: number): number;
}

export function presenceGain(presence: number): number {
  return Math.sin((presence * Math.PI) / 2);
}

export function restingAt(presence: number): Fade {
  return { from: presence, to: presence, start: 0, seconds: 0 };
}

export function presenceAt(fade: Fade, time: number): number {
  if (time >= fade.start + fade.seconds) {
    return fade.to;
  }
  if (time <= fade.start) {
    return fade.from;
  }
  return fade.from + ((fade.to - fade.from) * (time - fade.start)) / fade.seconds;
}

export function fadeTo(current: Fade, presence: number, at: number): Fade {
  const from = presenceAt(current, at);
  return { from, to: presence, start: at, seconds: Math.abs(presence - from) * CROSSFADE_SECONDS };
}

export function fadeCurve(fade: Fade): Float32Array<ArrayBuffer> {
  const points = Math.max(2, Math.ceil(fade.seconds * CURVE_POINTS_PER_SECOND));
  const curve = new Float32Array(points);
  for (let index = 0; index < points; index += 1) {
    curve[index] = presenceGain(fade.from + ((fade.to - fade.from) * index) / (points - 1));
  }
  return curve;
}

export function createFader(param: AudioParam, context: BaseAudioContext, presence: number): Fader {
  let fade = restingAt(presence);
  param.value = presenceGain(presence);
  return {
    to(target) {
      const now = context.currentTime;
      fade = fadeTo(fade, target, now);
      param.cancelScheduledValues(now);
      if (fade.seconds > 0) {
        param.setValueCurveAtTime(fadeCurve(fade), now, fade.seconds);
      } else {
        param.setValueAtTime(presenceGain(target), now);
      }
      return now + fade.seconds;
    },
  };
}
