import { type Container, Graphics } from 'pixi.js';
import type { DashDefinition } from '../data/types';
import { type Tempo, ticksIntoBeat } from '../shared/tempo';
import { dashGauge } from '../sim/dash';
import type { PlayerState } from '../sim/state';
import { strokeArc } from './arc-stroke';
import type { Frame } from './frame';
import { trapKick } from './trap-call';

const NEVER = Number.NEGATIVE_INFINITY;
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

export function arcAlpha(sinceFull: number, { ticksPerBeat }: Pick<Tempo, 'ticksPerBeat'>): number {
  const bar = ticksPerBeat * 4;
  if (sinceFull <= bar) {
    return 1;
  }
  return Math.max(PALE, 1 - ((1 - PALE) * (sinceFull - bar)) / ticksPerBeat);
}

export class DashArc {
  private readonly arc = new Graphics();
  private fullSince = NEVER;
  private wasFull = true;
  private emptyAt = NEVER;

  private readonly called: () => boolean;

  // `called`: the tutorial asks to dash, so the arc kicks on every beat, lit whole, as a trap calls.
  constructor(parent: Container, called: () => boolean = () => false) {
    this.called = called;
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
    const kick = this.called() ? trapKick(ticksIntoBeat(now, tempo), tempo, calm) : null;
    const shaken = (now - this.emptyAt) / (tempo.ticksPerBeat / 2);
    const shaking = shaken >= 0 && shaken < 1;
    const offset = shaking && !calm ? Math.sin(shaken * Math.PI * 4) * SHAKE * (1 - shaken) : 0;
    arc.position.set(x + offset, y);
    arc.alpha = full && kick === null ? arcAlpha(now - this.fullSince, tempo) : 1;
    arc.scale.set(kick?.bounce ?? 1);

    const radius = player.radius * REACH;
    const edge = light.additive ? palette.sol : palette.texte;
    const lit = shaking ? EMPTY_GREY : color;
    arc.clear();
    for (let index = 0; index < gauge.charges; index += 1) {
      const { from, to } = notchAngles(gauge.charges, index);
      strokeArc(arc, radius, from, to, EDGE_WIDTH, edge, 1);
      strokeArc(arc, radius, from, to, TRACK_WIDTH, color, 0.3);
      if (index < gauge.ready) {
        strokeArc(arc, radius, from, to, FULL_WIDTH, lit, 1);
      } else if (index === gauge.ready && gauge.fill > 0) {
        strokeArc(arc, radius, to - (to - from) * gauge.fill, to, FILL_WIDTH, color, 0.7);
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
