import { clamp01, frac, smoothstep } from '../../shared/scalar';
import {
  BODY_FONT,
  type NameGap,
  POSTER_WIDTH,
  type Pen,
  type PosterWords,
  TAU,
  TITLE_FONT,
  rgba,
  rng,
} from './pen';

const CREAM = '#fbeee0';
const W = POSTER_WIDTH;
// The widest a line of the poster's type prints, inside its frame.
const LINE = 280;

// Rays from the emblem, every other wedge lit, fading with distance, turned by `turn` wedge pairs.
export function sunRays(
  p: Pen,
  cx: number,
  cy: number,
  n: number,
  color: string,
  a: number,
  turn: number,
): void {
  const rotation = -Math.PI / 2 + turn * ((2 * TAU) / n);
  const light = p.g.createRadialGradient(cx, cy, 0, cx, cy, 300);
  light.addColorStop(0, rgba(color, a));
  light.addColorStop(0.45, rgba(color, a * 0.6));
  light.addColorStop(1, rgba(color, a * 0.25));
  p.g.fillStyle = light;
  p.g.beginPath();
  for (let i = 0; i < n; i += 2) {
    const a0 = rotation + (i * TAU) / n;
    const a1 = a0 + TAU / n;
    p.g.moveTo(cx, cy);
    p.g.lineTo(cx + Math.cos(a0) * 420, cy + Math.sin(a0) * 420);
    p.g.lineTo(cx + Math.cos(a1) * 420, cy + Math.sin(a1) * 420);
    p.g.closePath();
  }
  p.g.fill();
}

// Hairline circles around the emblem, each a radius, a colour and an opacity, and one ring that
// leaves the emblem from `r0` on each beat.
export function sunHalos(
  p: Pen,
  cx: number,
  cy: number,
  circles: readonly (readonly [number, string, number])[],
  beat: number,
  r0: number,
  color: string,
): void {
  for (const [r, c, a] of circles) {
    p.alpha(a, () => {
      p.circ(cx, cy, r, null, c, 0.5);
    });
  }
  const k = frac(beat);
  p.alpha(0.45 * (1 - k) * (1 - k), () => {
    p.circ(cx, cy, r0 + 46 * smoothstep(clamp01(k)), null, color, 0.7);
  });
}

// A hairline frame along the screen's edges, a diamond in each corner.
export function sunFrame(p: Pen, color: string): void {
  const { left, top, right, bottom } = p.view.screen;
  p.alpha(0.7, () => {
    p.g.strokeStyle = color;
    p.g.lineWidth = 0.5;
    p.g.strokeRect(left + 6, top + 6, right - left - 12, bottom - top - 12);
  });
  for (const [x, y] of [
    [left + 6, top + 6],
    [right - 6, top + 6],
    [left + 6, bottom - 6],
    [right - 6, bottom - 6],
  ] as const) {
    p.lozenge(x, y, 2.4, 2.4, color);
  }
}

// Spaced capitals centred on the poster, a dark glow behind them.
function spaced(
  p: Pen,
  text: string,
  y: number,
  size: number,
  weight: number,
  color: string,
  spacing: number,
  shade: string,
): void {
  const lettering = p.letter(text, weight, size, BODY_FONT, spacing, LINE);
  p.g.save();
  p.g.shadowColor = shade;
  p.g.shadowBlur = 5 * p.view.scale;
  p.print(text, lettering, W / 2, y, color);
  p.g.restore();
}

export interface SunType {
  readonly gold: string;
  readonly stage: string;
  readonly glow: string;
  readonly shade?: string;
  readonly aka?: string;
}

// The poster's type: the track, a rule with a diamond, the artist large with a glow, aka, the stage.
export function sunTexts(p: Pen, words: PosterWords, type: SunType): NameGap {
  const shade = type.shade ?? 'rgba(8,4,20,.55)';
  spaced(p, words.track.toUpperCase(), 31, 8.6, 700, type.gold, 3.4, shade);
  p.alpha(0.75, () => {
    p.seg(W / 2 - 44, 41, W / 2 - 9, 41, type.gold, 0.45);
    p.seg(W / 2 + 9, 41, W / 2 + 44, 41, type.gold, 0.45);
  });
  p.lozenge(W / 2, 41, 2.4, 2.4, type.gold);
  const first = words.first.toUpperCase();
  const last = words.last.toUpperCase();
  p.g.save();
  p.g.font = `700 29px ${TITLE_FONT}`;
  p.g.textBaseline = 'alphabetic';
  p.g.textAlign = 'left';
  const a = p.g.measureText(first).width;
  const b = p.g.measureText(last).width;
  const gap = 11;
  const x = W / 2 - (a + gap + b) / 2;
  const name = () => {
    p.g.fillText(first, x, 73);
    p.g.fillText(last, x + a + gap, 73);
  };
  p.g.fillStyle = CREAM;
  p.g.shadowColor = type.glow;
  p.g.shadowBlur = 14 * p.view.scale;
  name();
  p.g.shadowColor = rgba(type.glow, 0.8);
  p.g.shadowBlur = 4 * p.view.scale;
  name();
  p.g.shadowBlur = 0;
  name();
  p.g.restore();
  if (words.alias !== null) {
    spaced(p, words.alias, 87, 7, 600, type.aka ?? '#f0dcd0', 1.5, shade);
  }
  spaced(p, words.stage.toUpperCase(), 101, 8.6, 700, type.stage, 4, shade);
  return { x: x + a + gap / 2, y: 63 };
}

// `n` things scattered the same on every frame, from `seed`.
export function seeded(n: number, seed: number, each: (r: () => number, i: number) => void): void {
  const r = rng(seed);
  for (let i = 0; i < n; i += 1) {
    each(r, i);
  }
}
