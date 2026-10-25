import { Graphics } from 'pixi.js';
import { frac } from '../shared/scalar';
import { BEATS_PER_BAR } from '../shared/tempo';
import type { EntityId, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { EnemyPose } from './enemies';
import type { Frame } from './frame';

const KIND = 'pogo';
const RING_SIZE = 8;
const ARM = { width: 3.4, lift: 4, sag: 8 };
const HOP = { one: 0.5, beat: 0.3 };
const DUST = { share: 0.3, color: 0xc9c3dc, alpha: 0.4, minRadius: 22 };
const BREAK_BEATS = 1.2;
const IN_PLACE = 1.6;

interface Place {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

interface Break {
  readonly start: number;
  readonly x: number;
  readonly y: number;
}

function ringHop(beats: number, calm: boolean): number {
  if (calm) {
    return 0;
  }
  const one = Math.floor(beats) % BEATS_PER_BAR === 0;
  return Math.sin(Math.PI * frac(beats)) * (one ? HOP.one : HOP.beat);
}

export function createPogo(
  ctx: RenderContext,
  poseOf: (id: EntityId) => EnemyPose | undefined,
): Family {
  const arms = new Graphics();
  ctx.layers.enemies.addChildAt(arms, 0);
  const dust = ctx.layers.fx.addChild(new Graphics());
  let lastRings = new Map<EntityId, Map<number, EntityId>>();
  const breaks: Break[] = [];

  function puffs(place: Place, q: number): void {
    const scale = place.radius / DUST.minRadius;
    for (const side of [-1, 1]) {
      dust
        .circle(place.x + side * (8 + q * 8) * scale, place.y + 14 * scale, (3 + q * 3) * scale)
        .fill({ color: DUST.color, alpha: DUST.alpha * (1 - q) });
    }
  }

  function arm(a: Place, b: Place, rim: number): void {
    arms
      .moveTo(a.x, a.y - ARM.lift)
      .lineTo((a.x + b.x) / 2, (a.y + b.y) / 2 + ARM.sag)
      .lineTo(b.x, b.y - ARM.lift)
      .stroke({ width: ARM.width, color: rim, cap: 'round', join: 'round' });
  }

  function tear(last: Map<number, EntityId>, ring: Map<number, Place>, now: number): void {
    for (const [slot, id] of last) {
      const gone = poseOf(id);
      if (ring.get(slot) !== undefined || gone === undefined) {
        continue;
      }
      for (const neighbour of [(slot + RING_SIZE - 1) % RING_SIZE, (slot + 1) % RING_SIZE]) {
        const held = ring.get(neighbour);
        if (held !== undefined && last.get(neighbour) !== undefined) {
          breaks.push({ start: now, x: (gone.x + held.x) / 2, y: (gone.y + held.y) / 2 });
        }
      }
    }
  }

  function stubs(frame: Frame): void {
    for (let index = breaks.length - 1; index >= 0; index -= 1) {
      const torn = breaks[index];
      if (torn === undefined) {
        continue;
      }
      const q = (frame.now - torn.start) / frame.tempo.ticksPerBeat;
      if (q >= BREAK_BEATS) {
        breaks.splice(index, 1);
        continue;
      }
      const { x, y } = torn;
      const alpha = 1 - q / BREAK_BEATS;
      dust
        .moveTo(x - 6 - q * 10, y - q * 8)
        .lineTo(x - 1 - q * 10, y + 2 - q * 8)
        .moveTo(x + 1 + q * 10, y - 2 + q * 8)
        .lineTo(x + 6 + q * 10, y + q * 8)
        .stroke({ width: ARM.width, color: frame.palette.badVibeRim, alpha, cap: 'round' });
    }
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      arms.clear();
      dust.clear();
      const { palette, calm, tempo } = frame;
      const beats = (frame.now - tempo.originTick) / tempo.ticksPerBeat;
      const lift = ringHop(beats, calm);
      const landing = !calm && frac(beats) < DUST.share ? frac(beats) / DUST.share : undefined;
      const rings = new Map<EntityId, Map<number, EntityId>>();
      for (const boss of state.enemies) {
        if (boss.kind !== KIND) {
          continue;
        }
        const ring = new Map<number, Place>();
        const ids = new Map<number, EntityId>();
        const centre = poseOf(boss.id);
        for (const enemy of state.enemies) {
          const pose = enemy.ringOf?.id === boss.id ? poseOf(enemy.id) : undefined;
          if (pose === undefined || enemy.ringOf === undefined) {
            continue;
          }
          pose.sprite.position.y -= lift * pose.radius;
          const place = { x: pose.x, y: pose.y - lift * pose.radius, radius: pose.radius };
          const far = centre === undefined ? 0 : Math.hypot(pose.x - centre.x, pose.y - centre.y);
          if (far > enemy.ringOf.orbit * IN_PLACE) {
            continue;
          }
          ring.set(enemy.ringOf.slot, place);
          ids.set(enemy.ringOf.slot, enemy.id);
          if (landing !== undefined) {
            puffs(place, landing);
          }
        }
        for (let slot = 0; slot < RING_SIZE; slot += 1) {
          const a = ring.get(slot);
          const b = ring.get((slot + 1) % RING_SIZE);
          if (a !== undefined && b !== undefined) {
            arm(a, b, palette.badVibeRim);
          }
        }
        const last = lastRings.get(boss.id);
        if (last !== undefined) {
          tear(last, ring, frame.now);
        }
        rings.set(boss.id, ids);
      }
      lastRings = rings;
      stubs(frame);
    },
    reset(): void {
      arms.clear();
      dust.clear();
      breaks.length = 0;
      lastRings = new Map();
    },
    destroy(): void {
      arms.destroy();
      dust.destroy();
    },
  };
}
