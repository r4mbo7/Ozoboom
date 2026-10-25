import type { Graphics } from 'pixi.js';
import type { Frame } from './frame';
import {
  type Mane,
  RIBBONS,
  type RibbonPoint,
  maneWave,
  ribbonIndex,
  ribbonPoints,
  ribbonStart,
} from './vent-moments';

export interface RibbonColors {
  readonly fill: number;
  readonly fillAlpha: number;
  readonly rim: number;
  readonly rimAlpha: number;
  readonly line: number;
  readonly lineAlpha: number;
}

const VIOLET = 0xa98bff;

export function windTints(palette: Frame['palette']): readonly (readonly [number, number])[] {
  return [
    [VIOLET, 0.55],
    [palette.turquoise, 0.5],
    [palette.badVibeRim, 0.5],
    [palette.mage, 0.42],
    [palette.healer, 0.42],
    [VIOLET, 0.55],
    [palette.turquoise, 0.5],
  ];
}

export function partyColors(palette: Frame['palette']): readonly number[] {
  return [palette.mage, palette.tank, palette.healer, palette.or, palette.turquoise, VIOLET];
}

const RIM = 3.5;
const LINE_WIDTH = 1.2;
const MANE_LINES = [-0.6, -0.2, 0.2, 0.6];
const WIND_LINES = [-0.45, 0.1];

// One filled polygon: a fill costs far less to rebuild every image than a stroke with its joins.
function band(graphics: Graphics, points: readonly RibbonPoint[], grow: number): void {
  points.forEach((point, index) => {
    const reach = point.width + grow;
    const x = point.x - point.nx * reach;
    const y = point.y - point.ny * reach;
    if (index === 0) {
      graphics.moveTo(x, y);
    } else {
      graphics.lineTo(x, y);
    }
  });
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point !== undefined) {
      const reach = point.width + grow;
      graphics.lineTo(point.x + point.nx * reach, point.y + point.ny * reach);
    }
  }
  graphics.closePath();
}

export function drawRibbon(
  graphics: Graphics,
  points: readonly RibbonPoint[],
  colors: RibbonColors,
  rim = RIM,
): void {
  band(graphics, points, rim);
  graphics.fill({ color: colors.rim, alpha: colors.rimAlpha });
  band(graphics, points, 0);
  graphics.fill({ color: colors.fill, alpha: colors.fillAlpha });
  for (const share of rim >= RIM ? MANE_LINES : WIND_LINES) {
    points.forEach((point, index) => {
      const x = point.x + point.nx * point.width * share;
      const y = point.y + point.ny * point.width * share;
      if (index === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    });
    graphics.stroke({
      width: LINE_WIDTH,
      color: colors.line,
      alpha: colors.lineAlpha,
      join: 'bevel',
    });
  }
}

export function drawMane(
  graphics: Graphics,
  phase: number,
  state: Mane,
  colorsOf: (index: number) => RibbonColors,
): void {
  for (const spread of RIBBONS) {
    const index = ribbonIndex(spread);
    const start = ribbonStart(spread, state);
    const points = ribbonPoints(start, maneWave(phase, index, start.amp));
    drawRibbon(graphics, points, colorsOf(index));
  }
}
