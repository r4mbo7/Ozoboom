import { Graphics, type Sprite } from 'pixi.js';
import { clamp01, lerp, smoothstep } from '../shared/scalar';
import type { DancerState, EntityId, SimEvent, SimState, Vec2 } from '../sim/state';
import { spotOf } from './boss-spotlight';
import type { Family, RenderContext } from './context';
import { createDancerBody } from './dancer-body';
import { paintLooks } from './dancer-looks';
import { Particles } from './effects';
import { createFallenMask, maskPath, maskReach, slideTo, type MaskPath } from './fallen-mask';
import { createFollowspots, teamCenter } from './followspot';
import type { Frame } from './frame';
import { paintedLater } from './paint';
import { mixColor } from './palette';
import { add, hide, setTint } from './util';
import { ViewPool } from './views';

const RIM = { breath: 0.035, alpha: 0.5, beat: 0.35, width: 2 };
const BEAM = { white: 0xffffff, warmth: 0.6 };
const LIT = { reach: 6, soft: 8, halo: 2.2, alpha: 0.35 };
const FLASH = { beats: 0.5, alpha: 0.45, reach: 1.6 };
const SOOTHE = { beats: 0.75, from: 1.1, grow: 0.6, width: 2.5 };
const SPARKS = { count: 5, beats: 0.9, first: -1.1, step: 0.42, travel: 14, size: 5 };
const BRIGHTNESS = { night: 0.85, day: 0.55 };

interface Shown {
  readonly id: EntityId;
  readonly track: number;
  readonly notches: number;
  readonly mask: MaskPath;
  goneShow: number | null;
  flashAt: number;
  soothedAt: number;
}

// The dancer under a chased Néon's mask: the core's followspot sweeps to him and its pool is his
// track, his fallen mask lies nearer by a notch for each hit, and the bad vibes in his light are lit.
export function createDancer(ctx: RenderContext): Family {
  const { layers, textures } = ctx;
  const looks = paintedLater(paintLooks);
  const spots = createFollowspots(layers.glow, layers.core, BRIGHTNESS);
  const ground = new Graphics();
  layers.core.addChild(ground);
  const rims = new Graphics();
  layers.glow.addChild(rims);
  const body = createDancerBody(layers, textures.halo, ground);
  const flash = add(layers.fx, textures.halo);
  const mask = createFallenMask(layers, textures.halo);
  const sparks = new Particles(layers.fx, textures.vibes, SPARKS.count * 2);
  const lit = new ViewPool<Sprite>(
    () => add(layers.glow, textures.halo),
    (sprite) => {
      hide(sprite);
    },
  );
  let shown: Shown | null = null;

  function adopt(dancer: DancerState, since: number): Shown {
    const special = ctx.specials.get(dancer.kind);
    if (special?.kind !== 'unmask') {
      throw new Error(`the bad vibe "${dancer.kind}" leaves no dancer`);
    }
    const reach = maskReach(special.trackRadius, dancer.notches, special.notches);
    return {
      id: dancer.id,
      track: special.trackRadius,
      notches: special.notches,
      mask: maskPath(dancer, reach, since),
      goneShow: null,
      flashAt: Number.NEGATIVE_INFINITY,
      soothedAt: Number.NEGATIVE_INFINITY,
    };
  }

  // A soft white on each hit, a healer ring on each heal that pushes the mask back.
  function placeMoments(dancer: DancerState, seen: Shown, frame: Frame): void {
    const beat = frame.tempo.ticksPerBeat;
    const flashed = (frame.now - seen.flashAt) / (FLASH.beats * beat);
    flash.visible = flashed >= 0 && flashed < 1;
    if (flash.visible) {
      flash.position.set(dancer.x, dancer.y);
      flash.scale.set((dancer.radius * FLASH.reach) / textures.halo.radius);
      flash.alpha = FLASH.alpha * Math.sin(Math.PI * flashed);
      setTint(flash, BEAM.white);
    }
    const soothed = (frame.now - seen.soothedAt) / (SOOTHE.beats * beat);
    if (soothed >= 0 && soothed < 1) {
      rims
        .circle(dancer.x, dancer.y, dancer.radius * (SOOTHE.from + SOOTHE.grow * (1 - soothed)))
        .stroke({ color: frame.palette.healer, alpha: 1 - soothed, width: SOOTHE.width });
    }
  }

  // A bad vibe that steps into his light is lit.
  function lightUp(
    state: SimState,
    dancer: DancerState,
    track: number,
    alpha: number,
    tint: number,
  ) {
    lit.begin();
    for (const enemy of state.enemies) {
      const x = lerp(enemy.prevX, enemy.x, alpha);
      const y = lerp(enemy.prevY, enemy.y, alpha);
      const share = smoothstep(
        clamp01((track + LIT.reach - Math.hypot(x - dancer.x, y - dancer.y)) / LIT.soft),
      );
      if (share <= 0) {
        continue;
      }
      const halo = lit.acquire(enemy.id);
      halo.visible = true;
      halo.position.set(x, y);
      halo.scale.set((enemy.radius * LIT.halo) / textures.halo.radius);
      halo.alpha = LIT.alpha * share;
      setTint(halo, tint);
    }
    lit.end();
  }

  // A few gold sparks where the mask comes off.
  function sparkle(at: Vec2, radius: number, frame: Frame): void {
    for (let spark = 0; spark < SPARKS.count; spark += 1) {
      const angle = SPARKS.first + spark * SPARKS.step;
      sparks.spawn({
        now: frame.now,
        duration: SPARKS.beats * frame.tempo.ticksPerBeat,
        x: at.x + Math.cos(angle) * (radius + 2),
        y: at.y + Math.sin(angle) * (radius + 2),
        dx: Math.cos(angle) * SPARKS.travel,
        dy: Math.sin(angle) * SPARKS.travel,
        fromRadius: SPARKS.size,
        toRadius: SPARKS.size / 3,
        tint: frame.palette.or,
        peak: 1,
      });
    }
  }

  function followspot(state: SimState, alpha: number, frame: Frame): void {
    spots.begin();
    if (shown !== null) {
      const beat = frame.tempo.ticksPerBeat;
      const beats = (frame.now - shown.mask.since) / beat;
      const gone = shown.goneShow === null ? null : (frame.show - shown.goneShow) / beat;
      const team = teamCenter(state.players, state.core, alpha);
      const spot = spotOf(beats, state.core, team, shown.mask, frame.calm, gone);
      if (spot === null && gone !== null) {
        shown = null;
      } else if (spot !== null) {
        spots.show(shown.id, spot, state, frame, shown.track);
      }
    }
    spots.end();
  }

  function clear(): void {
    ground.clear();
    rims.clear();
    body.hide();
    hide(flash);
    mask.hide();
  }

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (event.type === 'dancerUnmasked' && state.dancer?.id === event.id) {
        shown = adopt(state.dancer, state.tick);
        sparkle(event, state.dancer.radius, frame);
      } else if (event.type === 'dancerHit' && shown?.id === event.id) {
        shown.flashAt = state.tick;
      } else if (event.type === 'dancerSoothed' && shown?.id === event.id) {
        shown.soothedAt = state.tick;
      } else if (event.type === 'dancerMasked' && shown?.id === event.id) {
        mask.burst(shown.mask, frame);
        shown.goneShow = frame.show;
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { dancer } = state;
      clear();
      if (dancer !== undefined && shown?.id !== dancer.id) {
        shown = adopt(dancer, Number.NEGATIVE_INFINITY);
      }
      followspot(state, alpha, frame);
      const tint = mixColor(BEAM.white, frame.palette.or, BEAM.warmth);
      if (dancer !== undefined && shown !== null) {
        const painted = looks.get();
        slideTo(shown.mask, maskReach(shown.track, dancer.notches, shown.notches), frame);
        const breath = frame.calm ? 0 : frame.pulse;
        rims
          .circle(dancer.x, dancer.y, shown.track * (1 + RIM.breath * breath))
          .stroke({ color: tint, alpha: RIM.alpha + RIM.beat * breath, width: RIM.width });
        body.place(dancer, state.core, frame);
        placeMoments(dancer, shown, frame);
        mask.place(shown.mask, frame, painted, ground);
        lightUp(state, dancer, shown.track, alpha, tint);
      } else {
        lit.begin();
        lit.end();
      }
      const burst = mask.update(frame, looks.painted);
      // As his mask slides back on, he fades under it.
      if (dancer === undefined && shown !== null && burst !== null && burst.slide < 1) {
        body.place(shown.mask, state.core, frame, 1 - burst.slide);
      }
      sparks.update(frame.now);
    },
    reset(): void {
      shown = null;
      clear();
      mask.reset();
      sparks.clear();
      lit.begin();
      lit.end();
      spots.reset();
    },
    destroy(): void {
      spots.destroy();
      ground.destroy();
      rims.destroy();
      body.destroy();
      const painted = looks.painted;
      if (painted !== undefined) {
        for (const shape of [...painted.masks, painted.flare]) {
          shape.texture.destroy(true);
        }
      }
    },
  };
}
