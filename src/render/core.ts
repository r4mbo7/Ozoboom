import { Graphics, type Sprite } from 'pixi.js';
import type { CoreState, SimState } from '../sim/state';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { NAME_TEXTURE_SCALE } from './textures-names';
import { add, placeOutline, setTint } from './util';

const TAU = Math.PI * 2;
const FLASH_TICKS = TICKS_PER_BEAT / 2;
const FADE_TICKS = TICKS_PER_BEAT;
const RAY_TURN_TICKS = TICKS_PER_BAR * 4;
const RING_START = -Math.PI / 2;
const RING_REACH = 1.12;
const SEGMENT_WIDTH = 6;
const SEGMENT_GAP = 0.28;
const RIM_GROW = 2;
const LABEL_GAP = 4;
const MAX_SWELL = 1.05;
const PERCENT_SIZE = 1.3;
const BLINK_TICKS = 2 * TICKS_PER_BEAT;
const BLINK_PERIOD = TICKS_PER_BEAT / 2;

export const SEGMENTS = 24;
export const LOW_SHARE = 0.25;
export const LOW_WARNING = 'La scène faiblit';

interface Label {
  readonly edge: Sprite;
  readonly fill: Sprite;
}

export interface CoreFamily extends Family {
  readonly lit: number;
}

export function litShare(core: Pick<CoreState, 'hp' | 'maxHp'>): number {
  return core.maxHp > 0 ? Math.min(1, Math.max(0, core.hp / core.maxHp)) : 0;
}

// A segment stays lit until its last hit point is gone: the ring is empty only once the scene is.
export function litSegments(core: Pick<CoreState, 'hp' | 'maxHp'>): number {
  return core.maxHp > 0
    ? Math.min(SEGMENTS, Math.max(0, Math.ceil((core.hp * SEGMENTS) / core.maxHp)))
    : 0;
}

export function percentOf(core: Pick<CoreState, 'hp' | 'maxHp'>): number {
  return Math.ceil(litShare(core) * 100);
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

function drawSegments(ring: Graphics, radius: number, from: number, to: number, width: number) {
  ring.clear();
  const step = TAU / SEGMENTS;
  const gap = (step * SEGMENT_GAP) / 2;
  for (let index = from; index < to; index += 1) {
    const start = RING_START + index * step + gap;
    ring.moveTo(Math.cos(start) * radius, Math.sin(start) * radius);
    ring.arc(0, 0, radius, start, start + step - 2 * gap);
    ring.stroke({ width, color: 0xffffff, cap: 'butt' });
  }
}

export function createCore(ctx: RenderContext): CoreFamily {
  const { textures: t, layers } = ctx;
  const rays = [add(layers.glow, t.coreRay, 0), add(layers.glow, t.coreRay, 0)] as const;
  const halo = add(layers.glow, t.halo);
  const outline = add(layers.core, t.core);
  const body = add(layers.core, t.core);
  const track = new Graphics();
  const rim = new Graphics();
  const lit = new Graphics();
  const lost = new Graphics();
  layers.core.addChild(track, rim, lit, lost);
  const rings = [track, rim, lit, lost];
  const percent = { edge: add(layers.core, t.halo), fill: add(layers.core, t.halo) };
  const warning = { edge: add(layers.core, t.halo), fill: add(layers.core, t.halo) };
  const flash = add(layers.fx, t.ring);
  flash.visible = false;
  outline.visible = false;

  // Below the ring, at a constant screen size like the names of the players; returns where the next line starts.
  function placeLabel(
    label: Label,
    text: string | null,
    color: number,
    x: number,
    y: number,
    frame: Frame,
    grow = 1,
  ) {
    const { edge, fill } = label;
    fill.visible = edge.visible = text !== null;
    if (text === null) {
      return y;
    }
    const { palette, light, camera } = frame;
    const texts = t.names.get(text);
    if (fill.texture !== texts.fill) {
      fill.texture = texts.fill;
      edge.texture = texts.edge;
    }
    const size = grow / (NAME_TEXTURE_SCALE * camera.scale);
    const half = (texts.fill.height * size) / 2;
    fill.position.set(x, y + half);
    edge.position.set(x, y + half);
    fill.scale.set(size);
    edge.scale.set(size);
    setTint(fill, color);
    setTint(edge, palette.sol);
    edge.alpha = light.additive ? 0.7 : 0.9;
    return y + 2 * half;
  }

  let segments = 0;
  let shown = { percent: Number.NaN, text: '' };
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
      const low = litShare(core) < LOW_SHARE;
      const color = low ? palette.mage : palette.or;
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

      const value = percentOf(core);
      if (shown.percent !== value) {
        shown = { percent: value, text: `${String(value)}\u202f%` };
      }
      const below = core.y + ringRadius * MAX_SWELL + (SEGMENT_WIDTH + RIM_GROW) / 2;
      const next = placeLabel(
        percent,
        shown.text,
        palette.texte,
        core.x,
        below + LABEL_GAP / frame.camera.scale,
        frame,
        PERCENT_SIZE,
      );
      placeLabel(warning, low ? LOW_WARNING : null, palette.mage, core.x, next, frame);

      body.position.set(core.x, core.y);
      body.scale.set((core.radius / t.core.radius) * swell);
      body.rotation = frame.calm ? 0 : (frame.now / RAY_TURN_TICKS) * TAU;
      setTint(body, palette.noyau);
      placeOutline(outline, body, t.core.texture, t.core.radius, frame);

      setTint(halo, palette.noyau);
      halo.position.set(core.x, core.y);
      halo.scale.set(((core.radius * 3.4) / t.halo.radius) * (1 + 0.3 * pulse));
      halo.alpha = (0.55 + 0.45 * pulse) * light.haloAlpha;

      let turn = frame.calm ? Math.PI / 4 : (frame.now / RAY_TURN_TICKS) * TAU;
      for (const ray of rays) {
        setTint(ray, palette.noyau);
        ray.position.set(core.x, core.y);
        ray.rotation = turn;
        ray.scale.set((core.radius * 9) / 256, (core.radius * 1.6) / 32);
        ray.alpha = (0.25 + 0.35 * pulse) * light.haloAlpha;
        turn += Math.PI;
      }

      setTint(flash, palette.or);
      drawFlash(core.radius, core.x, core.y, frame);
    },
    destroy(): void {
      layers.core.destroy({ children: true });
    },
  };
}
