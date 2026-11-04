import { Container, Graphics, Sprite } from 'pixi.js';
import { clamp, clamp01 } from '../shared/scalar';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { CoreState } from '../sim/state';
import type { Frame } from './frame';
import { type PixiPalette, mixColor } from './palette';
import type { Textures } from './textures';
import { LABEL_FONT_PX, LABEL_PAD, NAME_TEXTURE_SCALE } from './textures-names';
import { setTint } from './util';

const TAU = Math.PI * 2;
const RING_START = -Math.PI / 2;
const SEGMENT_GAP = 0.28;

export const SEGMENTS = 24;

const PILL_HEIGHT = LABEL_FONT_PX * 1.5;
const PILL_PAD = LABEL_FONT_PX * 0.55;
const PILL_BORDER = 1.6;
const PILL_POP = 0.16;
const PILL_SHAKE = 3;
const PILL_WOBBLE = 32;
const SHOWN_TICKS = 4 * TICKS_PER_BEAT;
const FADE_TICKS = TICKS_PER_BEAT / 2;
const KICK_TICKS = 0.7 * TICKS_PER_BEAT;

export interface LifePill {
  place(
    textures: Pick<Textures, 'names'>,
    core: Pick<CoreState, 'hp' | 'maxHp'>,
    x: number,
    top: number,
    size: number,
    frame: Frame,
  ): void;
}

export function litShare(core: Pick<CoreState, 'hp' | 'maxHp'>): number {
  return core.maxHp > 0 ? clamp01(core.hp / core.maxHp) : 0;
}

export function stageColor(
  palette: Pick<PixiPalette, 'healer' | 'or' | 'rouge'>,
  share: number,
): number {
  return share >= 0.5
    ? mixColor(palette.or, palette.healer, (share - 0.5) / 0.5)
    : mixColor(palette.rouge, palette.or, share / 0.5);
}

// The ring is empty only once the scene is.
export function litSegments(core: Pick<CoreState, 'hp' | 'maxHp'>): number {
  return core.maxHp > 0 ? clamp(Math.ceil((core.hp * SEGMENTS) / core.maxHp), 0, SEGMENTS) : 0;
}

export function percentOf(core: Pick<CoreState, 'hp' | 'maxHp'>): number {
  return Math.ceil(litShare(core) * 100);
}

const PERCENT_TEXTS = Array.from({ length: 101 }, (_, value) => `${String(value)}\u202f%`);

function percentText(core: Pick<CoreState, 'hp' | 'maxHp'>): string {
  return PERCENT_TEXTS[percentOf(core)] ?? '';
}

// Full, the ring says it all: the number shows on a loss, and for good under half.
function pillAlpha(share: number, sinceLoss: number): number {
  return share < 0.5 ? 1 : 1 - clamp01((sinceLoss - SHOWN_TICKS) / FADE_TICKS);
}

function pillKick(sinceLoss: number): number {
  return sinceLoss >= 0 && sinceLoss < KICK_TICKS ? 1 - sinceLoss / KICK_TICKS : 0;
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

export function createLifePill(parent: Container): LifePill {
  const root = parent.addChild(new Container());
  const back = root.addChild(new Graphics());
  const border = root.addChild(new Graphics());
  const fill = root.addChild(new Sprite());
  fill.anchor.set(0.5);
  fill.scale.set(1 / NAME_TEXTURE_SCALE);
  let width = Number.NaN;
  let segments = Number.NaN;
  let lostAt = Number.NEGATIVE_INFINITY;

  return {
    place(textures, core, x, top, size, frame): void {
      const lit = litSegments(core);
      if (lit < segments) {
        lostAt = frame.now;
      }
      segments = lit;
      const share = litShare(core);
      const sinceLoss = frame.now - lostAt;
      root.alpha = pillAlpha(share, sinceLoss);
      root.visible = root.alpha > 0;
      if (!root.visible) {
        return;
      }
      const texts = textures.names.get(percentText(core));
      if (fill.texture !== texts.fill) {
        fill.texture = texts.fill;
      }
      const textWidth = texts.fill.width / NAME_TEXTURE_SCALE - 2 * LABEL_PAD;
      if (textWidth !== width) {
        width = textWidth;
        const w = textWidth + 2 * PILL_PAD;
        back.clear().roundRect(-w / 2, -PILL_HEIGHT / 2, w, PILL_HEIGHT, PILL_HEIGHT / 2);
        back.fill(0xffffff);
        border.clear().roundRect(-w / 2, -PILL_HEIGHT / 2, w, PILL_HEIGHT, PILL_HEIGHT / 2);
        border.stroke({ width: PILL_BORDER, color: 0xffffff });
      }
      const { palette } = frame;
      const color = stageColor(palette, share);
      const kick = frame.calm ? 0 : pillKick(sinceLoss);
      setTint(back, mixColor(palette.sol, color, 0.55 * kick * kick));
      back.alpha = 0.9;
      setTint(border, color);
      setTint(fill, mixColor(color, palette.texte, 0.85 * kick));
      const shake = kick * kick * PILL_SHAKE * Math.sin(kick * PILL_WOBBLE);
      root.scale.set(size * (1 + PILL_POP * kick));
      root.position.set(x + shake * size, top + (PILL_HEIGHT / 2) * size);
    },
  };
}
