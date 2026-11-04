import type { Sprite } from 'pixi.js';
import { lerp, smoothstep } from '../shared/scalar';
import type { CarriedTrap, SimEvent, SimState, Vec2 } from '../sim/state';
import { trapPower } from '../sim/trap-wear';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { TRAP_TOKENS } from './textures';
import { WORN_FADE_BEATS, wornBodyAlpha } from './traps';
import { add, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const RING_GAP = 7;
// Above the head, the trap is drawn this share of its size on the ground.
const CARRIED_SCALE = 0.7;
// Between a head, or the name above it, and the trap carried.
const CARRIED_GAP = 6;
// A lifted trap flies from the ground to above the head in half a beat, on an arc this high.
const FLIGHT_BEATS = 0.5;
const FLIGHT_ARC = 18;

interface CarriedView {
  readonly outline: Sprite;
  readonly body: Sprite;
}

interface CarrierView extends CarriedView {
  readonly halo: Sprite;
  readonly ring: Sprite;
}

// Above the zones and the crowd: a carried trap must stand out among hundreds of bad vibes.
function createCarriedView({ textures: t, layers }: RenderContext): CarriedView {
  return {
    outline: add(layers.bubbles, t.traps.shockwave),
    body: add(layers.bubbles, t.traps.shockwave),
  };
}

// A trap above a head, a carrier's or a player's, its bottom at `y`: the trap itself, which does not
// act up there.
function placeCarriedTrap(
  ctx: RenderContext,
  view: CarriedView,
  kind: string,
  x: number,
  y: number,
  alpha: number,
  frame: Frame,
  scale = CARRIED_SCALE,
): void {
  const look = lookup(ctx.trapLooks, kind, 'trap kind');
  const effect = look.effect.kind;
  const shape = ctx.textures.traps[effect];
  const { body, outline } = view;
  body.texture = shape.texture;
  body.visible = true;
  setTint(body, frame.palette[TRAP_TOKENS[effect]]);
  body.position.set(x, y - look.radius * scale);
  body.scale.set((look.radius * scale) / shape.radius);
  body.alpha = alpha;
  placeOutline(outline, body, shape.texture, shape.radius, frame);
}

// The trap a player carries, its sprites made with the first one. Lifted, it flies up from where it
// stood, from afar with the Banane. It dims as it wears, and fades when it goes out.
export class PlayerCarriedTrap {
  private view: CarriedView | null = null;
  private readonly ctx: RenderContext;
  private wornOut: { kind: string; since: number; alpha: number } | null = null;
  private flight: { from: Vec2; since: number } | null = null;

  constructor(ctx: RenderContext) {
    this.ctx = ctx;
  }

  // Lifted, from where it stood, its centre on the ground; or out above the head.
  onEvent(
    event: Extract<SimEvent, { type: 'trapTaken' | 'carriedTrapWornOut' }>,
    since: number,
  ): void {
    if (event.type === 'trapTaken') {
      this.flight = { from: { x: event.x, y: event.y }, since };
      return;
    }
    const alpha = this.view?.body.visible === true ? this.view.body.alpha : 1;
    this.wornOut = { kind: event.kind, since, alpha };
  }

  // `top` is the top of the head, or of the name above it.
  place(carried: CarriedTrap | undefined, x: number, top: number, frame: Frame): void {
    const y = top - CARRIED_GAP;
    if (carried !== undefined) {
      this.wornOut = null;
      const alpha = wornBodyAlpha(trapPower(carried, frame.set.trapWear));
      const flying = this.flying(frame);
      if (flying === null) {
        this.draw(carried.kind, x, y, alpha, frame);
        return;
      }
      // From the ground, full size and centred on its spot, up to the head, a little smaller.
      const { from, flown } = flying;
      const radius = lookup(this.ctx.trapLooks, carried.kind, 'trap kind').radius;
      const scale = lerp(1, CARRIED_SCALE, flown);
      const arc = FLIGHT_ARC * Math.sin(Math.PI * flown);
      this.draw(
        carried.kind,
        lerp(from.x, x, flown),
        lerp(from.y + radius, y, flown) - arc,
        alpha,
        frame,
        scale,
      );
      return;
    }
    this.flight = null;
    const out = this.wornOut;
    const faded =
      out === null
        ? 1
        : Math.max(0, frame.now - out.since) / (WORN_FADE_BEATS * frame.tempo.ticksPerBeat);
    if (out === null || faded >= 1) {
      this.hide();
      return;
    }
    this.draw(out.kind, x, y, out.alpha * (1 - faded), frame);
  }

  hide(): void {
    this.wornOut = null;
    this.flight = null;
    if (this.view !== null) {
      hide(this.view.body, this.view.outline);
    }
  }

  // Where the trap flies up from, and how far along it is, eased; null once above the head.
  private flying(frame: Frame): { from: Vec2; flown: number } | null {
    const flight = this.flight;
    if (flight === null) {
      return null;
    }
    const share = Math.max(0, frame.now - flight.since) / (FLIGHT_BEATS * frame.tempo.ticksPerBeat);
    if (share >= 1) {
      this.flight = null;
      return null;
    }
    return { from: flight.from, flown: smoothstep(share) };
  }

  private draw(
    kind: string,
    x: number,
    y: number,
    alpha: number,
    frame: Frame,
    scale = CARRIED_SCALE,
  ): void {
    this.view ??= createCarriedView(this.ctx);
    placeCarriedTrap(this.ctx, this.view, kind, x, y, alpha, frame, scale);
  }
}

export function createCarriers(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const carriers = new ViewPool<CarrierView>(
    () => ({
      halo: add(layers.glow, t.halo),
      ring: add(layers.bubbles, t.ring),
      ...createCarriedView(ctx),
    }),
    (view) => {
      hide(view.halo, view.ring, view.outline, view.body);
    },
  );

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const beat = frame.calm ? 0 : frame.pulse;
      carriers.begin();
      for (const enemy of state.enemies) {
        if (enemy.carriesTrap === undefined) {
          continue;
        }
        const view = carriers.acquire(enemy.id);
        const x = lerp(enemy.prevX, enemy.x, alpha);
        const y = lerp(enemy.prevY, enemy.y, alpha);
        view.halo.visible = true;
        setTint(view.halo, frame.palette.turquoise);
        view.halo.position.set(x, y);
        view.halo.scale.set((enemy.radius * 2.4) / t.halo.radius);
        view.halo.alpha = frame.light.haloAlpha;
        view.ring.visible = true;
        setTint(view.ring, frame.palette.turquoise);
        view.ring.position.set(x, y);
        view.ring.scale.set((enemy.radius + RING_GAP) / t.ring.radius);
        view.ring.alpha = 0.85 + 0.15 * beat;
        const lift = enemy.radius + CARRIED_GAP + 3 * beat;
        placeCarriedTrap(ctx, view, enemy.carriesTrap, x, y - lift, 1, frame);
      }
      carriers.end();
    },
    destroy(): void {
      carriers.begin();
      carriers.end();
    },
  };
}
