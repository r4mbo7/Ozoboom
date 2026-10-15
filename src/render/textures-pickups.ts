import { type Shape, paint, polygon } from './paint';

export const COMET_LENGTH = 64;

// A tapered trail, its head at the right end: the head part and the tail part add up to one
// trail, so that each takes its own tint.
export function comet(part: 'head' | 'tail'): Shape {
  const half = COMET_LENGTH / 2;
  return paint(COMET_LENGTH, 8, 2.5, (ctx) => {
    const gradient = ctx.createLinearGradient(-half, 0, half, 0);
    for (let stop = 0; stop <= 10; stop += 1) {
      const along = stop / 10;
      const head = Math.min(1, Math.max(0, (along - 0.45) / 0.3));
      const share = part === 'head' ? head : 1 - head;
      const alpha = along * Math.sqrt(along) * share;
      gradient.addColorStop(along, `rgb(255 255 255 / ${String(alpha)})`);
    }
    ctx.fillStyle = gradient;
    polygon(ctx, [
      [-half, -0.5],
      [half, -2.5],
      [half, 2.5],
      [-half, 0.5],
    ]);
    ctx.fill();
  });
}
