import { Graphics } from 'pixi.js';
import type { SimState } from '../sim/state';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { DOME_FACETS, type Facet } from './textures';
import { add, placeOutline, setTint } from './util';
import {
  SEGMENTS,
  drawSegments,
  litSegments,
  litShare,
  percentText,
  placeLabel,
  stageColor,
} from './vu-meter';

const TAU = Math.PI * 2;
const FLASH_TICKS = TICKS_PER_BEAT / 2;
const FADE_TICKS = TICKS_PER_BEAT;
const RAY_TURN_TICKS = TICKS_PER_BAR * 4;
const RING_REACH = 1.12;
const SEGMENT_WIDTH = 6;
const RIM_GROW = 2;
const LABEL_GAP = 4;
const MAX_SWELL = 1.05;
const PERCENT_SIZE = 1.3;
const BLINK_TICKS = 2 * TICKS_PER_BEAT;
const BLINK_PERIOD = TICKS_PER_BEAT / 2;
const RAYS = 8;
export const LIT_FACETS = 3;

function scramble(value: number): number {
  let bits = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  bits = Math.imul(bits ^ (bits >>> 16), 0x45d9f3b);
  return (bits ^ (bits >>> 16)) >>> 0;
}

export function litFacets(beat: number): Facet[] {
  const lit: Facet[] = [];
  const seed = scramble(beat);
  for (let draw = 0; lit.length < LIT_FACETS; draw += 1) {
    const facet = DOME_FACETS[scramble(seed + draw) % DOME_FACETS.length];
    if (facet !== undefined && !lit.includes(facet)) {
      lit.push(facet);
    }
  }
  return lit;
}

function drawFacets(facets: Graphics, beat: number): void {
  facets.clear();
  for (const facet of litFacets(beat)) {
    facets.poly(facet.flat());
  }
  facets.fill(0xffffff);
}

export interface CoreFamily extends Family {
  readonly lit: number;
}

// Two blinks per beat at most, under the three flashes a second of WCAG 2.3.1.
export function lostSegmentShown(sinceLoss: number, calm: boolean): boolean {
  return (
    !calm &&
    sinceLoss >= 0 &&
    sinceLoss < BLINK_TICKS &&
    Math.floor(sinceLoss / BLINK_PERIOD) % 2 === 0
  );
}

export function createCore(ctx: RenderContext): CoreFamily {
  const { textures: t, layers } = ctx;
  const rays = Array.from({ length: RAYS }, () => add(layers.glow, t.coreRay, 0));
  const halo = add(layers.glow, t.halo);
  const outline = add(layers.core, t.core);
  const body = add(layers.core, t.core);
  const facets = new Graphics();
  layers.core.addChild(facets);
  const track = new Graphics();
  const rim = new Graphics();
  const lit = new Graphics();
  const lost = new Graphics();
  layers.core.addChild(track, rim, lit, lost);
  const rings = [track, rim, lit, lost];
  const percent = { edge: add(layers.core, t.halo), fill: add(layers.core, t.halo) };
  const flash = add(layers.fx, t.ring);
  flash.visible = false;
  outline.visible = false;

  let segments = 0;
  let facetBeat = Number.NaN;
  let drawn = { radius: Number.NaN, segments: Number.NaN };
  let loss = { from: 0, to: 0, tick: Number.NEGATIVE_INFINITY };

  function drawFlash(radius: number, x: number, y: number, frame: Frame): void {
    const progress = (frame.now - frame.flashTick) / (frame.calm ? FADE_TICKS : FLASH_TICKS);
    flash.visible = progress >= 0 && progress < 1;
    if (!flash.visible) {
      return;
    }
    flash.position.set(x, y);
    const reach = frame.calm ? 1.15 : 1.05 + 0.75 * (1 - (1 - progress) * (1 - progress));
    flash.scale.set((radius * reach) / t.ring.radius);
    flash.alpha = frame.calm ? 0.6 * Math.sin(progress * Math.PI) : (1 - progress) * (1 - progress);
  }

  return {
    get lit() {
      return segments;
    },
    update(state: SimState, _alpha: number, frame: Frame): void {
      const { core } = state;
      const { pulse, palette, light } = frame;
      segments = litSegments(core);
      const ringRadius = core.radius * RING_REACH;
      if (drawn.radius !== ringRadius || drawn.segments !== segments) {
        if (segments < drawn.segments) {
          loss = { from: segments, to: drawn.segments, tick: frame.now };
        } else if (segments > drawn.segments) {
          loss = { from: 0, to: 0, tick: Number.NEGATIVE_INFINITY };
        }
        drawn = { radius: ringRadius, segments };
        drawSegments(track, ringRadius, 0, SEGMENTS, SEGMENT_WIDTH);
        drawSegments(lit, ringRadius, 0, segments, SEGMENT_WIDTH);
        drawSegments(rim, ringRadius, 0, segments, SEGMENT_WIDTH + RIM_GROW);
        drawSegments(lost, ringRadius, loss.from, loss.to, SEGMENT_WIDTH);
      }
      const color = stageColor(palette, litShare(core));
      const swell = 1 + (MAX_SWELL - 1) * pulse;
      for (const ring of rings) {
        ring.position.set(core.x, core.y);
        ring.scale.set(swell);
      }
      setTint(track, color);
      setTint(lit, color);
      setTint(lost, color);
      setTint(rim, palette.texte);
      track.alpha = 0.2;
      lit.alpha = 0.75 + 0.25 * pulse;
      rim.visible = !light.additive && segments > 0;
      lost.visible = lostSegmentShown(frame.now - loss.tick, frame.calm);

      const below = core.y + ringRadius * MAX_SWELL + (SEGMENT_WIDTH + RIM_GROW) / 2;
      const size = 1 / frame.camera.scale;
      placeLabel(
        t,
        percent,
        percentText(core),
        palette.texte,
        core.x,
        below + LABEL_GAP * size,
        PERCENT_SIZE * size,
        frame,
      );

      body.position.set(core.x, core.y);
      body.scale.set((core.radius / t.core.radius) * swell);
      setTint(body, color);
      placeOutline(outline, body, t.core.texture, t.core.radius, frame);

      facets.visible = !frame.calm;
      if (facets.visible && facetBeat !== state.set.beat) {
        facetBeat = state.set.beat;
        drawFacets(facets, facetBeat);
      }
      facets.position.copyFrom(body.position);
      facets.scale.copyFrom(body.scale);
      setTint(facets, color);
      facets.alpha = 0.25 + 0.35 * pulse;

      setTint(halo, color);
      halo.position.set(core.x, core.y);
      halo.scale.set(((core.radius * 3.4) / t.halo.radius) * (1 + 0.3 * pulse));
      halo.alpha = (0.55 + 0.45 * pulse) * light.haloAlpha;

      let turn = frame.calm ? 0 : (frame.now / RAY_TURN_TICKS) * TAU;
      for (const ray of rays) {
        setTint(ray, color);
        ray.position.set(core.x, core.y);
        ray.rotation = turn;
        ray.scale.set((core.radius * 9) / 256, (core.radius * 1.1) / 32);
        ray.alpha = (0.16 + 0.22 * pulse) * light.haloAlpha;
        turn += TAU / RAYS;
      }

      setTint(flash, palette.or);
      drawFlash(core.radius, core.x, core.y, frame);
    },
    destroy(): void {
      layers.core.destroy({ children: true });
    },
  };
}
