import type { Sprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { add, hide, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const PICKUP_RADIUS = 7;

interface PickupView {
  readonly outline: Sprite;
  readonly body: Sprite;
}

export function createPickups(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const views = new ViewPool<PickupView>(
    () => ({ outline: add(layers.pickups, t.vibes), body: add(layers.pickups, t.vibes) }),
    (view) => {
      hide(view.outline, view.body);
    },
  );

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, now, calm } = frame;
      views.begin();
      for (const pickup of state.pickups) {
        const { body, outline } = views.acquire(pickup.id);
        const shape = t.vibes;
        const twinkle = calm ? 1 : 1 + 0.2 * Math.sin(now * 0.45 + pickup.id);
        body.texture = shape.texture;
        setTint(body, palette.or);
        body.visible = true;
        body.position.set(lerp(pickup.prevX, pickup.x, alpha), lerp(pickup.prevY, pickup.y, alpha));
        body.scale.set((PICKUP_RADIUS / shape.radius) * twinkle);
        body.rotation = calm ? 0 : now * 0.03 + pickup.id;
        placeOutline(outline, body, shape.texture, shape.radius, frame);
      }
      views.end();
    },
    destroy(): void {
      layers.pickups.destroy({ children: true });
    },
  };
}
