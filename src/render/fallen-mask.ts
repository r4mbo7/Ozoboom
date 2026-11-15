import { Graphics } from 'pixi.js';
import { clamp01, lerp, smoothstep } from '../shared/scalar';
import type { Vec2 } from '../sim/state';
import type { Looks } from './dancer-looks';
import { FACE_RADIUS } from './face-kit';
import type { Frame } from './frame';
import type { Layers } from './layers';
import { MAGENTA, NEON_TUBES, TURQUOISE } from './neon-face';
import { TAU, type Shape } from './paint';
import { add, keepIn, setTint } from './util';

const MASK = { rest: 0.85, size: 0.8, slideBeats: 0.35 };
const FALL = { looseBeats: 0.35, landBeats: 1.35, firstOut: 0.25, eachOut: 0.4, turn: 0.85 };
export const SHADOW = { color: 0x120a04, alpha: 0.32 };
const GOLDEN_ANGLE = 2.399963;
const UNTINTED = 0xffffff;

// Where his mask lies before any hit, as a share of the track, nearer by a notch for each hit:
// the last notch puts it back on.
export function maskReach(trackRadius: number, notches: number, maxNotches: number): number {
  return trackRadius * MASK.rest * (1 - notches / (maxNotches + 1));
}

// How many of its tubes have gone out, `beats` after the mask came off.
export function tubesOut(beats: number): number {
  const lying = beats - FALL.landBeats - FALL.firstOut;
  return lying < 0 ? 0 : Math.min(NEON_TUBES.length, Math.floor(lying / FALL.eachOut) + 1);
}

// One dancer's mask: off his face at `since`, then sliding from `from` to `to` away from him.
export interface MaskPath {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly angle: number;
  readonly since: number;
  from: number;
  to: number;
  movedAt: number;
}

export function maskPath(
  dancer: Vec2 & { readonly id: number; readonly radius: number },
  reach: number,
  since: number,
): MaskPath {
  return {
    x: dancer.x,
    y: dancer.y,
    radius: dancer.radius,
    angle: (dancer.id * GOLDEN_ANGLE) % TAU,
    since,
    from: reach,
    to: reach,
    movedAt: Number.NEGATIVE_INFINITY,
  };
}

function reachOf(path: MaskPath, frame: Frame): number {
  const slide = (frame.now - path.movedAt) / (MASK.slideBeats * frame.tempo.ticksPerBeat);
  return lerp(path.from, path.to, smoothstep(clamp01(slide)));
}

export function slideTo(path: MaskPath, reach: number, frame: Frame): void {
  if (reach !== path.to) {
    path.from = reachOf(path, frame);
    path.to = reach;
    path.movedAt = frame.now;
  }
}

function maskAt(path: MaskPath, frame: Frame): Vec2 {
  const reach = reachOf(path, frame);
  return { x: path.x + Math.cos(path.angle) * reach, y: path.y + Math.sin(path.angle) * reach };
}

// At his last notch the mask slides back on his face, its tubes relight one by one, it swells
// white and pops; `slide` and `swell` from 0 to 1, `pop` from 0 to 1 once it has popped.
export interface Burst {
  readonly slide: number;
  readonly out: number;
  readonly swell: number;
  readonly pop: number | null;
}

// The vibes he leaves fly from the same tick: it pops within half a beat to read with them.
const BURST = {
  slideBeats: 0.15,
  eachLit: 0.04,
  swellFrom: 0.3,
  popAt: 0.4,
  popBeats: 0.7,
  swell: 0.25,
  // The mask sits on his face, above his middle, as a share of his radius.
  face: 0.55,
};
const POP = { glow: 0.35, flare: 0.3, reach: 1.75, ring: 0.6, ringGrow: 1.3, ringAlpha: 0.5 };
const SPARK = { count: 10, from: 0.5, travel: 1.3, size: 0.18, end: 0.05, turn: 0.3 };

// `beats` after his last notch, null once it is over; calm, it fades on, lit, and fades away.
export function burstAt(beats: number, calm: boolean): Burst | null {
  if (beats < 0 || beats >= BURST.popAt + BURST.popBeats) {
    return null;
  }
  const slide = smoothstep(clamp01(beats / BURST.slideBeats));
  const pop = beats < BURST.popAt ? null : (beats - BURST.popAt) / BURST.popBeats;
  if (calm) {
    return { slide, out: 0, swell: 0, pop };
  }
  const lit =
    beats < BURST.slideBeats ? 0 : Math.floor((beats - BURST.slideBeats) / BURST.eachLit) + 1;
  return {
    slide,
    out: Math.max(0, NEON_TUBES.length - lit),
    swell: smoothstep(clamp01((beats - BURST.swellFrom) / (BURST.popAt - BURST.swellFrom))),
    pop,
  };
}

interface Bursting {
  readonly start: number;
  readonly from: Vec2;
  readonly to: Vec2;
  readonly radius: number;
}

export interface FallenMask {
  // It slips off his face, falls beside him, its tubes go out one by one; under him once it lies.
  place(path: MaskPath, frame: Frame, looks: Looks, ground: Graphics): void;
  burst(path: MaskPath, frame: Frame): void;
  // The burst, drawn after he is gone, as far as it has gone.
  update(frame: Frame, looks: Looks | undefined): Burst | null;
  hide(): void;
  reset(): void;
}

export function createFallenMask(layers: Layers, halo: Shape): FallenMask {
  const sprite = add(layers.core, { texture: halo.texture, radius: FACE_RADIUS });
  const flare = add(layers.fx, halo);
  const sparks = new Graphics();
  layers.fx.addChild(sparks);
  let bursting: Bursting | null = null;

  function show(texture: Shape | undefined, landed: boolean): void {
    sprite.visible = true;
    keepIn(landed ? layers.core : layers.bystanders, sprite);
    sprite.texture = texture?.texture ?? sprite.texture;
    setTint(sprite, UNTINTED);
  }

  function placeOn(on: Bursting, burst: Burst, frame: Frame, looks: Looks): void {
    const { slide, out, swell } = burst;
    show(swell > 0 ? looks.flare : looks.masks[out], false);
    const at = frame.calm ? 1 : slide;
    sprite.position.set(lerp(on.from.x, on.to.x, at), lerp(on.from.y, on.to.y, at));
    sprite.rotation = FALL.turn * (1 - at);
    const size = on.radius * lerp(MASK.size, 1, at) * (1 + BURST.swell * swell);
    sprite.scale.set(size / FACE_RADIUS);
    sprite.alpha = frame.calm ? slide : 1;
    flare.visible = swell > 0;
    if (flare.visible) {
      placeFlare(on, POP.flare * swell);
    }
  }

  function placeFlare(on: Bursting, alpha: number): void {
    flare.visible = true;
    flare.position.set(on.to.x, on.to.y);
    flare.scale.set((on.radius * POP.reach) / halo.radius);
    flare.alpha = alpha;
    setTint(flare, UNTINTED);
  }

  // A soft white, a ring and a few sparks of neon.
  function pop(on: Bursting, share: number, frame: Frame): void {
    placeFlare(on, POP.glow * (1 - share) * (frame.calm ? 0.5 : 1));
    if (frame.calm) {
      return;
    }
    const spread = smoothstep(share);
    const { x, y } = on.to;
    sparks
      .circle(x, y, on.radius * (POP.ring + POP.ringGrow * spread))
      .stroke({ color: frame.palette.texte, alpha: POP.ringAlpha * (1 - share), width: 1.5 });
    for (let spark = 0; spark < SPARK.count; spark += 1) {
      const angle = (spark * TAU) / SPARK.count + SPARK.turn;
      const reach = on.radius * (SPARK.from + SPARK.travel * spread);
      sparks
        .circle(
          x + Math.cos(angle) * reach,
          y + Math.sin(angle) * reach,
          on.radius * (SPARK.size * (1 - share) + SPARK.end),
        )
        .fill({ color: spark % 2 === 0 ? TURQUOISE : MAGENTA, alpha: 1 - share });
    }
  }

  return {
    place(path, frame, looks, ground): void {
      const beats = (frame.now - path.since) / frame.tempo.ticksPerBeat;
      const rest = maskAt(path, frame);
      const loose = smoothstep(clamp01(beats / FALL.looseBeats));
      const fall = clamp01((beats - FALL.looseBeats) / (FALL.landBeats - FALL.looseBeats));
      const eased = smoothstep(fall);
      show(looks.masks[tubesOut(beats)], fall >= 1);
      sprite.position.set(lerp(path.x, rest.x, eased), lerp(path.y, rest.y, fall * fall));
      sprite.rotation = -0.18 * loose * (1 - fall) + FALL.turn * eased;
      const size = path.radius * lerp(1 + 0.06 * loose, MASK.size, eased);
      sprite.scale.set(size / FACE_RADIUS);
      sprite.alpha = 1;
      if (fall >= 1) {
        ground
          .ellipse(sprite.x + 2, sprite.y + 3, size, size * 1.1)
          .fill({ color: SHADOW.color, alpha: SHADOW.alpha });
      }
    },
    burst(path, frame): void {
      bursting = {
        start: frame.now,
        from: maskAt(path, frame),
        to: { x: path.x, y: path.y - path.radius * BURST.face },
        radius: path.radius,
      };
    },
    update(frame, looks): Burst | null {
      sparks.clear();
      flare.visible = false;
      if (bursting === null || looks === undefined) {
        return null;
      }
      const burst = burstAt((frame.now - bursting.start) / frame.tempo.ticksPerBeat, frame.calm);
      if (burst === null) {
        bursting = null;
      } else if (burst.pop === null) {
        placeOn(bursting, burst, frame, looks);
      } else {
        sprite.visible = false;
        pop(bursting, burst.pop, frame);
      }
      return burst;
    },
    hide(): void {
      sprite.visible = false;
    },
    reset(): void {
      bursting = null;
      sprite.visible = false;
      flare.visible = false;
      sparks.clear();
    },
  };
}
