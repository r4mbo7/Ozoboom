import type { Sprite } from 'pixi.js';
import { clamp01, lerp } from '../shared/scalar';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { mixColor } from './palette';
import { type Piece, type WeaponKit } from './weapon-kit';
import { add, hide, setTint } from './util';
import { ViewPool } from './views';

const TRAIL_DOTS = 14;
const TRAIL_SAMPLE_TICKS = 3;
const DASH_DOTS = 24;

export function createCarried(ctx: RenderContext, kit: WeaponKit): Pick<Family, 'update'> {
  const { textures: t, layers } = ctx;
  const icons = t.weapons.icons;
  const wheels = new ViewPool<Piece>(kit.piece, kit.hidePiece);
  const trails = new ViewPool<readonly Sprite[]>(
    () => Array.from({ length: TRAIL_DOTS }, () => add(layers.fx, t.halo)),
    (dots) => {
      hide(...dots);
    },
  );
  const dashTrails = new ViewPool<readonly Sprite[]>(
    () => Array.from({ length: DASH_DOTS }, () => add(layers.fx, t.halo)),
    (dots) => {
      hide(...dots);
    },
  );

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette } = frame;
      wheels.begin();
      trails.begin();
      dashTrails.begin();
      for (const player of state.players) {
        const slot = player.weapons?.find((candidate) => kit.style(candidate.id).kind === 'trail');
        if (player.downed || slot === undefined) {
          continue;
        }
        const x = lerp(player.prevX, player.x, alpha);
        const y = lerp(player.prevY, player.y, alpha);
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
        const lasting =
          look.look.effect.kind === 'trail' ? look.look.effect.dashTrailTicks : undefined;
        const kept = slot.dashTrail;
        if (lasting === undefined || kept === undefined) {
          continue;
        }
        // The newest points first: past the pool, the oldest are the ones not drawn.
        const shown = Math.min(DASH_DOTS, kept.length / 3);
        dashTrails.acquire(player.id).forEach((dot, index) => {
          const at = (kept.length / 3 - 1 - index) * 3;
          dot.visible = index < shown;
          if (!dot.visible) {
            return;
          }
          const left = ((kept[at + 2] ?? 0) - frame.now) / lasting;
          setTint(dot, mixColor(end, color, left));
          dot.position.set(kept[at] ?? x, kept[at + 1] ?? y);
          dot.scale.set((player.radius * 1.3) / t.halo.radius);
          dot.alpha = frame.light.haloAlpha * clamp01(left) * 1.2;
        });
      }
      wheels.end();
      trails.end();
      dashTrails.end();
    },
  };
}
