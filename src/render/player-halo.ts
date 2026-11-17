import type { Sprite } from 'pixi.js';
import type { PlayerState } from '../sim/state';
import type { Frame } from './frame';
import { setTint } from './util';

export function placePlayerHalo(
  halo: Sprite,
  haloRadius: number,
  player: PlayerState,
  x: number,
  y: number,
  color: number,
  share: number,
  frame: Frame,
): void {
  const { palette, light, pulse } = frame;
  const dazzled = (player.dazzledTicks ?? 0) > 0;
  halo.visible = share > 0 || (!player.downed && !((player.suppressedTicks ?? 0) > 0));
  setTint(halo, dazzled ? palette.texte : color);
  halo.position.set(x, y);
  halo.scale.set(((player.radius * (dazzled ? 4.6 : 3.2)) / haloRadius) * (1 + 0.1 * pulse));
  const kept = 1 - (frame.drained.players.get(player.id) ?? 0);
  halo.alpha = (dazzled ? Math.min(1, light.haloAlpha * 1.6) : light.haloAlpha) * kept;
  if (player.downed) {
    halo.scale.set(((player.radius * 2.6) / haloRadius) * (1 + 0.1 * pulse));
    halo.alpha = light.haloAlpha * 0.8 * share * kept;
  }
}
