import type { Sprite } from 'pixi.js';
import { lerp, smoothstep } from '../shared/scalar';
import type { EntityId, PlayerState, SimEvent, SimState, Vec2 } from '../sim/state';
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
// Between two traps a player carries, one above the other.
const STACK_GAP = 2;
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

interface Fading {
  readonly kind: string;
  readonly since: number;
  readonly alpha: number;
  // How far above the head it stood.
  readonly rise: number;
}

// The traps a player carries, stacked above the head, the last taken on top, each one's sprites made
// with the first one that stands there. Lifted, a trap flies up from where it stood, from afar with
// the Banane. Each dims as it wears, and fades where it was when it goes out.
export class PlayerCarriedTraps {
  private readonly views: CarriedView[] = [];
  private readonly ctx: RenderContext;
  private readonly drawn = new Map<EntityId, { rise: number; alpha: number }>();
  private fading: Fading[] = [];
  private flight: { id: EntityId; from: Vec2; since: number } | null = null;

  constructor(ctx: RenderContext) {
    this.ctx = ctx;
  }

  // Lifted, from where it stood, its centre on the ground; or out above the head.
  onEvent(
    event: Extract<SimEvent, { type: 'trapTaken' | 'carriedTrapWornOut' }>,
    since: number,
  ): void {
    if (event.type === 'trapTaken') {
      this.flight = { id: event.id, from: { x: event.x, y: event.y }, since };
      this.fading = [];
      return;
    }
    const last = this.drawn.get(event.id);
    this.fading.push({
      kind: event.kind,
      since,
      alpha: last?.alpha ?? 1,
      rise: last?.rise ?? 0,
    });
  }

  // `top` is the top of the head, or of the name above it.
  place(
    player: Pick<PlayerState, 'carriedTrap' | 'carriedUnder'>,
    x: number,
    top: number,
    frame: Frame,
  ): void {
    const carried = player.carriedTrap;
    this.drawn.clear();
    let used = 0;
    if (carried !== undefined) {
      const stack = [...(player.carriedUnder ?? []), carried];
      let rise = CARRIED_GAP;
      for (const trap of stack) {
        const alpha = wornBodyAlpha(trapPower(trap, frame.set.trapWear));
        const flying = trap === carried ? this.flying(trap.id, frame) : null;
        this.draw(used, trap.kind, x, top - rise, alpha, frame, flying);
        used += 1;
        this.drawn.set(trap.id, { rise, alpha });
        rise += 2 * this.radiusOf(trap.kind) * CARRIED_SCALE + STACK_GAP;
      }
    } else {
      this.flight = null;
    }
    this.fading = this.fading.filter((out) => {
      const faded =
        Math.max(0, frame.now - out.since) / (WORN_FADE_BEATS * frame.tempo.ticksPerBeat);
      if (faded >= 1) {
        return false;
      }
      this.draw(used, out.kind, x, top - out.rise, out.alpha * (1 - faded), frame, null);
      used += 1;
      return true;
    });
    this.hideFrom(used);
  }

  hide(): void {
    this.fading = [];
    this.flight = null;
    this.drawn.clear();
    this.hideFrom(0);
  }

  private hideFrom(index: number): void {
    for (const view of this.views.slice(index)) {
      hide(view.body, view.outline);
    }
  }

  private radiusOf(kind: string): number {
    return lookup(this.ctx.trapLooks, kind, 'trap kind').radius;
  }

  // Where the trap flies up from, and how far along it is, eased; null once above the head.
  private flying(id: EntityId, frame: Frame): { from: Vec2; flown: number } | null {
    const flight = this.flight;
    if (flight?.id !== id) {
      return null;
    }
    const share = Math.max(0, frame.now - flight.since) / (FLIGHT_BEATS * frame.tempo.ticksPerBeat);
    if (share >= 1) {
      this.flight = null;
      return null;
    }
    return { from: flight.from, flown: smoothstep(share) };
  }

  // From the ground, full size and centred on its spot, up to its place, a little smaller.
  private draw(
    index: number,
    kind: string,
    x: number,
    y: number,
    alpha: number,
    frame: Frame,
    flying: { from: Vec2; flown: number } | null,
  ): void {
    let view = this.views[index];
    if (view === undefined) {
      view = createCarriedView(this.ctx);
      this.views.push(view);
    }
    if (flying === null) {
      placeCarriedTrap(this.ctx, view, kind, x, y, alpha, frame);
      return;
    }
    const { from, flown } = flying;
    placeCarriedTrap(
      this.ctx,
      view,
      kind,
      lerp(from.x, x, flown),
      lerp(from.y + this.radiusOf(kind), y, flown) - FLIGHT_ARC * Math.sin(Math.PI * flown),
      alpha,
      frame,
      lerp(1, CARRIED_SCALE, flown),
    );
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
