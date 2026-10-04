import type { Sprite } from 'pixi.js';
import type { PlayerState, SimEvent, SimState } from '../sim/state';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { Family, RenderContext } from './context';
import { Particles } from './effects';
import type { Frame } from './frame';
import { ringStep } from './help';
import { lerp } from './motion';
import { add, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const TAU = Math.PI * 2;
const MASK_RADIUS = 28;
const MASK_SCALE = 1.25;
const CROSS_RADIUS = 14;
const RING_RADIUS = 26;
const GHOSTS = 6;
const HELPED_TICKS = TICKS_PER_BEAT * 2;
const LOST_TICKS = TICKS_PER_BEAT * 2;
const SPARKS_PER_PLAYER = 6;

interface BystanderView {
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly cross: Sprite;
  readonly ring: Sprite;
}

interface Ghost {
  readonly outline: Sprite;
  readonly body: Sprite;
  helped: boolean;
  start: number;
  x: number;
  y: number;
  radius: number;
  active: boolean;
}

function mix(from: number, to: number, amount: number): number {
  const channel = (shift: number): number =>
    Math.round(lerp((from >> shift) & 0xff, (to >> shift) & 0xff, amount)) << shift;
  return channel(16) | channel(8) | channel(0);
}

export function createBystanders(ctx: RenderContext): Family {
  const t = ctx.textures.specials;
  const { layers } = ctx;
  const views = new ViewPool<BystanderView>(
    () => ({
      outline: add(layers.bystanders, t.distress),
      body: add(layers.bystanders, t.distress),
      cross: add(layers.bystanders, t.cross),
      ring: add(layers.bystanders, t.helpRing[0] ?? t.distress),
    }),
    (view) => {
      hide(view.outline, view.body, view.cross, view.ring);
    },
  );
  const ghosts: Ghost[] = Array.from({ length: GHOSTS }, () => ({
    outline: add(layers.bystanders, t.distress),
    body: add(layers.bystanders, t.distress),
    helped: false,
    start: 0,
    x: 0,
    y: 0,
    radius: 11,
    active: false,
  }));
  const sparks = new Particles(layers.fx, ctx.textures.vibes, 48);
  let nextGhost = 0;

  function leave(helped: boolean, tick: number, x: number, y: number, radius: number): void {
    const ghost = ghosts[nextGhost];
    nextGhost = (nextGhost + 1) % GHOSTS;
    if (ghost === undefined) {
      return;
    }
    Object.assign(ghost, { helped, start: tick, x, y, radius, active: true });
  }

  function sparkle(state: SimState, x: number, y: number, frame: Frame): void {
    const start = state.tick;
    state.players.forEach((player: PlayerState, index) => {
      const dx = player.x - x;
      const dy = player.y - y;
      for (let spark = 0; spark < SPARKS_PER_PLAYER; spark += 1) {
        const spread = (spark / SPARKS_PER_PLAYER - 0.5) * 0.6 + index * 0.17;
        sparks.spawn({
          now: start + spark * 1.5,
          duration: HELPED_TICKS,
          x,
          y,
          dx: dx + Math.cos(spread * TAU) * 10,
          dy: dy + Math.sin(spread * TAU) * 10 - 6,
          fromRadius: 10,
          toRadius: 5,
          tint: frame.palette.or,
          peak: 1,
          spin: spread * TAU,
        });
      }
    });
  }

  function drawGhost(ghost: Ghost, frame: Frame): void {
    const { palette, now } = frame;
    const age = now - ghost.start;
    const length = ghost.helped ? HELPED_TICKS : LOST_TICKS;
    if (age < 0 || age >= length) {
      ghost.active = false;
      hide(ghost.body, ghost.outline);
      return;
    }
    const progress = age / length;
    const pale = frame.light.additive ? palette.texte : palette.solClair;
    const { body } = ghost;
    body.visible = true;
    body.texture = (ghost.helped ? t.relieved : t.distress).texture;
    if (ghost.helped) {
      setTint(body, pale);
      body.position.set(ghost.x, ghost.y - progress * 8);
      body.scale.set(
        ((ghost.radius * MASK_SCALE) / MASK_RADIUS) *
          (1 + 0.15 * Math.sin(Math.min(1, progress * 3) * Math.PI)),
      );
      body.alpha = progress < 0.5 ? 1 : 2 * (1 - progress);
    } else {
      setTint(body, mix(pale, palette.badVibe, Math.min(1, progress * 3)));
      body.position.set(ghost.x, ghost.y);
      body.scale.set(((ghost.radius * MASK_SCALE) / MASK_RADIUS) * (1 - 0.25 * progress));
      body.alpha = 1 - progress;
    }
    placeOutline(ghost.outline, body, body.texture, MASK_RADIUS, frame);
  }

  function reset(): void {
    sparks.clear();
    for (const ghost of ghosts) {
      ghost.active = false;
      hide(ghost.body, ghost.outline);
    }
  }

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (event.type === 'bystanderHelped') {
        leave(true, state.tick, event.x, event.y, 11);
        sparkle(state, event.x, event.y, frame);
      } else if (event.type === 'bystanderLost') {
        leave(false, state.tick, event.x, event.y, 11);
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, pulse, calm, now } = frame;
      const pale = frame.light.additive ? palette.texte : palette.solClair;
      views.begin();
      for (const bystander of state.bystanders ?? []) {
        const view = views.acquire(bystander.id);
        const x = lerp(bystander.prevX, bystander.x, alpha);
        const y = lerp(bystander.prevY, bystander.y, alpha);
        const { body, cross, ring, outline } = view;
        body.visible = true;
        body.texture = t.distress.texture;
        setTint(body, pale);
        body.position.set(x, y);
        body.scale.set((bystander.radius * MASK_SCALE) / MASK_RADIUS);
        body.rotation = calm ? 0 : Math.sin(now * 0.35 + bystander.id) * 0.1;
        placeOutline(outline, body, t.distress.texture, MASK_RADIUS, frame);

        cross.visible = true;
        setTint(cross, palette.healer);
        cross.position.set(x, y - bystander.radius - 18);
        cross.scale.set((8 / CROSS_RADIUS) * (1 + 0.3 * pulse));

        const step = ringStep(
          bystander.helpTicks,
          lookup(ctx.helpTicks, bystander.kind, 'bystander'),
        );
        ring.visible = step > 0;
        if (step > 0) {
          ring.texture = (t.helpRing[step] ?? t.helpRing[0] ?? t.distress).texture;
          setTint(ring, palette.healer);
          ring.position.set(x, y);
          ring.scale.set((bystander.radius + 9) / RING_RADIUS);
        }
      }
      views.end();
      for (const ghost of ghosts) {
        if (ghost.active) {
          drawGhost(ghost, frame);
        }
      }
      sparks.update(now);
    },
    reset,
    destroy(): void {
      reset();
      layers.bystanders.destroy({ children: true });
    },
  };
}
