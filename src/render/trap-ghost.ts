import type { Sprite } from 'pixi.js';
import type { PlayerState, SimState } from '../sim/state';
import { CARRIED_SCALE } from './carried-traps';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { mixColor } from './palette';
import { add, byId, hide, lookup, setTint } from './util';

// The ghost's fill, this far from the ground to the player colour; its outline, this opaque; its
// sway, this many units each way over two beats.
const FILL = 0.15;
const OUTLINE = 0.85;
const SWAY = 2;

// A ghost of the trap a player's key has pointed at for two bars, where it would stand above their
// head once taken: a hollow outline in their colour, filled with the ground, swaying on the beat.
export class TrapGhost {
  private readonly ctx: RenderContext;
  private sprites: { readonly outline: Sprite; readonly body: Sprite } | null = null;

  constructor(ctx: RenderContext) {
    this.ctx = ctx;
  }

  // `bottom` is where the next trap taken would stand above the head.
  place(
    state: Pick<SimState, 'traps'>,
    player: Pick<PlayerState, 'id'>,
    color: number,
    x: number,
    bottom: number,
    frame: Frame,
  ): void {
    const { ctx } = this;
    const held = ctx.answers.heldOf(player.id, frame, ctx.options.keyTraps);
    const trap = held && byId(state.traps, held.trapId);
    if (held === undefined || trap === undefined) {
      this.hide();
      return;
    }
    this.sprites ??= {
      outline: add(ctx.layers.bubbles, ctx.textures.traps.shockwave),
      body: add(ctx.layers.bubbles, ctx.textures.traps.shockwave),
    };
    const { outline, body } = this.sprites;
    const look = lookup(ctx.trapLooks, trap.kind, 'trap kind');
    const shape = ctx.textures.traps[look.effect.kind];
    const beats = frame.now / frame.tempo.ticksPerBeat;
    const sway = frame.calm ? 0 : SWAY * Math.sin(Math.PI * beats);
    const radius = look.radius * CARRIED_SCALE;
    for (const sprite of [outline, body]) {
      sprite.texture = shape.texture;
      sprite.visible = true;
      sprite.position.set(x + sway, bottom - radius);
    }
    outline.scale.set((radius + 2) / shape.radius);
    setTint(outline, color);
    outline.alpha = OUTLINE * held.level;
    body.scale.set(radius / shape.radius);
    setTint(body, mixColor(frame.palette.sol, color, FILL));
    body.alpha = held.level;
  }

  hide(): void {
    if (this.sprites !== null) {
      hide(this.sprites.outline, this.sprites.body);
    }
  }
}
