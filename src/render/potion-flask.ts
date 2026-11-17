import type { Graphics, Sprite } from 'pixi.js';
import { clamp, clamp01, frac, lerp, smoothstep } from '../shared/scalar';
import { placeHalo } from './bonus-marks';
import type { Frame } from './frame';
import { WHITE, mixColor } from './palette';
import type { Textures } from './textures';
import { POTION_BELLY } from './textures-potion';
import { hide, placeOutline } from './util';

// The flask's own colours, never the hour's.
export const MAGENTA = 0xff3fd0;
export const TURQUOISE = 0x2ef2e6;
export const ACID = 0xa8ff2e;
const VIOLET = 0x9a5bff;
export const GOLD = 0xffc83a;
const BANDS = [MAGENTA, TURQUOISE, ACID, VIOLET, GOLD] as const;
const INK = 0x1b0838;
// In the flask's units, from the belly's centre.
const LIQUID = { surface: -5.2, band: 3.4, beats: 2.2, tilt: 0.16, step: 1 } as const;
const NECK_TOP = -13.5;
const HUE = { beats: 2, blend: 0.25 } as const;
const GLOW = { radius: 24, rest: 0.7, beat: 0.3 } as const;

export interface FlaskView {
  readonly glow: Sprite;
  readonly outline: Sprite;
  readonly glass: Sprite;
  readonly liquid: Graphics;
  readonly shine: Sprite;
  readonly bubbles: Graphics;
}

export function flaskHueAt(beats: number, calm: boolean): number {
  if (calm) {
    return MAGENTA;
  }
  const turn = beats / HUE.beats;
  const index = Math.floor(turn);
  const from = BANDS[index % BANDS.length] ?? MAGENTA;
  const to = BANDS[(index + 1) % BANDS.length] ?? MAGENTA;
  return mixColor(from, to, smoothstep(clamp01((frac(turn) - 1 + HUE.blend) / HUE.blend)));
}

function surfaceAt(x: number, beats: number): number {
  return LIQUID.surface + 0.7 * Math.sin(x * 0.45 - beats * 2.4);
}

function drawLiquid(liquid: Graphics, beats: number): void {
  const r = POTION_BELLY.radius;
  const rise = beats / LIQUID.beats;
  const first = Math.floor(rise);
  const risen = rise - first;
  liquid.clear();
  for (let band = -1; band <= 6; band += 1) {
    for (let x = -r; x <= r; x += LIQUID.step) {
      const half = Math.sqrt(Math.max(0, r * r - x * x));
      const line =
        LIQUID.surface +
        1.2 +
        (band - risen) * LIQUID.band +
        0.9 * Math.sin(x * 0.55 + beats * 1.6 + band * 1.3);
      const top = clamp(Math.max(line, surfaceAt(x, beats)), -half, half);
      if (x === -r) {
        liquid.moveTo(x, top);
      } else {
        liquid.lineTo(x, top);
      }
    }
    for (let x = r; x >= -r; x -= LIQUID.step) {
      liquid.lineTo(x, Math.sqrt(Math.max(0, r * r - x * x)));
    }
    liquid.closePath().fill(BANDS[(((band + first) % 5) + 5) % 5] ?? MAGENTA);
  }
  const reach = Math.sqrt(r * r - LIQUID.surface * LIQUID.surface) - 1;
  for (let x = -reach; x <= reach; x += LIQUID.step) {
    if (x === -reach) {
      liquid.moveTo(x, surfaceAt(x, beats));
    } else {
      liquid.lineTo(x, surfaceAt(x, beats));
    }
  }
  liquid.stroke({ width: 0.7, color: 0xfffaeb, alpha: 0.8 });
  for (let i = 0; i < 3; i += 1) {
    const rose = frac(beats / 2 + i / 3);
    const x = (i - 1) * 5 + 0.8 * Math.sin(beats * 2 + i);
    liquid.circle(x, lerp(10, LIQUID.surface, rose), 0.7).fill({ color: WHITE, alpha: 0.7 });
  }
}

function drawBubbles(bubbles: Graphics, beats: number): void {
  bubbles.clear();
  for (let i = 0; i < 3; i += 1) {
    const rose = frac(beats / 3 + i / 3);
    const color = BANDS[i] ?? MAGENTA;
    const x = (i - 1) * 2.6 + 1.6 * Math.sin(beats * 2.2 + i * 2);
    const y = NECK_TOP - 4.5 - 8 * rose;
    if (rose < 0.82) {
      bubbles
        .circle(x, y, 0.9 + 0.7 * rose)
        .fill({ color, alpha: smoothstep(clamp01(rose / 0.15)) })
        .stroke({ width: 0.35, color: INK, alpha: smoothstep(clamp01(rose / 0.15)) });
    } else {
      const popped = (rose - 0.82) / 0.18;
      bubbles.circle(x, y, 1.5 + 1.1 * popped).stroke({ width: 0.5, color, alpha: 1 - popped });
    }
  }
}

export function hideFlask(view: FlaskView): void {
  hide(view.glow, view.outline, view.glass, view.shine);
  view.liquid.visible = false;
  view.bubbles.visible = false;
}

export function placeFlask(
  t: Pick<Textures, 'halo' | 'potion'>,
  view: FlaskView,
  x: number,
  y: number,
  width: number,
  beats: number,
  frame: Frame,
  alpha = 1,
): void {
  const { glow, outline, glass, liquid, shine, bubbles } = view;
  const scale = width / (2 * t.potion.radius);
  const bellyY = y + POTION_BELLY.y * scale;
  for (const sprite of [glass, shine]) {
    sprite.visible = true;
    sprite.position.set(x, y);
    sprite.scale.set(scale);
    sprite.alpha = alpha;
  }
  placeOutline(outline, glass, t.potion.texture, t.potion.radius, frame);
  liquid.visible = true;
  liquid.position.set(x, bellyY);
  liquid.scale.set(scale);
  liquid.rotation = LIQUID.tilt * Math.sin(beats * Math.PI);
  liquid.alpha = alpha;
  drawLiquid(liquid, beats);
  bubbles.visible = true;
  bubbles.position.set(x, y);
  bubbles.scale.set(scale);
  bubbles.alpha = alpha;
  drawBubbles(bubbles, beats);
  const beat = frame.calm ? 0 : frame.pulse;
  placeHalo(t, glow, x, bellyY, GLOW.radius * scale, flaskHueAt(beats, frame.calm));
  glow.alpha = (GLOW.rest + GLOW.beat * beat) * frame.light.haloAlpha * alpha;
}
