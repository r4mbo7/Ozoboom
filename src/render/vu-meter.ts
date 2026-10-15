import type { Graphics, Sprite } from 'pixi.js';
import type { CoreState } from '../sim/state';
import type { Frame } from './frame';
import { mixColor } from './ground-sun';
import type { PixiPalette } from './palette';
import type { Textures } from './textures';
import { NAME_TEXTURE_SCALE } from './textures-names';
import { setTint } from './util';

const TAU = Math.PI * 2;
const RING_START = -Math.PI / 2;
const SEGMENT_GAP = 0.28;

export const SEGMENTS = 24;

export interface Label {
  readonly edge: Sprite;
  readonly fill: Sprite;
}

export function litShare(core: Pick<CoreState, 'hp' | 'maxHp'>): number {
  return core.maxHp > 0 ? Math.min(1, Math.max(0, core.hp / core.maxHp)) : 0;
}

export function stageColor(
  palette: Pick<PixiPalette, 'healer' | 'or' | 'rouge'>,
  share: number,
): number {
  return share >= 0.5
    ? mixColor(palette.or, palette.healer, (share - 0.5) / 0.5)
    : mixColor(palette.rouge, palette.or, share / 0.5);
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

const PERCENT_TEXTS = Array.from({ length: 101 }, (_, value) => `${String(value)}\u202f%`);

export function percentText(core: Pick<CoreState, 'hp' | 'maxHp'>): string {
  return PERCENT_TEXTS[percentOf(core)] ?? '';
}

export function drawSegments(
  ring: Graphics,
  radius: number,
  from: number,
  to: number,
  width: number,
): void {
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

// A line of text centered on x, its top at y, `size` world units per texture pixel; returns where the next line starts.
export function placeLabel(
  textures: Textures,
  label: Label,
  text: string | null,
  color: number,
  x: number,
  y: number,
  size: number,
  frame: Frame,
): number {
  const { edge, fill } = label;
  fill.visible = edge.visible = text !== null;
  if (text === null) {
    return y;
  }
  const texts = textures.names.get(text);
  if (fill.texture !== texts.fill) {
    fill.texture = texts.fill;
    edge.texture = texts.edge;
  }
  const scale = size / NAME_TEXTURE_SCALE;
  const half = (texts.fill.height * scale) / 2;
  fill.position.set(x, y + half);
  edge.position.set(x, y + half);
  fill.scale.set(scale);
  edge.scale.set(scale);
  setTint(fill, color);
  setTint(edge, frame.palette.sol);
  edge.alpha = frame.light.additive ? 0.7 : 0.9;
  return y + 2 * half;
}
