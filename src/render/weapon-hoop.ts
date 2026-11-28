import { Graphics } from 'pixi.js';
import { frac, smoothstep } from '../shared/scalar';
import type { Tempo } from '../shared/tempo';
import type { PlayerId, SimEvent, SimState } from '../sim/state';
import { hoopReach } from '../sim/weapons/hoop';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { TAU } from './paint';
import type { WeaponKit } from './weapon-kit';
import { ViewPool } from './views';

// The hoop as Constantin chose it (`.lavish/hoops-discreet` review of 2026-11-27, option A2, "the
// rolling hoop"): a ghost thread at the knock's wide radius, swinging round the body like a hula
// hoop, its centre orbiting the player one turn per beat, its side nearest the body a little
// brighter. On each firing, beats 1 and 3 or any a faster rhythm adds, it brightens and widens a
// touch, then fades back over a beat. One soft colour, no marks, no glow, no shadow.

const LIFT_RISE = 0.1; // beats
const LIFT_FALL = 1; // beats
const ALPHA = { rest: 0.2, near: 0.15, lift: 0.25 } as const;
// In world units.
const WIDTH = 1;
const SWAY = 8; // the radius of the centre's orbit
const WIDEN = 3; // how much a firing widens it
// The evolved Solar Rings: three threads, the outer one at the reach, the others inside it.
const RING_GAP = 14;
// Only the half nearest the body changes in brightness: it is drawn in segments, the far half in one arc.
const NEAR_SEGMENTS = 24;

function beatsOf(now: number, tempo: Tempo): number {
  return (now - tempo.originTick) / tempo.ticksPerBeat;
}

// A firing's lift, 0 to 1, `since` beats after the firing: up in 0.1 beat, back down over the next
// beat, at rest until the next firing.
export function hoopLift(since: number): number {
  if (since < 0) {
    return 0;
  }
  return since < LIFT_RISE
    ? smoothstep(since / LIFT_RISE)
    : 1 - smoothstep(Math.min(1, (since - LIFT_RISE) / LIFT_FALL));
}

// The angle of the hoop's centre round the player: one smooth turn per beat.
export function hoopOrbit(beats: number): number {
  return frac(beats) * TAU;
}

// The thread's alpha: `near` is 1 on the side that brushes the body, 0 on the far half.
export function hoopAlpha(near: number, lift: number): number {
  return ALPHA.rest + ALPHA.near * near + ALPHA.lift * lift;
}

function drawThread(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
  orbit: number,
  lift: number,
  color: number,
): void {
  const cx = x + Math.cos(orbit) * SWAY;
  const cy = y + Math.sin(orbit) * SWAY;
  const r = radius + WIDEN * lift;
  const contact = orbit + Math.PI;
  const far = contact + Math.PI / 2;
  g.moveTo(cx + Math.cos(far) * r, cy + Math.sin(far) * r);
  g.arc(cx, cy, r, far, far + Math.PI);
  g.stroke({ width: WIDTH, color, alpha: hoopAlpha(0, lift) });
  for (let k = 0; k < NEAR_SEGMENTS; k += 1) {
    const from = contact - Math.PI / 2 + (k / NEAR_SEGMENTS) * Math.PI;
    const to = from + Math.PI / NEAR_SEGMENTS;
    const near = Math.cos((from + to) / 2 - contact) ** 3;
    g.moveTo(cx + Math.cos(from) * r, cy + Math.sin(from) * r);
    g.arc(cx, cy, r, from, to);
    g.stroke({ width: WIDTH, color, alpha: hoopAlpha(near, lift) });
  }
}

export function createHoop(
  ctx: RenderContext,
  kit: WeaponKit,
): Required<Pick<Family, 'update' | 'onEvent' | 'reset'>> {
  const { layers } = ctx;
  // The tick of each player's last hoop firing: the thread lifts on the hits the game really lands.
  const fired = new Map<PlayerId, number>();
  const hoops = new ViewPool<Graphics>(
    () => layers.weapons.addChild(new Graphics()),
    (g) => {
      g.visible = false;
    },
  );

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      hoops.begin();
      const beats = beatsOf(frame.now, frame.tempo);
      for (const player of state.players) {
        const slot = player.weapons?.find((candidate) => kit.style(candidate.id).kind === 'hoop');
        if (player.downed || slot === undefined) {
          continue;
        }
        const style = kit.style(slot.id);
        const { effect } = style.look;
        if (effect.kind !== 'hoop') {
          continue;
        }
        const body = ctx.bodies.of(state, player, alpha, frame);
        const firedAt = fired.get(player.id);
        const lift =
          firedAt === undefined ? 0 : hoopLift((frame.now - firedAt) / frame.tempo.ticksPerBeat);
        const g = hoops.acquire(player.id);
        g.visible = true;
        g.clear();
        // The evolved threads orbit a third of a turn apart and brighten together on each firing.
        for (let copy = 0; copy < style.copies; copy += 1) {
          const orbit = hoopOrbit(beats + copy / style.copies);
          const radius = effect.wideRadius * hoopReach(effect, slot.level) - RING_GAP * copy;
          drawThread(g, body.x, body.y, radius, orbit, lift, frame.palette.mage);
        }
      }
      hoops.end();
    },
    onEvent(event: SimEvent, state: SimState): void {
      if (event.type === 'weaponFired' && kit.style(event.weaponId).kind === 'hoop') {
        fired.set(event.playerId, state.tick);
      }
    },
    reset(): void {
      fired.clear();
    },
  };
}
