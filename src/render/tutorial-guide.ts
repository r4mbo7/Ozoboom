import { Container, Graphics, Sprite } from 'pixi.js';
import { clamp, lerp } from '../shared/scalar';
import type { SetDefinition } from '../data/types';
import type { SimState, TrapState, Vec2 } from '../sim/state';
import { trapSpot } from '../sim/trap-moves';
import { worldToScreen } from './camera';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { NAME_TEXTURE_SCALE } from './textures-names';
import { lookup, setTint } from './util';

// Arena units from where a trap was taken to where the outline asks to put it down, away from the stage.
export const DROP_REACH = 240;
// The outline keeps this far from the edges of the arena.
const EDGE = 120;
const DASHES = 14;
const DASH_SHARE = 0.55;
const OUTLINE_WIDTH = 3;
const OUTLINE_GROW = 0.08;
// The outline is this many times the trap's radius.
const OUTLINE_SIZE = 1.5;
// Screen pixels: below the dash arc, the key's cap.
const KEY_BELOW = 16;
const KEY_PAD_X = 7;
const KEY_HEIGHT = 22;
const KEY_ROUND = 6;
const DASH_ARC_REACH = 23 / 14;

// Where the outline asks to put down a trap of `radius` taken at `from`: further from the stage,
// inside the arena, on the nearest spot a trap can stand, as the sim would put it there.
export function dropSpot(
  state: Pick<SimState, 'arena' | 'core' | 'traps'>,
  set: Pick<SetDefinition, 'obstacles'>,
  from: Vec2,
  radius: number,
  radiusOf: (trap: TrapState) => number,
): Vec2 {
  const dx = from.x - state.core.x;
  const dy = from.y - state.core.y;
  const length = Math.hypot(dx, dy);
  const away = length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
  const ideal = {
    x: clamp(from.x + away.x * DROP_REACH, EDGE, state.arena.width - EDGE),
    y: clamp(from.y + away.y * DROP_REACH, EDGE, state.arena.height - EDGE),
  };
  return trapSpot(state, set, { ...ideal, radius }, radiusOf) ?? ideal;
}

// What the tutorial asks, shown in the arena (src/render/types.ts, TutorialCall): the dash key
// under the player, and the dashed outline where to put down the trap carried.
export function createTutorialGuide(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const root = layers.screen.addChild(new Container());
  const outline = new Graphics();
  const cap = new Graphics();
  const label = new Sprite();
  label.anchor.set(0.5);
  label.scale.set(1 / NAME_TEXTURE_SCALE);
  root.addChild(outline, cap, label);
  let drop: Vec2 | null = null;
  let drawnKey = '';
  const point = { x: 0, y: 0 };

  function drawKey(key: string, frame: Frame): void {
    const drawn = `${key} ${String(frame.palette.texte)}`;
    if (drawn === drawnKey) {
      return;
    }
    drawnKey = drawn;
    const name = textures.names.get(key);
    label.texture = name.fill;
    const width = name.fill.width / NAME_TEXTURE_SCALE + 2 * KEY_PAD_X;
    cap.clear();
    cap
      .roundRect(-width / 2, -KEY_HEIGHT / 2, width, KEY_HEIGHT, KEY_ROUND)
      .fill({ color: frame.palette.texte })
      .stroke({ width: 1.5, color: frame.palette.sol });
    setTint(label, frame.palette.sol);
  }

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const call = ctx.options.tutorialCall ?? null;
      const player = state.players[0];
      const standing = call !== null && player !== undefined && !player.downed;
      if (!standing || call.gesture !== 'trap' || player.carriedTrap === undefined) {
        drop = null;
      }
      root.visible = standing;
      if (!standing) {
        return;
      }
      const { camera, palette, pulse } = frame;
      point.x = lerp(player.prevX, player.x, alpha);
      point.y = lerp(player.prevY, player.y, alpha);
      const at = worldToScreen(camera, point);

      const keyed = call.gesture === 'dash' && call.key !== '';
      cap.visible = label.visible = keyed;
      if (keyed) {
        drawKey(call.key, frame);
        const y = at.y + player.radius * DASH_ARC_REACH * camera.scale + KEY_BELOW;
        cap.position.set(at.x, y);
        label.position.set(at.x, y);
      }

      const carried = player.carriedTrap;
      outline.visible = call.gesture === 'trap' && carried !== undefined;
      if (carried === undefined || call.gesture !== 'trap') {
        return;
      }
      const trapRadius = lookup(ctx.trapLooks, carried.kind, 'trap kind').radius;
      drop ??= dropSpot(
        state,
        frame.set,
        player,
        trapRadius,
        (trap) => lookup(ctx.trapLooks, trap.kind, 'trap kind').radius,
      );
      const radius = trapRadius * OUTLINE_SIZE * camera.scale * (1 + OUTLINE_GROW * pulse);
      const spot = worldToScreen(camera, drop);
      outline.clear();
      const step = (Math.PI * 2) / DASHES;
      for (let index = 0; index < DASHES; index += 1) {
        const from = index * step;
        outline.moveTo(Math.cos(from) * radius, Math.sin(from) * radius);
        outline.arc(0, 0, radius, from, from + step * DASH_SHARE);
      }
      outline.stroke({ width: OUTLINE_WIDTH, color: 0xffffff, alpha: 0.6 + 0.4 * pulse });
      setTint(outline, palette.turquoise);
      outline.position.set(spot.x, spot.y);
    },
    reset(): void {
      drop = null;
    },
    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
