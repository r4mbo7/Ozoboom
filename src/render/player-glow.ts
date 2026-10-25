import type { Container, Sprite } from 'pixi.js';
import type { Tempo } from '../shared/tempo';
import type { PlayerState } from '../sim/state';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import type { Shape } from './textures';
import { CONTOUR_RING } from './textures-players';
import { add, hide, setTint } from './util';
import { createVibeGlow, glowAt, glowBounce, glowLit, lightUp } from './vibe-glow';

const RIM_GAP = 1;
const SHOWN = 0.01;

export class PlayerGlow {
  private readonly glow = createVibeGlow();
  private readonly haloShape: Shape;
  private readonly halo: Sprite;
  private readonly rim: Sprite;

  constructor({ textures, layers }: RenderContext, marks: Container) {
    this.haloShape = textures.halo;
    // In fx, not in glow: calm mode already dims the whole glow layer, and would dim it twice.
    this.halo = add(layers.fx, textures.halo);
    this.rim = add(marks, textures.players.contour);
    this.reset();
  }

  collect(tick: number, tempo: Tempo): void {
    lightUp(this.glow, tick, tempo);
  }

  place(player: PlayerState, x: number, y: number, extent: number, frame: Frame): number {
    const level = player.downed ? 0 : glowAt(this.glow, frame.now, frame.tempo);
    const lit = glowLit(level, frame.calm);
    const { halo, rim } = this;
    halo.visible = rim.visible = lit > SHOWN;
    if (!halo.visible) {
      return 1;
    }
    const bounce = glowBounce(level, frame.calm);
    setTint(halo, frame.palette.or);
    halo.position.set(x, y);
    halo.scale.set((player.radius * (3 + 2.5 * lit)) / this.haloShape.radius);
    halo.alpha = lit * frame.light.haloAlpha;
    setTint(rim, frame.palette.or);
    rim.position.set(x, y);
    rim.scale.set(((extent + RIM_GAP) * bounce) / CONTOUR_RING);
    rim.alpha = lit;
    return bounce;
  }

  reset(): void {
    this.glow.level = 0;
    hide(this.halo, this.rim);
  }
}
