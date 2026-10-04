import { Sprite, type Container } from 'pixi.js';
import type { EnemyBehaviour, TrapEffect } from '../data/types';
import type { EntityId, SimEvent, SimState } from '../sim/state';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { trapReach } from './reach';
import { TRAP_TOKENS, type Shape } from './textures';
import { byId, lookup } from './util';

const TAU = Math.PI * 2;

interface Particle {
  readonly sprite: Sprite;
  start: number;
  duration: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  from: number;
  to: number;
  peak: number;
  spin: number;
}

export interface ParticleSpec {
  readonly now: number;
  readonly duration: number;
  readonly x: number;
  readonly y: number;
  readonly dx?: number;
  readonly dy?: number;
  readonly fromRadius: number;
  readonly toRadius: number;
  readonly tint: number;
  readonly peak: number;
  readonly spin?: number;
}

export class Particles {
  private readonly items: Particle[];
  private readonly shape: Shape;
  private next = 0;

  constructor(parent: Container, shape: Shape, capacity: number) {
    this.shape = shape;
    this.items = Array.from({ length: capacity }, () => {
      const sprite = new Sprite(shape.texture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      parent.addChild(sprite);
      return {
        sprite,
        start: 0,
        duration: 1,
        x: 0,
        y: 0,
        dx: 0,
        dy: 0,
        from: 0,
        to: 0,
        peak: 0,
        spin: 0,
      };
    });
  }

  spawn(spec: ParticleSpec): void {
    const particle = this.items[this.next];
    if (particle === undefined) {
      return;
    }
    this.next = (this.next + 1) % this.items.length;
    particle.start = spec.now;
    particle.duration = spec.duration;
    particle.x = spec.x;
    particle.y = spec.y;
    particle.dx = spec.dx ?? 0;
    particle.dy = spec.dy ?? 0;
    particle.from = spec.fromRadius / this.shape.radius;
    particle.to = spec.toRadius / this.shape.radius;
    particle.peak = spec.peak;
    particle.spin = spec.spin ?? 0;
    particle.sprite.tint = spec.tint;
    particle.sprite.visible = true;
  }

  update(now: number): void {
    for (const particle of this.items) {
      const { sprite } = particle;
      if (!sprite.visible) {
        continue;
      }
      const progress = (now - particle.start) / particle.duration;
      if (progress >= 1 || progress < 0) {
        sprite.visible = false;
        continue;
      }
      const eased = 1 - (1 - progress) * (1 - progress);
      sprite.position.set(particle.x + particle.dx * eased, particle.y + particle.dy * eased);
      sprite.scale.set(particle.from + (particle.to - particle.from) * eased);
      sprite.rotation = particle.spin * progress;
      sprite.alpha = particle.peak * (1 - progress);
    }
  }

  clear(): void {
    for (const particle of this.items) {
      particle.sprite.visible = false;
    }
  }
}

export function createEffects(
  ctx: RenderContext,
  reachOf: (id: EntityId) => number | undefined,
): Family {
  const { textures: t, layers } = ctx;
  const rings = new Particles(layers.fx, t.ring, 48);
  const puffs = new Particles(layers.fx, t.halo, 96);
  const shards = new Particles(layers.fx, t.shard, 900);

  function firedReach(state: SimState, trapId: EntityId, effect: TrapEffect): number {
    const trap = byId(state.traps, trapId);
    const owner = trap === undefined ? undefined : byId(state.players, trap.ownerId);
    if (owner !== undefined) {
      return trapReach(effect, owner);
    }
    // A trap broken in the tick it fired has already left the state: keep the reach it was drawn with.
    return reachOf(trapId) ?? trapReach(effect, { modifiers: {} });
  }

  function burst(
    x: number,
    y: number,
    id: number,
    behaviour: EnemyBehaviour,
    tick: number,
    frame: Frame,
  ): void {
    const { mage, turquoise, healer, tank, texte } = frame.palette;
    const colors = [mage, turquoise, healer, tank];
    const boss = behaviour === 'boss';
    const count = boss ? 28 : 10;
    const reach = boss ? 140 : 42;
    const offset = (id * 0.618) % 1;
    for (let index = 0; index < count; index += 1) {
      const angle = ((index + offset) / count) * TAU;
      const distance = reach * (0.6 + 0.4 * ((index * 7) % 5) * 0.25);
      shards.spawn({
        now: tick,
        duration: TICKS_PER_BEAT,
        x,
        y,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        fromRadius: boss ? 9 : 5,
        toRadius: boss ? 6 : 3,
        tint: colors[(index + id) % colors.length] ?? texte,
        peak: 1,
        spin: angle + Math.PI,
      });
    }
    if (!ctx.options.calmMode) {
      puffs.spawn({
        now: tick,
        duration: TICKS_PER_BEAT / 2,
        x,
        y,
        fromRadius: boss ? 60 : 16,
        toRadius: boss ? 160 : 40,
        tint: colors[id % colors.length] ?? texte,
        peak: 0.8,
      });
    }
  }

  function reset(): void {
    for (const particles of [shards, puffs, rings]) {
      particles.clear();
    }
  }

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      const tick = state.tick;
      if (event.type === 'enemyDied') {
        burst(
          event.x,
          event.y,
          event.id,
          lookup(ctx.behaviours, event.kind, 'enemy kind'),
          tick,
          frame,
        );
      } else if (event.type === 'trapFired') {
        const { effect } = lookup(ctx.trapLooks, event.kind, 'trap kind');
        if (effect.kind === 'shockwave') {
          const reach = firedReach(state, event.id, effect);
          rings.spawn({
            now: tick,
            duration: TICKS_PER_BEAT / 2,
            x: event.x,
            y: event.y,
            fromRadius: reach * 0.2,
            toRadius: reach,
            tint: frame.palette[TRAP_TOKENS.shockwave],
            peak: ctx.options.calmMode ? 0.5 : 0.9,
          });
        }
      }
    },
    update(_state: SimState, _alpha: number, frame: Frame): void {
      shards.update(frame.now);
      puffs.update(frame.now);
      rings.update(frame.now);
    },
    reset,
    destroy: reset,
  };
}
