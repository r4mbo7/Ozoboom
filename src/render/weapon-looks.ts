import type { PaletteToken } from '../shared/palette';
import { clamp01 } from '../shared/scalar';
import type { RenderContext, WeaponLook } from './context';
import type { WeaponKind } from './textures-weapons';
import { lookup } from './util';

export interface WeaponStyle {
  readonly kind: WeaponKind;
  readonly token: PaletteToken;
  readonly evolved: boolean;
  readonly look: WeaponLook;
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

export function arcProgress(ticksLeft: number, ticksTotal: number, alpha: number): number {
  return clamp01(1 - (ticksLeft - alpha) / Math.max(ticksTotal, 1));
}

const ARC_LIFT = 46;

export interface ArcLook {
  readonly height: number;
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
