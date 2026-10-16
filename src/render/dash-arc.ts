import { type Container, Graphics } from 'pixi.js';
import type { DashDefinition } from '../data/types';
import type { Tempo } from '../shared/tempo';
import { dashGauge } from '../sim/dash';
import type { PlayerState } from '../sim/state';
import type { Frame } from './frame';

const NEVER = Number.NEGATIVE_INFINITY;
// The arc of the maquette: 23 px under a body of 14, over 1.9 radians, notches 0.16 apart.
const REACH = 23 / 14;
const SPAN = 1.9;
const GAP = 0.16;
const EDGE_WIDTH = 6.5;
const TRACK_WIDTH = 1.6;
const FULL_WIDTH = 3.6;
const FILL_WIDTH = 2.4;
const PALE = 1 / 3;
const EMPTY_GREY = 0x8e8e98;
const SHAKE = 3;

// The angles of notch `index` among `charges`, the first on the left, under the player.
export function notchAngles(charges: number, index: number): { from: number; to: number } {
  const gap = charges > 1 ? GAP : 0;
  const length = (SPAN - gap * (charges - 1)) / charges;
  const from = Math.PI / 2 + SPAN / 2 - index * (length + gap);
  return { from: from - length, to: from };
}

export function notchMiddle(radius: number, charges: number, index: number): [number, number] {
  const { from, to } = notchAngles(charges, index);
  const angle = (from + to) / 2;
  return [Math.cos(angle) * radius * REACH, Math.sin(angle) * radius * REACH];
}

// How strong the arc shows: full while something is spent, pale a bar after the last came back.
export function arcAlpha(sinceFull: number, { ticksPerBeat }: Pick<Tempo, 'ticksPerBeat'>): number {
  const bar = ticksPerBeat * 4;
  if (sinceFull <= bar) {
    return 1;
  }
  return Math.max(PALE, 1 - ((1 - PALE) * (sinceFull - bar)) / ticksPerBeat);
}

// The dashes a player has in hand, as notches in an arc at its feet.
export class DashArc {
  private readonly arc = new Graphics();
  private fullSince = NEVER;
  private wasFull = true;
  private emptyAt = NEVER;

  constructor(parent: Container) {
    parent.addChild(this.arc);
  }

  empty(tick: number): void {
    this.emptyAt = tick;
  }

  place(
    player: PlayerState,
    x: number,
    y: number,
    color: number,
    dash: DashDefinition | null,
    frame: Frame,
  ): void {
    const { arc } = this;
    arc.visible = dash !== null && !player.downed;
    if (dash === null || player.downed) {
      return;
    }
    const { now, tempo, calm, light, palette } = frame;
    const gauge = dashGauge(player, dash, now, tempo);
    const full = gauge.ready === gauge.charges;
    if (full && !this.wasFull) {
      this.fullSince = now;
    }
    this.wasFull = full;
    const shaken = (now - this.emptyAt) / (tempo.ticksPerBeat / 2);
    const shaking = shaken >= 0 && shaken < 1;
    const offset = shaking && !calm ? Math.sin(shaken * Math.PI * 4) * SHAKE * (1 - shaken) : 0;
    arc.position.set(x + offset, y);
    arc.alpha = full ? arcAlpha(now - this.fullSince, tempo) : 1;

    const radius = player.radius * REACH;
    const edge = light.additive ? palette.sol : palette.texte;
    const lit = shaking ? EMPTY_GREY : color;
    arc.clear();
    for (let index = 0; index < gauge.charges; index += 1) {
      const { from, to } = notchAngles(gauge.charges, index);
      stroke(arc, radius, from, to, EDGE_WIDTH, edge, 1);
      stroke(arc, radius, from, to, TRACK_WIDTH, color, 0.3);
      if (index < gauge.ready) {
        stroke(arc, radius, from, to, FULL_WIDTH, lit, 1);
      } else if (index === gauge.ready && gauge.fill > 0) {
        stroke(arc, radius, to - (to - from) * gauge.fill, to, FILL_WIDTH, color, 0.7);
      }
    }
  }

  reset(): void {
    this.arc.clear();
    this.arc.visible = false;
    this.fullSince = NEVER;
    this.wasFull = true;
    this.emptyAt = NEVER;
  }
}

function stroke(
  arc: Graphics,
  radius: number,
  from: number,
  to: number,
  width: number,
  color: number,
  alpha: number,
): void {
  arc.moveTo(Math.cos(from) * radius, Math.sin(from) * radius);
  arc.arc(0, 0, radius, from, to);
  arc.stroke({ width, color, alpha, cap: 'round' });
}
