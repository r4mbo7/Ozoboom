import type { Container, Sprite } from 'pixi.js';
import type { BystanderLeaving } from '../sim/state';
import { Particles } from './effects';
import type { Frame } from './frame';
import { mixColor } from './palette';
import { MOTE_PATHS, SHARDS, smoothWithin, within } from './raver-cues';
import { CROSS_SQUARES } from './textures-raver';
import type { Textures } from './textures';
import { add, hide, placeOutline, setTint } from './util';

export type Farewell = 'helped' | BystanderLeaving;

export const MASK_RADIUS = 28;
export const MASK_SCALE = 1.25;
export const CROSS_RADIUS = 14;
export const CROSS_LIFT = 18;
const GHOSTS = 6;
const SHARD_SCALE = (8 / CROSS_RADIUS) * 1.35;
// In beats.
const LENGTH: Readonly<Record<Farewell, number>> = { helped: 2.6, timeUp: 3, badVibe: 4 };
interface Ghost {
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly cross: Sprite;
  readonly ink: Sprite;
  readonly ring: Sprite;
  readonly glow: Sprite;
  readonly heart: Sprite;
  readonly halves: readonly [Sprite, Sprite];
  readonly shards: readonly Sprite[];
  kind: Farewell;
  start: number;
  x: number;
  y: number;
  radius: number;
  active: boolean;
  motes: number; // Spawned when due: `Particles` drops one dated in the future.
}

export interface RaverFarewells {
  start(kind: Farewell, tick: number, x: number, y: number, radius: number): void;
  update(frame: Frame): void;
  reset(): void;
}

export function createRaverFarewells(
  layer: Container,
  fx: Container,
  textures: Textures,
): RaverFarewells {
  const t = textures.specials;
  const ghosts: Ghost[] = Array.from({ length: GHOSTS }, () => {
    const ink = add(layer, t.ink);
    const glow = add(layer, textures.halo);
    const ring = add(layer, textures.ring);
    return {
      ink,
      glow,
      ring,
      outline: add(layer, t.distress),
      body: add(layer, t.distress),
      cross: add(layer, t.cross),
      heart: add(fx, t.heart),
      halves: [add(fx, t.heartHalves[0]), add(fx, t.heartHalves[1])],
      shards: CROSS_SQUARES.map(() => add(fx, t.crossShard)),
      kind: 'helped',
      start: 0,
      x: 0,
      y: 0,
      radius: 11,
      active: false,
      motes: 0,
    };
  });
  const motes = new Particles(fx, t.mote, GHOSTS * MOTE_PATHS.length);
  let next = 0;

  function hideGhost(ghost: Ghost): void {
    hide(ghost.outline, ghost.body, ghost.cross, ghost.ink, ghost.ring, ghost.glow, ghost.heart);
    hide(...ghost.halves, ...ghost.shards);
  }
  ghosts.forEach(hideGhost);

  function rise(ghost: Ghost, beats: number, frame: Frame): void {
    const beat = frame.tempo.ticksPerBeat;
    const grey = mixColor(paleOf(frame), frame.palette.badVibe, 0.45);
    for (; ghost.motes < MOTE_PATHS.length; ghost.motes += 1) {
      const index = ghost.motes;
      const at = 0.9 + index * 0.12;
      const [dx, dy, height] = MOTE_PATHS[index] ?? [0, 0, 0];
      if (beats < at) {
        return;
      }
      motes.spawn({
        now: ghost.start + at * beat,
        duration: 1.6 * beat,
        x: ghost.x + dx,
        y: ghost.y + dy,
        dx: (index % 2 ? 1 : -1) * 4,
        dy: -height,
        fromRadius: 2.6,
        toRadius: 1.4,
        tint: grey,
        peak: 0.85,
      });
    }
  }

  function face(
    ghost: Ghost,
    frame: Frame,
    scale: number,
    tint: number,
    alpha: number,
    lift = 0,
  ): void {
    const { body } = ghost;
    body.visible = alpha > 0;
    setTint(body, tint);
    body.position.set(ghost.x, ghost.y - lift);
    body.scale.set(((ghost.radius * MASK_SCALE) / MASK_RADIUS) * scale);
    body.alpha = alpha;
    placeOutline(ghost.outline, body, body.texture, MASK_RADIUS, frame);
  }

  function crossAt(ghost: Ghost): number {
    return ghost.y - ghost.radius - CROSS_LIFT;
  }

  function drawHelped(ghost: Ghost, beats: number, frame: Frame): void {
    const { palette } = frame;
    ghost.body.texture = t.relieved.texture;
    const bounce = 1 + 0.16 * Math.exp(-6 * beats) * Math.abs(Math.cos(beats * Math.PI * 2));
    face(
      ghost,
      frame,
      bounce + 0.06 * smoothWithin(beats, 0, 0.5),
      paleOf(frame),
      1 - within(beats, 2, 2.6),
      4 * within(beats, 1.6, 2.6),
    );

    const opened = within(beats, 0, 1);
    ghost.ring.visible = opened < 1;
    if (opened < 1) {
      const { ring } = ghost;
      setTint(ring, palette.healer);
      ring.position.set(ghost.x, ghost.y);
      ring.scale.set((ghost.radius + 9 + 22 * smoothWithin(beats, 0, 1)) / textures.ring.radius);
      ring.alpha = 0.9 * (1 - opened);
    }

    const shown = within(beats, 0, 0.2) * (1 - within(beats, 1.9, 2.6));
    const lift = ghost.y - ghost.radius - 14 - 14 * smoothWithin(beats, 0, 2.6);
    const { heart, glow } = ghost;
    heart.visible = shown > 0;
    glow.visible = shown > 0 && !frame.calm;
    setTint(heart, palette.mage);
    heart.position.set(ghost.x, lift);
    heart.scale.set((7 + 2 * Math.exp(-5 * beats)) / t.heart.radius);
    heart.alpha = shown;
    setTint(glow, palette.mage);
    glow.position.set(ghost.x, lift);
    glow.scale.set(16 / textures.halo.radius);
    glow.alpha = 0.5 * shown;
  }

  function drawTimeUp(ghost: Ghost, beats: number, frame: Frame): void {
    const pale = paleOf(frame);
    const greyed = smoothWithin(beats, 0, 1);
    const grey = mixColor(pale, frame.palette.badVibe, 0.45);
    const gone = smoothWithin(beats, 1, 1.6);
    ghost.body.texture = t.distress.texture;
    face(ghost, frame, 1 - 0.12 * gone, mixColor(pale, grey, greyed), 1 - gone);

    const { cross } = ghost;
    const fade = 1 - smoothWithin(beats, 0.3, 1.2);
    cross.visible = fade > 0;
    cross.texture = (t.crossClock[0] ?? t.cross).texture;
    setTint(cross, mixColor(frame.palette.healer, grey, greyed));
    cross.position.set(ghost.x, crossAt(ghost));
    cross.scale.set(8 / CROSS_RADIUS);
    cross.alpha = fade;
  }

  function drawBadVibe(ghost: Ghost, beats: number, frame: Frame): void {
    const { palette } = frame;
    const { ink } = ghost;
    const spread = 1 - (1 - within(beats, 0, 0.35)) ** 3;
    ink.visible = spread > 0;
    setTint(ink, palette.badVibe);
    ink.position.set(ghost.x, ghost.y + 2);
    ink.scale.set(((ghost.radius + 13) / t.ink.radius) * spread);
    ink.alpha = 0.9 * (1 - smoothWithin(beats, 2.6, 4));

    const flash = smoothWithin(beats, 0, 0.25);
    ghost.body.texture = t.distress.texture;
    face(
      ghost,
      frame,
      1 + 0.22 * smoothWithin(beats, 0, 0.55),
      mixColor(paleOf(frame), palette.badVibe, flash),
      1 - smoothWithin(beats, 0.4, 0.55),
    );

    const { cross } = ghost;
    const red = smoothWithin(beats, 0, 0.12);
    cross.visible = beats < 0.5;
    cross.texture = t.cross.texture;
    setTint(cross, mixColor(palette.healer, palette.rouge, red));
    cross.position.set(ghost.x, crossAt(ghost));
    cross.scale.set((8 / CROSS_RADIUS) * (1 + 0.35 * red));
    cross.alpha = 1;

    const broken = within(beats, 0.5, 2.3);
    const thrown = 1 - (1 - Math.min(1, broken * 1.6)) ** 2;
    const shardAlpha = 1 - smoothWithin(broken, 0.45, 1);
    for (let index = 0; index < ghost.shards.length; index += 1) {
      const shard = ghost.shards[index];
      const [sx, sy] = CROSS_SQUARES[index] ?? [0, 0];
      const [dx, dy, spin] = SHARDS[index] ?? [0, 0, 0];
      if (shard === undefined) {
        continue;
      }
      shard.visible = broken > 0 && broken < 1;
      setTint(shard, palette.rouge);
      shard.position.set(
        ghost.x + (sx + dx * 20 * thrown) * SHARD_SCALE,
        crossAt(ghost) + (sy + dy * 12 * thrown + 34 * broken * broken) * SHARD_SCALE,
      );
      shard.rotation = spin * broken * 2.2;
      shard.scale.set(SHARD_SCALE);
      shard.alpha = shardAlpha;
    }

    const fall = within(beats, 0.55, 3.55);
    const split = smoothWithin(fall, 0.25, 0.8);
    const drop = 20 * within(fall, 0.25, 1) ** 2;
    const pop = 0.6 + 0.4 * smoothWithin(fall, 0, 0.12);
    for (let index = 0; index < ghost.halves.length; index += 1) {
      const half = ghost.halves[index];
      if (half === undefined) {
        continue;
      }
      const side = index === 0 ? -1 : 1;
      half.visible = fall > 0 && fall < 1;
      setTint(half, palette.rouge);
      half.position.set(ghost.x + side * split * 4, ghost.y + 3 + drop);
      half.rotation = side * split * 0.35;
      half.scale.set((8 / t.heart.radius) * pop);
      half.alpha = 1 - within(fall, 0.6, 1);
    }
  }

  return {
    start(kind, tick, x, y, radius) {
      const ghost = ghosts[next];
      next = (next + 1) % GHOSTS;
      if (ghost === undefined) {
        return;
      }
      hideGhost(ghost);
      Object.assign(ghost, { kind, start: tick, x, y, radius, active: true, motes: 0 });
    },
    update(frame) {
      for (const ghost of ghosts) {
        if (!ghost.active) {
          continue;
        }
        const beats = (frame.now - ghost.start) / frame.tempo.ticksPerBeat;
        if (beats < 0 || beats >= LENGTH[ghost.kind]) {
          ghost.active = false;
          hideGhost(ghost);
          continue;
        }
        if (ghost.kind === 'helped') {
          drawHelped(ghost, beats, frame);
        } else if (ghost.kind === 'timeUp') {
          drawTimeUp(ghost, beats, frame);
          rise(ghost, beats, frame);
        } else {
          drawBadVibe(ghost, beats, frame);
        }
      }
      motes.update(frame.now);
    },
    reset() {
      motes.clear();
      for (const ghost of ghosts) {
        ghost.active = false;
        hideGhost(ghost);
      }
    },
  };
}

export function paleOf(frame: Frame): number {
  return frame.light.additive ? frame.palette.texte : frame.palette.solClair;
}
