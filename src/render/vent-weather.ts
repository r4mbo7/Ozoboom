import { Graphics } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { SimState } from '../sim/state';
import { BURST_AT } from './boss-moments';
import type { Camera } from './camera';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { drawRibbon, partyColors, windTints } from './vent-mane';
import {
  CHEVRONS,
  CONFETTI,
  EXIT_BEATS,
  type GustPhase,
  TRAILS,
  WIND,
  chevronRow,
  confetti,
  flyer,
  gustFade,
  ribbonPoints,
  windRibbon,
} from './vent-moments';

export interface Exit {
  readonly start: number;
  readonly x: number;
  readonly y: number;
}

export interface Weather {
  update(
    phase: GustPhase | undefined,
    state: SimState,
    alpha: number,
    frame: Frame,
    exits: readonly Exit[],
  ): void;
  reset(): void;
  destroy(): void;
}

const CHEVRON = { width: 3, glow: 7, glowAlpha: 0.25, size: 10, point: 8 };
const PAPER = 0xe9e2f7;
const WIND_FILL = 0x221e50;
const FLYER = { half: 5, tall: 7, stripe: 3, stripeHalf: 3 };
const CONFETTO = { half: 4, tall: 6 };

interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

function visible(camera: Camera): Rect {
  const width = camera.screenWidth / camera.scale;
  const height = camera.screenHeight / camera.scale;
  return { minX: camera.centerX - width / 2, minY: camera.centerY - height / 2, width, height };
}

export function createWeather(ctx: RenderContext): Weather {
  const screen = ctx.layers.screen.addChild(new Graphics());
  const floor = ctx.layers.fx.addChild(new Graphics());

  function quad(
    cx: number,
    cy: number,
    half: number,
    tall: number,
    turn: number,
    flip: number,
    color: number,
    alpha: number,
  ): void {
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const corners: readonly (readonly [number, number])[] = [
      [-half, -tall * flip],
      [half, -tall * flip],
      [half, tall * flip],
      [-half, tall * flip],
    ];
    corners.forEach(([px, py], index) => {
      const x = cx + px * cos - py * sin;
      const y = cy + px * sin + py * cos;
      if (index === 0) {
        floor.moveTo(x, y);
      } else {
        floor.lineTo(x, y);
      }
    });
    floor.closePath().fill({ color, alpha });
  }

  function chevrons(phase: GustPhase, beats: number, camera: Camera, calm: boolean, gold: number) {
    const { screenWidth, screenHeight } = camera;
    const vertical = phase.y !== 0;
    const sign = vertical ? phase.y : phase.x;
    const span = vertical ? screenWidth : screenHeight;
    const depth = vertical ? screenHeight : screenWidth;
    const step = vertical ? CHEVRONS.step : CHEVRONS.sideStep;
    const count = Math.floor((span - 2 * CHEVRONS.inset) / step) + 1;
    for (let row = 0; row < CHEVRONS.rows; row += 1) {
      const { offset, alpha } = chevronRow(row, beats, calm);
      const edge = sign > 0 ? CHEVRONS.inset + offset : depth - CHEVRONS.inset - offset;
      const tip = edge + sign * CHEVRON.point;
      for (let index = 0; index < count; index += 1) {
        const along = CHEVRONS.inset + step / 2 + index * step;
        const strokes: readonly (readonly [number, number])[] = [
          [CHEVRON.glow, alpha * CHEVRON.glowAlpha],
          [CHEVRON.width, alpha],
        ];
        for (const [width, strokeAlpha] of strokes) {
          if (vertical) {
            screen
              .moveTo(along - CHEVRON.size, edge)
              .lineTo(along, tip)
              .lineTo(along + CHEVRON.size, edge);
          } else {
            screen
              .moveTo(edge, along - CHEVRON.size)
              .lineTo(tip, along)
              .lineTo(edge, along + CHEVRON.size);
          }
          screen.stroke({ width, color: gold, alpha: strokeAlpha, cap: 'round', join: 'round' });
        }
      }
    }
  }

  function place(phase: GustPhase, rect: Rect, along: number, across: number): [number, number] {
    if (phase.y !== 0) {
      return [
        rect.minX + across,
        phase.y > 0 ? rect.minY + along : rect.minY + rect.height - along,
      ];
    }
    return [phase.x > 0 ? rect.minX + along : rect.minX + rect.width - along, rect.minY + across];
  }

  function gust(phase: GustPhase, state: SimState, alpha: number, frame: Frame): void {
    const { palette, calm } = frame;
    const fade = gustFade(phase.progress);
    const rect = visible(frame.camera);
    const vertical = phase.y !== 0;
    const alongExtent = (vertical ? rect.height : rect.width) + 2 * WIND.margin;
    const acrossExtent = vertical ? rect.width : rect.height;
    const angle = Math.atan2(phase.y, phase.x);
    const tints = windTints(palette);
    const party = partyColors(palette);
    const ribbons = calm ? WIND.calmRibbons : WIND.ribbons;
    for (let index = 0; index < ribbons; index += 1) {
      const ribbon = windRibbon(index, phase.progress);
      const [x, y] = place(
        phase,
        rect,
        -WIND.margin + ribbon.along * alongExtent,
        ribbon.across * acrossExtent,
      );
      const [line, lineAlpha] = tints[index % tints.length] ?? [palette.badVibeRim, 0.5];
      const points = ribbonPoints(
        { x, y, angle, length: ribbon.length, width: ribbon.width },
        (u) => Math.sin(u * 4 + ribbon.phase) * (calm ? 0.1 : 0.2),
      );
      drawRibbon(
        floor,
        points,
        {
          fill: WIND_FILL,
          fillAlpha: 0.55 * fade,
          rim: palette.badVibeRim,
          rimAlpha: 0.55 * fade,
          line,
          lineAlpha: lineAlpha * fade,
        },
        2,
      );
    }
    const flyers = calm ? WIND.calmFlyers : WIND.flyers;
    for (let index = 0; index < flyers; index += 1) {
      const paper = flyer(index, phase.progress);
      const [x, y] = place(
        phase,
        rect,
        -WIND.margin / 2 + paper.along * (alongExtent - WIND.margin),
        WIND.margin / 4 + paper.across * (acrossExtent - WIND.margin / 2) + paper.sway,
      );
      quad(x, y, FLYER.half, FLYER.tall, paper.turn, paper.flip, PAPER, fade);
      quad(
        x,
        y - 3 * paper.flip,
        FLYER.stripeHalf,
        FLYER.stripe / 2,
        paper.turn,
        paper.flip,
        party[index % party.length] ?? PAPER,
        fade,
      );
    }
    for (const player of state.players) {
      if (player.downed) {
        continue;
      }
      const px = lerp(player.prevX, player.x, alpha);
      const py = lerp(player.prevY, player.y, alpha);
      for (let index = -1; index <= 1; index += 1) {
        const ox = -phase.y * index * TRAILS.spacing;
        const oy = phase.x * index * TRAILS.spacing;
        floor
          .moveTo(px - phase.x * TRAILS.from + ox, py - phase.y * TRAILS.from + oy)
          .lineTo(px - phase.x * TRAILS.to + ox, py - phase.y * TRAILS.to + oy)
          .stroke({ width: 1.4, color: palette.badVibeRim, alpha: 0.6 * fade, cap: 'round' });
      }
    }
  }

  function fall(exit: Exit, frame: Frame): void {
    const p = ((frame.show - exit.start) / frame.tempo.ticksPerBeat - BURST_AT) / EXIT_BEATS;
    if (p < 0 || p >= 1) {
      return;
    }
    const party = partyColors(frame.palette);
    for (let index = 0; index < CONFETTI; index += 1) {
      const bit = confetti(index, p);
      quad(
        exit.x + bit.x,
        exit.y + bit.y,
        CONFETTO.half,
        CONFETTO.tall,
        bit.turn,
        bit.flip,
        party[index % party.length] ?? PAPER,
        bit.alpha,
      );
    }
  }

  return {
    update(phase, state, alpha, frame, exits): void {
      screen.clear();
      floor.clear();
      const beats = frame.now / frame.tempo.ticksPerBeat;
      if (phase?.kind === 'warn') {
        chevrons(phase, beats, frame.camera, frame.calm, frame.palette.or);
      } else if (phase?.kind === 'blow') {
        gust(phase, state, alpha, frame);
      }
      for (const exit of exits) {
        fall(exit, frame);
      }
    },
    reset(): void {
      screen.clear();
      floor.clear();
    },
    destroy(): void {
      screen.destroy();
      floor.destroy();
    },
  };
}
