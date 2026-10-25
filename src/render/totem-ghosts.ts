import type { Sprite } from 'pixi.js';
import { clamp01 } from '../shared/scalar';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { TOTEM_FOOT } from './textures-totem';
import { add, hide, setTint } from './util';

const NO_TINT = 0xffffff;
// Beats for the body to dissolve from the top down, then for its speaker to go.
const DISSOLVE_BEATS = 0.85;
const CONE_BEATS = 0.3;
const SPARK_BEATS = 0.9;
// The fireflies leave the seam spread across the totem, in texture units.
const SPARK_SPREAD = [-9, 6, -3, 10, -7, 3] as const;
const SPARK_RISE = 56;
const TOP = -108;
const BOTTOM = 4;

interface Ghost {
  start: number;
  x: number;
  y: number;
  k: number;
  readonly cone: Sprite;
  readonly body: Sprite;
  readonly sparks: readonly Sprite[];
}

// A totem that left the ground, replaced or run out: it dissolves from the top down into a few
// gold fireflies that rise and fade, its speaker last (review of 2026-10-25).
export class TotemGhosts {
  private readonly ghosts: Ghost[] = [];
  private readonly ctx: RenderContext;
  private readonly capacity: number;
  private next = 0;

  constructor(ctx: RenderContext, capacity: number) {
    this.ctx = ctx;
    this.capacity = capacity;
  }

  spawn(x: number, y: number, k: number, now: number): void {
    const ghost =
      this.ghosts.length < this.capacity ? this.make() : this.ghosts[this.next % this.capacity];
    if (ghost === undefined) {
      return;
    }
    this.next = (this.next + 1) % this.capacity;
    ghost.start = now;
    ghost.x = x;
    ghost.y = y;
    ghost.k = k;
  }

  private make(): Ghost {
    const { textures: t, layers } = this.ctx;
    const totem = t.weapons.totem;
    const cone = add(layers.speakers, totem.cone);
    const body = add(layers.speakers, totem.body);
    body.anchor.set(0.5, (body.texture.height / 2 + TOTEM_FOOT) / body.texture.height);
    const ghost: Ghost = {
      start: -Infinity,
      x: 0,
      y: 0,
      k: 1,
      cone,
      body,
      sparks: SPARK_SPREAD.map(() => add(layers.glow, t.halo)),
    };
    this.ghosts.push(ghost);
    return ghost;
  }

  update(frame: Frame): void {
    const beat = frame.tempo.ticksPerBeat;
    for (const ghost of this.ghosts) {
      const beats = (frame.now - ghost.start) / beat;
      const { cone, body, sparks } = ghost;
      if (beats < 0 || beats >= DISSOLVE_BEATS + CONE_BEATS) {
        hide(cone, body);
        for (const spark of sparks) {
          spark.visible = false;
        }
        continue;
      }
      const share = beats / DISSOLVE_BEATS;
      const { body: whole, dissolve } = this.ctx.textures.weapons.totem;
      const step = Math.floor(share * (dissolve.length + 1));
      body.visible = share < 1;
      body.texture = (step === 0 ? whole : (dissolve[step - 1] ?? whole)).texture;
      setTint(body, NO_TINT);
      body.position.set(ghost.x, ghost.y);
      body.scale.set(ghost.k);
      cone.visible = true;
      setTint(cone, NO_TINT);
      cone.position.set(ghost.x, ghost.y);
      cone.scale.set(ghost.k);
      cone.alpha = 1 - clamp01((beats - DISSOLVE_BEATS) / CONE_BEATS);
      this.fireflies(ghost, beats, frame);
    }
  }

  private fireflies(ghost: Ghost, beats: number, frame: Frame): void {
    ghost.sparks.forEach((spark, index) => {
      const born = (index / SPARK_SPREAD.length) * DISSOLVE_BEATS;
      const life = (beats - born) / SPARK_BEATS;
      spark.visible = !frame.calm && life > 0 && life < 1;
      if (!spark.visible) {
        return;
      }
      const seam = TOP + (born / DISSOLVE_BEATS) * (BOTTOM - TOP);
      const drift = Math.sin(life * Math.PI + index) * 3;
      spark.position.set(
        ghost.x + ((SPARK_SPREAD[index] ?? 0) + drift) * ghost.k,
        ghost.y + (seam - SPARK_RISE * life) * ghost.k,
      );
      spark.scale.set((8 * ghost.k) / this.ctx.textures.halo.radius);
      setTint(spark, frame.palette.noyau);
      spark.alpha = Math.sin(life * Math.PI) * frame.light.haloAlpha;
    });
  }
}
