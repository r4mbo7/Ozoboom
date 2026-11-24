import { type Tempo, beatPeriodMs } from '../shared/tempo';
import type { SimState } from '../sim/state';
import { type Family, type RenderContext } from './context';
import { Particles } from './effects';
import type { Frame } from './frame';
import { lookup } from './util';

// A light on a sixteenth of the wait fades within this share of it; one on a beat is twice the other.
const GLOW_FADE = 0.5;
const OFFBEAT_GLOW = 0.5;
const RING = { reach: 5, beats: 0.5, peak: 0.8 };

// While the game waits for the beat it resumes on after its cards, the light of the sixteenth line
// of that grid last passed, `now` and `at` in page milliseconds. Zero once there, and in calm mode.
export function resumeGlowAt(at: number | null, now: number, tempo: Tempo, calm: boolean): number {
  if (calm || at === null || now >= at) {
    return 0;
  }
  const sixteenth = beatPeriodMs(tempo.bpm) / 4;
  const lines = Math.ceil((at - now) / sixteenth);
  const since = lines * sixteenth - (at - now);
  const strength = lines % 4 === 0 ? 1 : OFFBEAT_GLOW;
  return strength * Math.exp(-since / (GLOW_FADE * sixteenth));
}

// While the game waits for its beat, the light of the wait on the frame, for the families drawn after
// it; on that beat, a ring leaves each player standing.
export function createResumeWait(ctx: RenderContext): Family {
  const rings = new Particles(ctx.layers.fx, ctx.textures.ring, 8);
  let waitedFor: number | null = null;
  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      const at = ctx.options.resumesAt ?? null;
      const page = performance.now();
      frame.resumeGlow = resumeGlowAt(at, page, frame.tempo, frame.calm);
      // A wait left by a pause or a quit ends long after its beat: nothing rings then.
      const onTheBeat = waitedFor !== null && page - waitedFor < beatPeriodMs(frame.tempo.bpm);
      if (onTheBeat && at === null && !frame.calm) {
        for (const player of state.players) {
          if (!player.downed && player.gone !== true) {
            rings.spawn({
              now: state.tick,
              duration: RING.beats * frame.tempo.ticksPerBeat,
              x: player.x,
              y: player.y,
              fromRadius: player.radius,
              toRadius: player.radius * RING.reach,
              tint: frame.palette[lookup(ctx.classTokens, player.classId, 'class')],
              peak: RING.peak,
            });
          }
        }
      }
      waitedFor = at;
      rings.update(frame.now);
    },
    reset(): void {
      rings.clear();
    },
    destroy(): void {
      rings.clear();
    },
  };
}
