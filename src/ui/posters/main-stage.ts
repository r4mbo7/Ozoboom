import { frac, lerp } from '../../shared/scalar';
import { SUN_PALETTES } from '../../shared/palette';
import {
  type NameGap,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  type Pen,
  type Point,
  type PosterWords,
  TAU,
  pulse,
  rgba,
} from './pen';
import { type PsycheInks, psychePoster } from './psyche';
import { seeded, sunFrame, sunHalos, sunRays, sunTexts } from './sun';

const W = POSTER_WIDTH;
const H = POSTER_HEIGHT;

// The sun setting into the lake at dusk.
export function mainStageSun(p: Pen, beat: number, words: PosterWords): NameGap {
  const P = SUN_PALETTES.crepuscule;
  const { left, right, top, bottom } = p.view;
  const cx = W / 2;
  const hy = 150;
  const R = 34;
  const sky = p.lin(0, hy, [
    [0, '#2a1534'],
    [0.5, '#46213f'],
    [0.8, '#6e2f4f'],
    [1, '#a8485a'],
  ]);
  p.g.fillStyle = sky;
  p.g.fillRect(left, top, right - left, hy - top);
  p.g.save();
  p.g.beginPath();
  p.g.rect(left, top, right - left, hy - top);
  p.g.clip();
  sunRays(p, cx, hy, 44, P.noyau, 0.16, beat / 4);
  p.glow(cx, hy, 150, P.mage, 0.32);
  p.glow(cx, hy, 66 + 5 * pulse(beat), P.noyau, 0.5 + 0.18 * pulse(beat));
  sunHalos(
    p,
    cx,
    hy,
    [
      [52, P.turquoise, 0.45],
      [76, P.or, 0.4],
      [104, P.turquoise, 0.32],
    ],
    beat,
    R + 2,
    P.noyau,
  );
  p.g.save();
  p.g.beginPath();
  p.g.arc(cx, hy, R, Math.PI, TAU);
  p.g.closePath();
  p.g.clip();
  p.g.fillStyle = p.lin(hy - R, hy, [
    [0, '#ffe7a0'],
    [0.5, P.noyau],
    [1, '#ff8656'],
  ]);
  p.g.fillRect(cx - R, hy - R, 2 * R, R);
  p.g.fillStyle = sky;
  for (const [y, h] of [
    [hy - 19.5, 0.8],
    [hy - 14.6, 1.2],
    [hy - 9.6, 1.7],
    [hy - 4.4, 2.3],
  ] as const) {
    p.g.fillRect(cx - R, y, 2 * R, h);
  }
  p.g.restore();
  const shore = (points: readonly Point[]) => {
    const first = points[0];
    const last = points[points.length - 1];
    if (first === undefined || last === undefined) {
      return;
    }
    p.g.beginPath();
    p.g.moveTo(first[0], hy + 0.5);
    for (const [x, y] of points) {
      p.g.lineTo(x, hy - y);
    }
    p.g.lineTo(last[0], hy + 0.5);
    p.g.closePath();
    p.g.fillStyle = '#251130';
    p.g.fill();
  };
  shore([
    [left, 13],
    [0, 13],
    [12, 12],
    [20, 14],
    [30, 11],
    [46, 9],
    [62, 6.5],
    [78, 5],
    [96, 3],
    [116, 1],
    [128, 0],
  ]);
  const far: readonly Point[] = [
    [196, 0],
    [212, 1.5],
    [230, 3.5],
    [246, 5],
    [262, 6],
    [276, 8],
    [290, 10.5],
    [300, 9],
    [310, 12],
    [320, 11],
  ];
  shore([...far, [right, 11]]);
  const height = (x: number) => {
    const j = far.findIndex(([fx]) => fx >= x);
    const [x0, y0] = far[j - 1] ?? [0, 0];
    const [x1, y1] = far[j] ?? [1, 0];
    return lerp(y0, y1, (x - x0) / (x1 - x0));
  };
  const lights = [P.noyau, P.turquoise, P.mage];
  seeded(10, 7, (r, i) => {
    const x = 226 + i * 8.6 + r() * 3;
    const y = hy - height(x) * (0.3 + 0.35 * r());
    const on = 0.45 + 0.55 * pulse(beat + i * 0.37, 4);
    p.lighter(() => {
      p.alpha(on, () => {
        p.circ(x, y, 0.75, lights[i % 3] ?? P.noyau);
      });
    });
  });
  p.g.restore();
  p.g.fillStyle = p.lin(hy, H, [
    [0, '#5c2a50'],
    [0.45, '#3a1b44'],
    [1, '#1c0f2e'],
  ]);
  p.g.fillRect(left, hy, right - left, bottom - hy);
  p.lighter(() => {
    p.alpha(0.35, () => {
      const light = p.g.createRadialGradient(cx, hy, 0, cx, hy, 90);
      light.addColorStop(0, rgba(P.noyau, 0.5));
      light.addColorStop(1, rgba(P.noyau, 0));
      p.g.fillStyle = light;
      p.g.fillRect(left, hy, right - left, bottom - hy);
    });
  });
  for (let i = 0; i < 11; i += 1) {
    const y = hy + 1.6 + i * 2.6;
    const w = R * (1.02 - i * 0.055);
    const s = Math.sin(i * 1.9 + (beat / 4) * TAU) * 3;
    const gap = 1.5 + i * 0.45 + 1.2 * pulse(beat);
    const c = i < 4 ? '#ffd27a' : '#ff9a62';
    p.alpha(0.95 - i * 0.07, () => {
      p.seg(cx - w + s, y, cx - gap + s * 0.3, y, c, 1.15 - i * 0.04);
      p.seg(cx + gap + s * 0.3, y, cx + w - s, y, c, 1.15 - i * 0.04);
    });
  }
  seeded(14, 31, (r) => {
    const y = hy + 3 + r() * 26;
    const x = r() < 0.5 ? 10 + r() * 100 : 210 + r() * 100;
    const w = 6 + r() * 14;
    p.alpha(0.22, () => {
      p.seg(x, y, x + w, y, '#ff9ec4', 0.5);
    });
  });
  p.alpha(0.8, () => {
    p.seg(left, hy, right, hy, rgba(P.noyau, 0.55), 0.5);
  });
  sunFrame(p, P.or);
  return sunTexts(p, words, { gold: P.or, stage: P.turquoise, glow: P.mage });
}

// The lake at dusk in magenta and gold ripples.
export function mainStageRipples(p: Pen, beat: number, words: PosterWords): NameGap {
  const ripples = () => {
    const cx = W / 2;
    const cy = 96;
    const sp = 8;
    const colors = ['#ff5fa0', '#3a1650', '#f4b448', '#3a1650'];
    const offset = frac(beat / 4) * 4 * sp;
    // Enough rings to reach the corners of the screen.
    const { top, right, bottom } = p.view;
    const reach = Math.hypot((right - cx) / 1.35, Math.max(cy - top, bottom - cy) / 0.82);
    const rings = Math.ceil(reach / sp) + 1;
    for (let i = rings; i >= 0; i -= 1) {
      const r = i * sp + offset;
      p.g.beginPath();
      for (let k = 0; k <= 96; k += 1) {
        const a = (k / 96) * TAU;
        const rr = r + 1.6 * Math.sin(6 * a + r * 0.12) + 0.9 * Math.sin(3 * a - r * 0.07);
        p.g.lineTo(cx + Math.cos(a) * rr * 1.35, cy + Math.sin(a) * rr * 0.82);
      }
      p.g.closePath();
      p.g.fillStyle = colors[(i + 400) % 4] ?? '#3a1650';
      p.g.fill();
    }
  };
  return psychePoster(p, beat, words, RIPPLES, ripples);
}

const RIPPLES: PsycheInks = {
  base: '#2a1236',
  ink: '#24102f',
  inkSoft: 'rgba(30,10,40,.82)',
  hush: 'rgba(28,8,38,.72)',
  edge: '#f4b448',
  cream: '#fbeee0',
  trackColor: '#f4b448',
  stageColor: '#5fd0c8',
  faceTop: '#fff3d0',
  faceBottom: '#ffc860',
  band: '#ff6fa8',
  inline: 'rgba(255,255,255,.55)',
  outline: '#1e0a28',
  extrude: '#ff5fa0',
};
