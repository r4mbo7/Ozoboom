import type { Container } from 'pixi.js';
import type { RenderContext } from './context';
import { DownedBeacon } from './downed-beacon';
import { DownedFireflies } from './downed-fireflies';
import { DownedSwarm } from './downed-swarm';
import type { Frame } from './frame';

const QUARTERS = 4;

export function downedFill(share: number): number {
  return Math.floor(share * QUARTERS) / QUARTERS;
}

export class Downed {
  private readonly swarm: DownedSwarm;
  private readonly beacon: DownedBeacon;
  private readonly fireflies: DownedFireflies;

  constructor(ctx: RenderContext, bodies: Container, marks: Container) {
    this.beacon = new DownedBeacon(ctx);
    this.swarm = new DownedSwarm(ctx, bodies);
    this.fireflies = new DownedFireflies(ctx, marks);
  }

  hide(): void {
    this.beacon.hide();
    this.swarm.hide();
    this.fireflies.hide();
  }

  place(
    downed: boolean,
    x: number,
    y: number,
    angle: number,
    scale: number,
    color: number,
    share: number,
    burst: number,
    frame: Frame,
  ): void {
    const { swarm, beacon, fireflies } = this;
    if (downed || burst < 1) {
      const { now, tempo, calm } = frame;
      const flownAway = downed ? null : burst;
      const moment = { now, ticksPerBeat: tempo.ticksPerBeat, reviveShare: share, flownAway, calm };
      fireflies.place(x, y, angle, scale, color, moment, frame);
    } else {
      fireflies.hide();
    }
    if (!downed) {
      swarm.hide();
      beacon.hide();
      return;
    }
    beacon.place(x, y, scale, color, frame);
    swarm.place(x, y, angle, scale, color, downedFill(share), frame);
  }
}
