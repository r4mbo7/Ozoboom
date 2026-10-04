import type { Sprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { type Piece, type WeaponKit, mixColor } from './weapon-kit';
import { heldSlot } from './weapon-looks';
import { add, hide, setTint } from './util';
import { ViewPool } from './views';

const TRAIL_DOTS = 14;
const TRAIL_SAMPLE_TICKS = 3;

// What a festivalier carries: each weapon as a small silhouette behind the aim, and the wheel and
// the trail of the monocycle, which have no shot to hang on.
export function createCarried(ctx: RenderContext, kit: WeaponKit): Pick<Family, 'update'> {
  const { textures: t, layers } = ctx;
  const icons = t.weapons.icons;
  const held = new ViewPool<Piece>(kit.piece, kit.hidePiece);
  const wheels = new ViewPool<Piece>(kit.piece, kit.hidePiece);
  const trails = new ViewPool<readonly Sprite[]>(
    () => Array.from({ length: TRAIL_DOTS }, () => add(layers.fx, t.halo)),
    (dots) => {
      hide(...dots);
    },
  );

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette } = frame;
      held.begin();
      wheels.begin();
      trails.begin();
      for (const player of state.players) {
        const slots = player.weapons ?? [];
        if (player.downed || slots.length === 0) {
          continue;
        }
        const x = lerp(player.prevX, player.x, alpha);
        const y = lerp(player.prevY, player.y, alpha);
        slots.forEach((slot, index) => {
          const look = kit.style(slot.id);
          const spot = heldSlot(player, index, slots.length);
          const tangent = Math.atan2(spot.y, spot.x) + Math.PI / 2;
          for (let copy = 0; copy < look.copies; copy += 1) {
            const fan = (copy - (look.copies - 1) / 2) * spot.size * 0.35;
            kit.place(
              held.acquire((player.id * 16 + index) * 4 + copy),
              icons[look.kind],
              {
                x: x + spot.x + Math.cos(tangent) * fan,
                y: y + spot.y + Math.sin(tangent) * fan,
                size:
                  spot.size * look.scale * (1 + 0.1 * frame.pulse) * (look.copies > 1 ? 0.8 : 1),
              },
              palette[look.token],
              frame,
            );
          }
        });

        const slot = slots.find((candidate) => kit.style(candidate.id).kind === 'trail');
        if (slot === undefined) {
          continue;
        }
        const look = kit.style(slot.id);
        const color = palette[look.token];
        const size = player.radius * 2.1 * look.scale;
        kit.place(
          wheels.acquire(player.id),
          icons.trail,
          { x, y, size, rotation: (x + y) / (size / 2), alpha: 0.9 },
          color,
          frame,
        );
        const dots = trails.acquire(player.id);
        const ring = slot.trail;
        const length = look.look.effect.kind === 'trail' ? look.look.effect.lengthTicks : 1;
        const end = color === palette.or ? palette.turquoise : palette.or;
        dots.forEach((dot, index) => {
          const age = (index + 1) * TRAIL_SAMPLE_TICKS;
          dot.visible = ring !== undefined && age < slot.phase;
          if (!dot.visible || ring === undefined) {
            return;
          }
          const at = (((state.tick - age) % length) + length) % length;
          const along = age / length;
          setTint(dot, mixColor(color, end, along));
          dot.position.set(ring[at * 2] ?? x, ring[at * 2 + 1] ?? y);
          dot.scale.set((player.radius * 1.5 * (1 - 0.6 * along)) / t.halo.radius);
          dot.alpha = frame.light.haloAlpha * (1 - along) * 1.4;
        });
      }
      held.end();
      wheels.end();
      trails.end();
    },
  };
}
