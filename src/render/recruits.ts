import type { Sprite } from 'pixi.js';
import type { SimEvent, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import { Particles } from './effects';
import type { Frame } from './frame';
import { lerp } from './motion';
import { add, byId, hide, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const TAU = Math.PI * 2;
const LEAN = 0.3;
// The pop of a bad vibe as it joins, over its first beat, then a swell on every beat.
const POP = 0.25;
const SWELL = 0.12;
const HALO = 2.4;
const SPARKLES = 3;
const SPARKLE_ORBIT = 1.45;
const SPARKLE_SIZE = 0.38;
// The ring a bad vibe joins with grows from its edge to this many radii, in the recruiter's color.
const RING_REACH = 3.5;
const CALM_SLOWDOWN = 2;
const FALLBACK_RADIUS = 12;
const WHITE = 0xffffff;

interface RecruitView {
  readonly halo: Sprite;
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly sparkles: readonly Sprite[];
  heading: number;
  radius: number;
}

export type Burst = (x: number, y: number, id: number, frame: Frame) => void;

// Scale of a recruit over its radius: a pop as it joins, then the beat. No pop in calm mode.
export function recruitSwell(
  sinceJoined: number,
  ticksPerBeat: number,
  pulse: number,
  calm: boolean,
): number {
  const joining = !calm && sinceJoined >= 0 && sinceJoined < ticksPerBeat;
  return 1 + (joining ? POP * Math.sin((sinceJoined / ticksPerBeat) * Math.PI) : 0) + SWELL * pulse;
}

// Its glitter goes round it once a bar, each recruit from its own point; it holds still in calm mode.
export function sparkleAngle(
  now: number,
  ticksPerBar: number,
  id: number,
  index: number,
  calm: boolean,
): number {
  const turn = calm ? 0 : now / ticksPerBar;
  return (turn + index / SPARKLES + id * 0.618) * TAU;
}

// A bad vibe a player recruited: the gold smile it was chased with, hands up, glitter around it.
// It joins in a ring of its recruiter's color and, when it leaves, bursts like a chased bad vibe.
export function createRecruits(ctx: RenderContext, burst: Burst): Family {
  const { textures: t, layers } = ctx;
  const views = new ViewPool<RecruitView>(
    () => ({
      halo: add(layers.glow, t.halo),
      outline: add(layers.recruits, t.recruit),
      body: add(layers.recruits, t.recruit),
      sparkles: Array.from({ length: SPARKLES }, () => add(layers.recruits, t.vibes)),
      heading: Math.PI / 2,
      radius: FALLBACK_RADIUS,
    }),
    (view) => {
      hide(view.halo, view.outline, view.body, ...view.sparkles);
    },
  );
  const joinedAt = new Map<number, number>();
  const rings = new Particles(layers.fx, t.ring, 24);
  const puffs = new Particles(layers.fx, t.halo, 24);

  function join(event: Extract<SimEvent, { type: 'recruited' }>, state: SimState, frame: Frame) {
    joinedAt.set(event.id, state.tick);
    const radius = byId(state.recruits ?? [], event.id)?.radius ?? FALLBACK_RADIUS;
    const player = byId(state.players, event.playerId);
    const token = (player && ctx.classTokens.get(player.classId)) ?? 'or';
    rings.spawn({
      now: state.tick,
      duration: frame.tempo.ticksPerBeat * (frame.calm ? CALM_SLOWDOWN : 1),
      x: event.x,
      y: event.y,
      fromRadius: radius,
      toRadius: radius * RING_REACH,
      tint: frame.palette[token],
      peak: frame.calm ? 0.5 : 1,
    });
  }

  function leave(event: Extract<SimEvent, { type: 'recruitLeft' }>, state: SimState, frame: Frame) {
    joinedAt.delete(event.id);
    const radius = views.peek(event.id)?.radius ?? FALLBACK_RADIUS;
    if (!frame.calm) {
      burst(event.x, event.y, event.id, frame);
      return;
    }
    puffs.spawn({
      now: state.tick,
      duration: frame.tempo.ticksPerBeat * CALM_SLOWDOWN,
      x: event.x,
      y: event.y,
      fromRadius: radius * HALO,
      toRadius: radius * HALO * 1.5,
      tint: frame.palette.noyau,
      peak: 0.6,
    });
  }

  function reset(): void {
    views.releaseAll();
    joinedAt.clear();
    rings.clear();
    puffs.clear();
  }

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (event.type === 'recruited') {
        join(event, state, frame);
      } else if (event.type === 'recruitLeft') {
        leave(event, state, frame);
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light, calm, now, tempo } = frame;
      const glitter = light.additive ? WHITE : palette.or;
      views.begin();
      for (const recruit of state.recruits ?? []) {
        const view = views.acquire(recruit.id);
        const dx = recruit.x - recruit.prevX;
        const dy = recruit.y - recruit.prevY;
        if (dx !== 0 || dy !== 0) {
          view.heading = Math.atan2(dy, dx);
        }
        const x = lerp(recruit.prevX, recruit.x, alpha);
        const y = lerp(recruit.prevY, recruit.y, alpha);
        const since = now - (joinedAt.get(recruit.id) ?? Number.NEGATIVE_INFINITY);
        const radius = recruit.radius * recruitSwell(since, tempo.ticksPerBeat, frame.pulse, calm);

        view.radius = recruit.radius;
        const { halo, body, outline } = view;
        halo.visible = true;
        setTint(halo, palette.noyau);
        halo.position.set(x, y);
        halo.scale.set((recruit.radius * HALO) / t.halo.radius);
        halo.alpha = light.haloAlpha;

        body.visible = true;
        setTint(body, palette.noyau);
        body.position.set(x, y);
        body.scale.set(radius / t.recruit.radius);
        body.rotation = LEAN * Math.cos(view.heading);
        placeOutline(outline, body, t.recruit.texture, t.recruit.radius, frame);

        view.sparkles.forEach((sparkle, index) => {
          const angle = sparkleAngle(now, tempo.ticksPerBar, recruit.id, index, calm);
          sparkle.visible = true;
          setTint(sparkle, glitter);
          sparkle.position.set(
            x + Math.cos(angle) * radius * SPARKLE_ORBIT,
            y + Math.sin(angle) * radius * SPARKLE_ORBIT,
          );
          sparkle.scale.set((recruit.radius * SPARKLE_SIZE) / t.vibes.radius);
          sparkle.rotation = calm ? 0 : angle;
        });
      }
      views.end();
      rings.update(now);
      puffs.update(now);
    },
    reset,
    destroy(): void {
      reset();
      layers.recruits.destroy({ children: true });
    },
  };
}
