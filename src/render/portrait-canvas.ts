import { portraitPixels } from './portrait-state';

// The disc of `.ui-portrait-swatch`: a third of the frame wide, its halo 40 CSS pixels, softer in
// calm mode. A portrait shows it until its renderer draws, or when the browser refuses one.
const DISC_RADIUS = 0.17;
const DISC_HALO = 40;
const CALM_HALO = 0.3;

export interface FittedCanvas {
  readonly target: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
}

// Sizes the portrait's drawing buffer to its frame; null while the frame has no size.
export function fitPortraitCanvas(
  canvas: HTMLCanvasElement,
  maxPixels: number,
): FittedCanvas | null {
  const { width, height } = portraitPixels(
    canvas.clientWidth,
    canvas.clientHeight,
    window.devicePixelRatio,
    maxPixels,
  );
  const target = canvas.getContext('2d');
  if (width === 0 || height === 0 || target === null) {
    return null;
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { target, width, height };
}

export function paintPortraitDisc(
  canvas: HTMLCanvasElement,
  maxPixels: number,
  color: string,
  calm: boolean,
): void {
  const fitted = fitPortraitCanvas(canvas, maxPixels);
  if (fitted === null) {
    return;
  }
  const { target, width, height } = fitted;
  target.clearRect(0, 0, width, height);
  target.save();
  target.fillStyle = color;
  target.shadowColor = color;
  target.shadowBlur = DISC_HALO * (width / canvas.clientWidth) * (calm ? CALM_HALO : 1);
  target.beginPath();
  target.arc(width / 2, height / 2, width * DISC_RADIUS, 0, Math.PI * 2);
  target.fill();
  target.restore();
}
