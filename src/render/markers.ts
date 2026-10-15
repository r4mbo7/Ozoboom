import type { SimState } from '../sim/state';
import { type EdgeMarker, edgeMarker } from './camera';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { add, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const INSET = 34;
const SIZE = 1.25;
const HALO = 40;
const DOWNED_ALPHA = 0.65;

// Screen space, in the class color: an arrow on the border toward each player out of view.
export function createMarkers(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const root = layers.screen;
  const views = new ViewPool(
    () => ({
      halo: add(root, textures.halo),
      outline: add(root, textures.arrow),
      arrow: add(root, textures.arrow),
    }),
    (view) => {
      hide(view.halo, view.outline, view.arrow);
    },
  );
  const marker: EdgeMarker = { x: 0, y: 0, angle: 0 };
  const point = { x: 0, y: 0 };

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light, pulse } = frame;
      views.begin();
      for (const player of state.players) {
        point.x = lerp(player.prevX, player.x, alpha);
        point.y = lerp(player.prevY, player.y, alpha);
        if (!edgeMarker(frame.camera, point, INSET, marker)) {
          continue;
        }
        const { halo, outline, arrow } = views.acquire(player.id);
        const color = palette[lookup(ctx.classTokens, player.classId, 'class')];
        const fade = player.downed ? DOWNED_ALPHA : 1;

        arrow.visible = true;
        setTint(arrow, color);
        arrow.position.set(marker.x, marker.y);
        arrow.rotation = marker.angle;
        arrow.scale.set(SIZE * (1 + 0.12 * pulse));
        arrow.alpha = fade;
        placeOutline(outline, arrow, textures.arrow.texture, textures.arrow.radius, frame);
        outline.alpha = fade;

        const blend = light.additive ? 'add' : 'normal';
        if (halo.blendMode !== blend) {
          halo.blendMode = blend;
        }
        halo.visible = true;
        setTint(halo, color);
        halo.position.set(marker.x, marker.y);
        halo.scale.set(HALO / textures.halo.radius);
        halo.alpha = light.haloAlpha * fade;
      }
      views.end();
    },
    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
