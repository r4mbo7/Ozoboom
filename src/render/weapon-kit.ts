import type { Sprite } from 'pixi.js';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import type { Shape } from './paint';
import type { WeaponKind } from './textures-weapons';
import { Ribbons, Transients } from './weapon-fx';
import { type WeaponStyle, styleOf } from './weapon-looks';
import { add, hide, placeOutline, setTint } from './util';

// Sizes of the silhouettes in flight or on the ground, in pixels across.
export const SIZES: Partial<Record<WeaponKind, number>> = {
  spark: 16,
  lob: 22,
  boomerang: 24,
  orbit: 26,
  plate: 36,
};

export interface Piece {
  readonly halo: Sprite;
  readonly outline: Sprite;
  readonly body: Sprite;
}

export interface WeaponKit {
  readonly transients: Transients;
  readonly ribbons: Ribbons;
  style(weaponId: string): WeaponStyle;
  readonly piece: () => Piece;
  readonly hidePiece: (view: Piece) => void;
  ground(shape: Shape): Sprite;
  place(
    view: Piece,
    shape: Shape,
    spot: { x: number; y: number; size: number; rotation?: number; alpha?: number; haloY?: number },
    color: number,
    frame: Frame,
  ): void;
}

export function mixColor(from: number, to: number, amount: number): number {
  const channel = (shift: number) =>
    Math.round(((from >> shift) & 0xff) * (1 - amount) + ((to >> shift) & 0xff) * amount);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function createKit(ctx: RenderContext): WeaponKit {
  const { textures: t, layers } = ctx;
  const styles = new Map<string, WeaponStyle>();
  return {
    transients: new Transients(layers.fx, 40, t.weapons.hoopRing),
    ribbons: new Ribbons(layers.fx, 6, t.pip),
    style(weaponId) {
      let found = styles.get(weaponId);
      if (found === undefined) {
        found = styleOf(ctx, weaponId);
        styles.set(weaponId, found);
      }
      return found;
    },
    piece: () => ({
      halo: add(layers.glow, t.halo),
      outline: add(layers.weapons, t.weapons.icons.sweep),
      body: add(layers.weapons, t.weapons.icons.sweep),
    }),
    hidePiece(view) {
      hide(view.halo, view.outline, view.body);
    },
    ground: (shape) => add(layers.traps, shape),
    place(view, shape, spot, color, frame) {
      const { body, halo, outline } = view;
      const alpha = spot.alpha ?? 1;
      body.texture = shape.texture;
      setTint(body, color);
      body.visible = true;
      body.position.set(spot.x, spot.y);
      body.rotation = spot.rotation ?? 0;
      body.alpha = alpha;
      body.scale.set(spot.size / (shape.radius * 2));
      placeOutline(outline, body, shape.texture, shape.radius, frame);
      halo.visible = true;
      setTint(halo, color);
      halo.position.set(spot.x, spot.y + (spot.haloY ?? 0));
      halo.scale.set((spot.size * 1.5) / t.halo.radius);
      halo.alpha = frame.light.haloAlpha * alpha * 0.8;
    },
  };
}
