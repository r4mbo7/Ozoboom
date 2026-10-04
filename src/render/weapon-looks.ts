import type { PaletteToken } from '../shared/palette';
import type { PlayerState } from '../sim/state';
import type { RenderContext, WeaponLook } from './context';
import type { WeaponKind } from './textures-weapons';
import { lookup } from './util';

export interface WeaponStyle {
  readonly kind: WeaponKind;
  readonly token: PaletteToken;
  readonly evolved: boolean;
  readonly look: WeaponLook;
  // An evolved form keeps the silhouette of its origin, bigger and sometimes in several copies.
  readonly copies: number;
  readonly scale: number;
}

const EVOLVED_COPIES: Partial<Record<WeaponKind, number>> = { sweep: 2, hoop: 3, boomerang: 3 };
// V0.1 has no tank nor healer: a weapon without class wears the color game-design.md gives it.
const DEFAULT_TOKENS: Partial<Record<WeaponKind, PaletteToken>> = {
  sweep: 'tank',
  totem: 'tank',
  orbit: 'tank',
  boomerang: 'healer',
  plate: 'healer',
  trail: 'healer',
};
const EVOLVED_SCALE = 1.3;

export function styleOf(ctx: RenderContext, weaponId: string): WeaponStyle {
  const look = lookup(ctx.weaponLooks, weaponId, 'weapon');
  const kind = look.effect.kind;
  const evolved = look.evolvedFrom !== undefined;
  const token: PaletteToken =
    look.classAffinity === undefined
      ? (DEFAULT_TOKENS[kind] ?? 'or')
      : lookup(ctx.classTokens, look.classAffinity, 'class');
  return {
    kind,
    token,
    evolved,
    look,
    copies: evolved ? (EVOLVED_COPIES[kind] ?? 1) : 1,
    scale: evolved ? EVOLVED_SCALE : 1,
  };
}

// Held silhouettes sit in a ring behind the aim, a little bigger than the festivalier's hand.
export const HELD_SIZE = 1.1;
const HELD_SPACING = 1.35;
const HELD_RING = 0.9;

export interface HeldSlot {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export function heldSlot(
  player: Pick<PlayerState, 'radius' | 'aim'>,
  index: number,
  count: number,
): HeldSlot {
  const size = player.radius * HELD_SIZE;
  const distance = player.radius + size * HELD_RING;
  const step = Math.min((HELD_SPACING * size) / distance, (2 * Math.PI) / Math.max(count, 1));
  const angle = Math.atan2(player.aim.y, player.aim.x) + Math.PI + (index - (count - 1) / 2) * step;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, size };
}

// The diabolo's arc: 0 at launch, 1 on landing; `alpha` is how far the render is into the tick.
export function arcProgress(ticksLeft: number, ticksTotal: number, alpha: number): number {
  return Math.min(1, Math.max(0, 1 - (ticksLeft - alpha) / Math.max(ticksTotal, 1)));
}

const ARC_LIFT = 46;

export interface ArcLook {
  readonly height: number;
  // Seen from above, what rises gets smaller on the ground and fainter: the shadow says how high.
  readonly shadowScale: number;
  readonly shadowAlpha: number;
  readonly lift: number;
  readonly bodyScale: number;
}

export function arcLook(progress: number): ArcLook {
  const height = 4 * progress * (1 - progress);
  return {
    height,
    shadowScale: 1 - 0.55 * height,
    shadowAlpha: 1 - 0.65 * height,
    lift: ARC_LIFT * height,
    bodyScale: 1 + 0.45 * height,
  };
}
