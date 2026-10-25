import type { Sprite } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { cometPop, cometStretch, isAttracted, trailSteps } from './pickup-comet';
import { flightPose } from './pickup-flight';
import { COMET_LENGTH } from './textures-pickups';
import { add, hide, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const PICKUP_RADIUS = 7;
const TRAIL_ALPHA = 0.75;
const RESTING = -1;
const MARK_RADIUS = 22;
const MARK_ALPHA = 0.25;
const MARK_ALPHA_GAIN = 0.45;

interface PickupView {
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly mark: Sprite;
}

interface CometView {
  readonly head: Sprite;
  readonly tail: Sprite;
  since: number;
}

function placeTrail(
  part: Sprite,
  tint: number,
  x: number,
  y: number,
  heading: number,
  length: number,
): void {
  part.visible = true;
  setTint(part, tint);
  part.position.set(x, y);
  part.rotation = heading;
  part.scale.set(length / COMET_LENGTH, 1);
}

export function createPickups(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const views = new ViewPool<PickupView>(
    () => ({
      outline: add(layers.pickups, t.vibes),
      body: add(layers.pickups, t.vibes),
      mark: add(layers.pickups, t.ring),
    }),
    (view) => {
      hide(view.mark, view.outline, view.body);
    },
  );
  // Only the vibes in flight hold a trail: a resting one costs no sprite.
  const comets = new ViewPool<CometView>(
    () => {
      const head = add(layers.fx, t.cometHead, 1);
      const tail = add(layers.fx, t.cometTail, 1);
      head.alpha = TRAIL_ALPHA;
      tail.alpha = TRAIL_ALPHA;
      return { head, tail, since: RESTING };
    },
    (view) => {
      hide(view.head, view.tail);
      view.since = RESTING;
    },
  );

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, now, calm } = frame;
      views.begin();
      comets.begin();
      for (const pickup of state.pickups) {
        const { body, outline, mark } = views.acquire(pickup.id);
        const shape = t.vibes;
        const pose = flightPose(pickup, alpha, calm);
        const twinkle = calm ? 1 : 1 + 0.2 * Math.sin(now * 0.45 + pickup.id);
        const size = (PICKUP_RADIUS / shape.radius) * twinkle * pose.scale;
        const { x, y } = pose;
        body.texture = shape.texture;
        setTint(body, palette.or);
        body.visible = true;
        body.position.set(x, y);
        body.alpha = pose.alpha;
        if (isAttracted(pickup)) {
          const comet = comets.acquire(pickup.id);
          if (comet.since === RESTING) {
            comet.since = state.tick;
          }
          const elapsed = state.tick + alpha - comet.since;
          const dx = pickup.x - pickup.prevX;
          const dy = pickup.y - pickup.prevY;
          const heading = Math.atan2(dy, dx);
          const length = Math.sqrt(dx * dx + dy * dy) * trailSteps(elapsed, calm);
          const stretch = cometStretch(calm);
          const pop = size * cometPop(elapsed, calm);
          body.scale.set(pop * stretch.along, pop * stretch.across);
          body.rotation = calm ? 0 : heading;
          placeTrail(comet.head, palette.or, x, y, heading, length);
          placeTrail(comet.tail, palette.turquoise, x, y, heading, length);
        } else {
          body.scale.set(size);
          body.rotation = calm ? 0 : now * 0.03 + pickup.id;
        }
        placeOutline(outline, body, shape.texture, shape.radius, frame);
        mark.visible = pose.progress < 1 && !calm;
        if (mark.visible) {
          setTint(mark, palette.or);
          mark.position.set(pickup.x, pickup.y);
          mark.scale.set(lerp(MARK_RADIUS, PICKUP_RADIUS, pose.progress) / t.ring.radius);
          mark.alpha = MARK_ALPHA + MARK_ALPHA_GAIN * pose.progress;
        }
      }
      views.end();
      comets.end();
    },
    destroy(): void {
      layers.pickups.destroy({ children: true });
    },
  };
}
