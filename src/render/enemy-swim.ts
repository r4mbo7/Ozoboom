import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { clamp01, frac, lerp, smoothstep } from '../shared/scalar';
import { ticksIntoBeat } from '../shared/tempo';
import { type Shore, shoreAt, shoreOf } from '../sim/shore';
import type { SimState } from '../sim/state';
import { cutAt, uncut } from './crop';
import type { Frame } from './frame';
import { lakeTint } from './ground-water';
import { mixColor } from './palette';
import { type Shape, paint } from './paint';
import { setTint } from './util';

const WHITE = 0xffffff;
// In radii: from a little before the shore to where a bad vibe swims fully.
const WADE = { from: -0.3, to: 1.3 } as const;
// In radii below the centre: the waterline from the first step in to swimming.
const WATERLINE = { shallow: 1.2, deep: 0.1 } as const;
const AFLOAT = 0.02;
const GHOST_ALPHA = 0.3;
const DEEP_MIX = 0.5;
const FOAM_MIX = 0.6;
const RIPPLE = { width: 1.2, height: 0.08, waves: 3, stroke: 0.12, points: 10 } as const;
const WAKE = { radius: 32, side: 0.95, length: 2.8, spread: 0.36, stroke: 0.14, alpha: 0.7 };
const RING = { from: 1.2, grow: 1.1, flat: 0.62, alpha: 0.7 } as const;
const DRIPS = { count: 4, beats: 2, rate: 0.7, radius: 0.16, fall: 1 } as const;
const WAKE_FULL_STEP = 1;

interface Afloat {
  readonly ghost: Sprite;
  readonly wake: Sprite;
  readonly ring: Sprite;
}

export interface Swimmer {
  afloat: Afloat | null;
  wetAt: number;
}

interface SwimPose {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly heading: number;
}

export interface SwimmingView extends SwimPose {
  readonly sprite: Sprite;
  readonly swimmer: Swimmer;
}

export const dryLand = (): Swimmer => ({ afloat: null, wetAt: Number.NEGATIVE_INFINITY });

export function swimDepth(inside: number, radius: number): number {
  return smoothstep(clamp01((inside / radius - WADE.from) / (WADE.to - WADE.from)));
}

export function paintWake(): Shape {
  const { radius, side, length, spread, stroke } = WAKE;
  const start = side * radius;
  const reach = length * radius;
  const open = reach * Math.tan(spread);
  const height = 2 * Math.ceil(start + open + stroke * radius);
  return paint(reach, height, radius, (ctx) => {
    const gradient = ctx.createLinearGradient(-reach / 2, 0, reach / 2, 0);
    gradient.addColorStop(0, 'rgb(255 255 255 / 1)');
    gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = stroke * radius;
    ctx.lineCap = 'round';
    for (const way of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-reach / 2, way * start);
      ctx.quadraticCurveTo(0, way * (start + open * 0.4), reach / 2, way * (start + open));
      ctx.stroke();
    }
  });
}

export function createSwim({ ring, wake }: { readonly ring: Shape; readonly wake: Shape }) {
  const under = new Container();
  const over = new Container();
  const ripples = new Container();
  const ghosts = new Container();
  under.addChild(ripples, ghosts);
  const foam = new Graphics();
  over.addChild(foam);
  let shore: Shore | null = null;
  let shoreKey = '';
  let foamColor = WHITE;
  let deepColor = WHITE;

  function float(): Afloat {
    return {
      ghost: ghosts.addChild(new Sprite({ anchor: 0.5 })),
      wake: ripples.addChild(new Sprite({ texture: wake.texture, anchor: { x: 0, y: 0.5 } })),
      ring: ripples.addChild(new Sprite({ texture: ring.texture, anchor: 0.5 })),
    };
  }

  function sink(sprite: Sprite, full: Texture, ghost: Sprite, pose: SwimPose, depth: number) {
    sprite.rotation *= 1 - depth;
    const { height } = full.frame;
    const scale = sprite.scale.y;
    const below = lerp(WATERLINE.shallow, WATERLINE.deep, depth) * pose.radius;
    const share = cutAt(sprite, full, 0.5 + below / (scale * height), 'above');
    cutAt(ghost, full, share, 'below');
    ghost.position.copyFrom(sprite.position);
    ghost.scale.copyFrom(sprite.scale);
    ghost.rotation = sprite.rotation;
    setTint(ghost, deepColor);
    ghost.alpha = GHOST_ALPHA * depth;
    return (share - 0.5) * height * scale;
  }

  function trail(sprite: Sprite, pose: SwimPose, step: number, line: number, depth: number) {
    const size = pose.radius / wake.radius;
    sprite.position.set(pose.x, pose.y + line * 0.6);
    sprite.rotation = pose.heading + Math.PI;
    sprite.scale.set(size * clamp01(step / WAKE_FULL_STEP), size);
    setTint(sprite, foamColor);
    sprite.alpha = WAKE.alpha * depth;
  }

  function swell(sprite: Sprite, pose: SwimPose, line: number, depth: number, frame: Frame) {
    const beat = ticksIntoBeat(frame.now, frame.tempo) / frame.tempo.ticksPerBeat;
    sprite.visible = !frame.calm;
    const across = ((RING.from + RING.grow * beat) * pose.radius) / ring.radius;
    sprite.position.set(pose.x, pose.y + line);
    sprite.scale.set(across, across * RING.flat);
    setTint(sprite, foamColor);
    sprite.alpha = RING.alpha * depth * (1 - beat);
  }

  function ripple(pose: SwimPose, line: number, depth: number, frame: Frame): void {
    const { x, y, radius } = pose;
    const phase = frame.calm ? 0 : (frame.now / frame.tempo.ticksPerBeat) * Math.PI;
    const half = RIPPLE.width * radius;
    for (let point = 0; point <= RIPPLE.points; point += 1) {
      const u = (2 * point) / RIPPLE.points - 1;
      const wave = RIPPLE.height * radius * depth * Math.sin(u * RIPPLE.waves + phase);
      foam[point === 0 ? 'moveTo' : 'lineTo'](x + u * half, y + line + wave);
    }
    foam.stroke({ width: RIPPLE.stroke * radius, color: foamColor, alpha: depth, cap: 'round' });
  }

  function drip(pose: SwimPose, swimmer: Swimmer, frame: Frame): void {
    const wet = 1 - (frame.now - swimmer.wetAt) / (DRIPS.beats * frame.tempo.ticksPerBeat);
    if (frame.calm || wet <= 0 || wet >= 1) {
      return;
    }
    const { x, y, radius } = pose;
    const beats = frame.now / frame.tempo.ticksPerBeat;
    for (let index = 0; index < DRIPS.count; index += 1) {
      const fall = frac(beats * DRIPS.rate + index * 0.27);
      const side = index % 2 === 0 ? -1 : 1;
      const high = index > 1;
      foam
        .circle(
          x + side * radius * (high ? 1.12 : 0.98),
          y + radius * (high ? -0.1 : 0.45) + fall * DRIPS.fall * radius,
          DRIPS.radius * radius * (1 - 0.3 * fall),
        )
        .fill({ color: foamColor, alpha: wet * (1 - fall * fall) });
    }
  }

  function hide(swimmer: Swimmer): void {
    const { afloat } = swimmer;
    if (afloat !== null) {
      afloat.ghost.visible = afloat.wake.visible = afloat.ring.visible = false;
    }
  }

  function dry({ sprite, swimmer }: SwimmingView, full: Texture): void {
    uncut(sprite, full);
    hide(swimmer);
  }

  return {
    under,
    over,
    dry,
    begin(state: SimState, frame: Frame): void {
      const { set, palette } = frame;
      const key = `${set.id}:${String(state.seed)}`;
      if (key !== shoreKey) {
        shoreKey = key;
        shore = shoreOf(set, state.seed);
      }
      foam.clear();
      deepColor = mixColor(lakeTint(palette), palette.sol, DEEP_MIX);
      foamColor = mixColor(palette.turquoise, WHITE, FOAM_MIX);
    },
    swim(pose: SwimmingView, full: Texture, step: number, frame: Frame): number | null {
      const { sprite, swimmer } = pose;
      const inside = shore === null ? Number.NEGATIVE_INFINITY : shoreAt(shore, pose.y) - pose.x;
      const depth = swimDepth(inside, pose.radius);
      if (depth < AFLOAT) {
        drip(pose, swimmer, frame);
        dry(pose, full);
        return null;
      }
      swimmer.wetAt = frame.now;
      const afloat = (swimmer.afloat ??= float());
      afloat.ghost.visible = afloat.wake.visible = true;
      const line = sink(sprite, full, afloat.ghost, pose, depth);
      trail(afloat.wake, pose, step, line, depth);
      swell(afloat.ring, pose, line, depth, frame);
      ripple(pose, line, depth, frame);
      return line;
    },
    forget(swimmer: Swimmer): void {
      swimmer.wetAt = Number.NEGATIVE_INFINITY;
      hide(swimmer);
    },
  };
}
