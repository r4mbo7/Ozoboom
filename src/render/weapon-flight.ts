import type { Sprite } from 'pixi.js';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { EntityId, PlayerState, ProjectileState, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { type Piece, SIZES, type WeaponKit } from './weapon-kit';
import { type WeaponStyle, arcLook, arcProgress } from './weapon-looks';
import { add, byId, hide, setTint } from './util';
import { ViewPool } from './views';

const GHOSTS = 4;
const SHADOW_SIZE = 30;
const LANDING_FROM = 0.6;

interface Body {
  readonly lift: number;
  readonly scale: number;
}

const FLAT: Body = { lift: 0, scale: 1 };

interface ProjectileView {
  readonly piece: Piece;
  readonly ghosts: readonly Sprite[];
  readonly shadow: Sprite;
  readonly reticle: Sprite;
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  id: EntityId;
  tick: number;
}

interface Landing {
  x: number;
  y: number;
  seen: number;
  style: WeaponStyle;
}

export interface FlightFamily extends Pick<Family, 'update' | 'reset'> {
  shadowOf(projectileId: EntityId): { scale: number; alpha: number; visible: boolean } | undefined;
}

function follow(view: ProjectileView, projectile: ProjectileState, tick: number): void {
  if (view.id !== projectile.id) {
    view.id = projectile.id;
    view.xs.fill(projectile.prevX);
    view.ys.fill(projectile.prevY);
  } else if (tick !== view.tick) {
    view.xs.copyWithin(1, 0);
    view.ys.copyWithin(1, 0);
    view.xs[0] = projectile.prevX;
    view.ys[0] = projectile.prevY;
  }
  view.tick = tick;
}

function heading(
  look: WeaponStyle,
  projectile: ProjectileState,
  owner: PlayerState | undefined,
  now: number,
  x: number,
  y: number,
): number {
  if (look.kind === 'spark') {
    return Math.atan2(projectile.vy, projectile.vx);
  }
  if (look.kind === 'orbit') {
    return owner === undefined
      ? Math.atan2(projectile.vy, projectile.vx)
      : Math.atan2(y - owner.y, x - owner.x) + Math.PI / 2;
  }
  return look.kind === 'lob' ? now * 0.25 : now * 0.4;
}

// Shots of the weapons: sparks, diabolos in their arc, frisbees and fans in their curve.
export function createFlight(ctx: RenderContext, kit: WeaponKit): FlightFamily {
  const { textures: t, layers } = ctx;
  const w = t.weapons;
  const views = new ViewPool<ProjectileView>(
    () => ({
      piece: kit.piece(),
      ghosts: Array.from({ length: GHOSTS }, () => add(layers.fx, w.icons.boomerang)),
      shadow: kit.ground(w.shadow),
      reticle: add(layers.fx, w.dash),
      xs: new Float64Array(GHOSTS),
      ys: new Float64Array(GHOSTS),
      id: -1,
      tick: -1,
    }),
    (view) => {
      kit.hidePiece(view.piece);
      hide(view.shadow, view.reticle, ...view.ghosts);
    },
  );
  const landings = new Map<EntityId, Landing>();
  let frameNo = 0;

  // The diabolo draws its shadow on the ground and rises above it: the shadow tells how high.
  function lob(
    view: ProjectileView,
    projectile: ProjectileState,
    look: WeaponStyle,
    alpha: number,
    frame: Frame,
  ): Body {
    const { arc } = projectile;
    if (arc === undefined) {
      return FLAT;
    }
    const progress = arcProgress(projectile.ticksLeft, arc.ticksTotal, alpha);
    const height = arcLook(progress);
    const { shadow, reticle } = view;
    const x = lerp(projectile.prevX, projectile.x, alpha);
    const y = lerp(projectile.prevY, projectile.y, alpha);
    shadow.visible = true;
    shadow.position.set(x, y);
    shadow.scale.set((SHADOW_SIZE * look.scale * height.shadowScale) / w.shadow.radius / 2);
    shadow.alpha = height.shadowAlpha;
    reticle.visible = true;
    setTint(reticle, frame.palette[look.token]);
    reticle.position.set(x, y);
    reticle.rotation = frame.calm ? 0 : frame.now * 0.04;
    reticle.scale.set((SHADOW_SIZE * 0.8 * look.scale * height.shadowScale) / w.dash.radius);
    reticle.alpha = 0.85 * height.shadowAlpha;
    if (arcProgress(projectile.ticksLeft, arc.ticksTotal, 0) >= LANDING_FROM) {
      const memo = landings.get(projectile.id) ?? { x, y, seen: 0, style: look };
      memo.x = x;
      memo.y = y;
      memo.seen = frameNo;
      landings.set(projectile.id, memo);
    }
    return { lift: height.lift, scale: height.bodyScale };
  }

  function draw(projectile: ProjectileState, state: SimState, alpha: number, frame: Frame): void {
    const { owner } = projectile;
    if (owner.kind !== 'weapon') {
      return;
    }
    const look = kit.style(owner.weaponId);
    const view = views.acquire(projectile.id);
    const color = frame.palette[look.token];
    const shape = look.kind === 'spark' ? w.sparkShot : w.icons[look.kind];
    const x = lerp(projectile.prevX, projectile.x, alpha);
    const y = lerp(projectile.prevY, projectile.y, alpha);
    follow(view, projectile, state.tick);
    const body = look.kind === 'lob' ? lob(view, projectile, look, alpha, frame) : FLAT;
    const size = (SIZES[look.kind] ?? 20) * look.scale * body.scale;
    const rotation = heading(
      look,
      projectile,
      byId(state.players, owner.playerId),
      frame.now,
      x,
      y,
    );
    // A frisbee that has turned back no longer hurts: it flies home, paler.
    const pale = projectile.returning === true ? 0.65 : 1;
    kit.place(
      view.piece,
      shape,
      { x, y: y - body.lift, size, rotation, alpha: pale },
      color,
      frame,
    );

    if (look.kind === 'boomerang' || look.kind === 'orbit') {
      view.ghosts.forEach((ghost, index) => {
        ghost.visible = true;
        ghost.texture = shape.texture;
        setTint(ghost, color);
        ghost.position.set(view.xs[index] ?? x, view.ys[index] ?? y);
        ghost.rotation = rotation;
        ghost.scale.set((size * (0.85 - 0.12 * index)) / (shape.radius * 2));
        ghost.alpha = frame.light.haloAlpha * 0.5 * (1 - index / GHOSTS);
      });
    }
  }

  // A diabolo that has left the state after its arc has landed: the impact wave stays behind.
  function land(frame: Frame): void {
    for (const [id, memo] of landings) {
      if (memo.seen === frameNo) {
        continue;
      }
      landings.delete(id);
      const { effect } = memo.style.look;
      if (effect.kind === 'lob') {
        kit.transients.spawn({
          shape: t.ring,
          now: frame.now,
          duration: TICKS_PER_BEAT * 0.8,
          x: memo.x,
          y: memo.y,
          fromRadius: effect.radius * 0.2,
          toRadius: effect.radius * memo.style.scale,
          tint: frame.palette[memo.style.token],
          peak: frame.calm ? 0.5 : 0.9,
        });
      }
    }
  }

  return {
    shadowOf(id) {
      const sprite = views.peek(id)?.shadow;
      return sprite === undefined
        ? undefined
        : { scale: sprite.scale.x, alpha: sprite.alpha, visible: sprite.visible };
    },
    update(state, alpha, frame) {
      frameNo += 1;
      views.begin();
      for (const projectile of state.projectiles) {
        draw(projectile, state, alpha, frame);
      }
      views.end();
      land(frame);
    },
    reset() {
      landings.clear();
    },
  };
}
