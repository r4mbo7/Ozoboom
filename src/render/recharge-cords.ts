import { Graphics } from 'pixi.js';
import type { TrapWear } from '../data/types';
import { clamp01, frac, lerp, smoothstep } from '../shared/scalar';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { byId, lookup } from './util';
import { ViewPool } from './views';

const LETTING_GO_BEATS = 0.1;
const RAYS_BEATS = 0.35;

// The hand reaches out to the socket, this share of the player's radius from their centre.
const HAND_REACH = 0.9;
// Under the trap's edge, so the pins enter it from below.
const SOCKET_BELOW_EDGE = 13;
const SAMPLES = 32;
const LAST_SAMPLES_APART = 2;

// Loose enough to hang in a wide loop even when the player stands right by the trap.
const SLACK = { rest: 52, flying: 16, letGo: 19, jolt: 16, joltDamping: 7, joltSpeed: 18 };
const CONTROL = { fromHand: 26, flying: 35, settled: 46, wide: 34 };
const FLIGHT_ARC = 20;
const LET_GO = { x: 5, y: 6, drop: 19 };

const WIDTH = { rim: 6.5, core: 4, glow: 11, live: 2 };
const GLOW_ALPHA = 0.35;
const LIVE_ALPHA = 0.9;
const LIVE = 0xfff2c8;
const WHITE = 0xffffff;
// Sparks running the cord at once, each in half a plugged beat.
const SPARKS = 3;
const SPARK_RUNS_PER_PLUGGED_BEAT = 2;
// How many samples behind a spark, and how big it is there.
const SPARK_TAIL = [
  [4, 1.4],
  [2, 2.2],
  [0, 4.2],
] as const;
const PLUG = {
  back: -1,
  length: 12,
  half: 6,
  round: 2.4,
  rim: 1.8,
  pinFrom: 10,
  pinTo: 17,
  pinAcross: 2.8,
  pinWidth: 2.2,
};
const RAYS = { count: 5, from: 7, spread: 24, length: 7, width: 2.4, below: 3 };

function eased(beats: number, from: number, length: number): number {
  return smoothstep(clamp01((beats - from) / length));
}

function trace(g: Graphics, points: Float32Array, to: number): void {
  g.moveTo(points[0] ?? 0, points[1] ?? 0);
  for (let index = 1; index <= to; index += 1) {
    g.lineTo(points[index * 2] ?? 0, points[index * 2 + 1] ?? 0);
  }
}

function drawPlug(
  g: Graphics,
  x: number,
  y: number,
  angle: number,
  color: number,
  rim: number,
): void {
  g.save();
  // Pixi turns what it has already moved: the turn comes first.
  g.rotateTransform(angle);
  g.translateTransform(x, y);
  for (const across of [-PLUG.pinAcross, PLUG.pinAcross]) {
    g.moveTo(PLUG.pinFrom, across).lineTo(PLUG.pinTo, across);
  }
  g.stroke({ width: PLUG.pinWidth, color: WHITE });
  g.roundRect(PLUG.back, -PLUG.half, PLUG.length, PLUG.half * 2, PLUG.round)
    .fill({ color })
    .stroke({ width: PLUG.rim, color: rim });
  g.restore();
}

function drawRays(g: Graphics, x: number, y: number, share: number, color: number): void {
  const out = RAYS.from + RAYS.spread * smoothstep(share);
  for (let index = 0; index < RAYS.count; index += 1) {
    const angle = Math.PI * (-0.1 + (1.2 * index) / (RAYS.count - 1));
    const reach = out * (index % 2 === 1 ? 0.75 : 1);
    const fromX = x + Math.cos(angle) * reach;
    const fromY = y + RAYS.below + Math.sin(angle) * reach;
    g.moveTo(fromX, fromY).lineTo(
      fromX + Math.cos(angle) * RAYS.length,
      fromY + Math.sin(angle) * RAYS.length,
    );
  }
  g.stroke({ width: RAYS.width, color, alpha: 1 - share, cap: 'round' });
}

// A Rallonge's plug, drawn from what the sim holds: a cord from the player to a socket under the trap.
export function createRechargeCords(ctx: RenderContext): Family {
  const views = new ViewPool<Graphics>(
    // Under the traps, so that the pins enter them.
    () => ctx.layers.traps.addChildAt(new Graphics(), 0),
    (view) => {
      view.clear();
      view.visible = false;
    },
  );
  const points = new Float32Array((SAMPLES + 1) * 2);

  // A slack curve, loose in flight and hanging in a wide loop once plugged, sampled so that the
  // current can light it up to a point.
  function sampleCord(
    handX: number,
    handY: number,
    tipX: number,
    tipY: number,
    slack: number,
    flown: number,
  ): void {
    const distance = Math.max(1, Math.hypot(tipX - handX, tipY - handY));
    const dirX = (tipX - handX) / distance;
    const dirY = (tipY - handY) / distance;
    const c1X = handX + dirX * lerp(CONTROL.fromHand, -CONTROL.wide, flown);
    const c1Y = handY + slack;
    const c2X = tipX + dirX * lerp(-CONTROL.flying, CONTROL.wide, flown);
    const c2Y =
      tipY + lerp(-dirY * CONTROL.flying + slack * 0.5, CONTROL.settled + slack * 0.4, flown);
    for (let index = 0; index <= SAMPLES; index += 1) {
      const u = index / SAMPLES;
      const v = 1 - u;
      points[index * 2] =
        v * v * v * handX + 3 * v * v * u * c1X + 3 * v * u * u * c2X + u * u * u * tipX;
      points[index * 2 + 1] =
        v * v * v * handY + 3 * v * v * u * c1Y + 3 * v * u * u * c2Y + u * u * u * tipY;
    }
  }

  // The current flows from the landing of the plug: its front reaches the trap at the second note,
  // and sparks run the cord until the plug lets go.
  function drawCurrent(g: Graphics, runs: number, shrink: number, frame: Frame): void {
    if (runs <= 0) {
      return;
    }
    const color = frame.palette.or;
    const lit = Math.round(clamp01(runs) * SAMPLES);
    trace(g, points, lit);
    g.stroke({ width: WIDTH.glow, color, alpha: GLOW_ALPHA, cap: 'round', join: 'round' });
    trace(g, points, lit);
    g.stroke({ width: WIDTH.live, color: LIVE, alpha: LIVE_ALPHA, cap: 'round', join: 'round' });
    if (frame.calm || shrink <= 0) {
      return;
    }
    for (let spark = 0; spark < SPARKS; spark += 1) {
      const run = runs - spark / SPARKS;
      if (run < 0) {
        continue;
      }
      const along = frac(run);
      const head = Math.round(along * SAMPLES);
      const size = shrink * Math.sqrt(Math.sin(along * Math.PI));
      for (const [back, radius] of SPARK_TAIL) {
        const index = Math.max(0, head - back) * 2;
        const x = points[index] ?? 0;
        const y = points[index + 1] ?? 0;
        g.circle(x, y, radius * size * 2).fill({ color, alpha: GLOW_ALPHA });
        g.circle(x, y, radius * size).fill({ color: WHITE });
      }
    }
  }

  function drawCord(
    g: Graphics,
    handX: number,
    handY: number,
    socketX: number,
    socketY: number,
    beats: number,
    rules: TrapWear,
    frame: Frame,
  ): void {
    const { plugInBeats: land, pluggedBeats: held, unplugBeats } = rules;
    const over = land + held;
    const flown = eased(beats, 0, land);
    const loose = eased(beats, over, unplugBeats);
    const letting = eased(beats, over, LETTING_GO_BEATS);
    const tipX = lerp(lerp(handX, socketX, flown), handX, loose / 2) + LET_GO.x * letting;
    const tipY =
      lerp(lerp(handY, socketY, flown), handY, loose / 2) -
      Math.sin(flown * Math.PI) * FLIGHT_ARC +
      LET_GO.y * letting +
      LET_GO.drop * loose * loose;
    const landed = beats - land;
    const jolt =
      frame.calm || landed < 0
        ? 0
        : SLACK.jolt * Math.exp(-SLACK.joltDamping * landed) * Math.cos(landed * SLACK.joltSpeed);
    sampleCord(
      handX,
      handY,
      tipX,
      tipY,
      SLACK.rest + SLACK.flying * (1 - flown) + jolt + SLACK.letGo * loose,
      flown,
    );

    const { palette, light } = frame;
    const rim = light.additive ? palette.sol : palette.texte;
    g.alpha = 1 - loose * loose;
    trace(g, points, SAMPLES);
    g.stroke({ width: WIDTH.rim, color: rim, cap: 'round', join: 'round' });
    trace(g, points, SAMPLES);
    g.stroke({ width: WIDTH.core, color: palette.or, cap: 'round', join: 'round' });
    drawCurrent(g, (landed / held) * SPARK_RUNS_PER_PLUGGED_BEAT, 1 - letting, frame);
    // Along the cord in flight, straight up into the socket once landed.
    const before = (SAMPLES - LAST_SAMPLES_APART) * 2;
    const alongX = tipX - (points[before] ?? 0);
    const alongY = tipY - (points[before + 1] ?? 0);
    const seated = flown * (1 - letting);
    const length = Math.max(1, Math.hypot(alongX, alongY));
    const angle = Math.atan2(lerp(alongY / length, -1, seated), lerp(alongX / length, 0, seated));
    drawPlug(g, tipX, tipY, angle, palette.or, rim);
    if (frame.calm) {
      return;
    }
    // On each note: as the plug lands, and as the current reaches the trap.
    for (const after of [0, held / 2]) {
      const rays = (landed - after) / RAYS_BEATS;
      if (rays > 0 && rays < 1) {
        drawRays(g, socketX, socketY, rays, palette.or);
      }
    }
  }

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const rules = frame.set.trapWear;
      views.begin();
      for (const player of state.players) {
        const plug = player.rechargePlug;
        const trap = plug === undefined ? undefined : byId(state.traps, plug.trapId);
        if (plug === undefined || trap === undefined || rules === undefined || player.downed) {
          continue;
        }
        const look = lookup(ctx.trapLooks, trap.kind, 'trap kind');
        const x = lerp(player.prevX, player.x, alpha);
        const y = lerp(player.prevY, player.y, alpha);
        const socketX = lerp(trap.prevX, trap.x, alpha);
        const socketY = lerp(trap.prevY, trap.y, alpha) + look.radius * 0.9 + SOCKET_BELOW_EDGE;
        const reach =
          (HAND_REACH * player.radius) / Math.max(1, Math.hypot(socketX - x, socketY - y));
        const view = views.acquire(player.id);
        view.clear();
        view.visible = true;
        drawCord(
          view,
          lerp(x, socketX, reach),
          lerp(y, socketY, reach),
          socketX,
          socketY,
          Math.max(0, frame.now - plug.tick) / frame.tempo.ticksPerBeat,
          rules,
          frame,
        );
      }
      views.end();
    },
    destroy(): void {
      views.begin();
      views.end();
    },
  };
}
