import { Container, type Sprite } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import type { WeaponKit } from './weapon-kit';
import { createPlates } from './weapon-plate';
import { createTotems } from './weapon-totem';
import { add, hide, setTint } from './util';
import { ViewPool } from './views';

export interface GroundFamily extends Pick<Family, 'update'> {
  readonly marks: number;
}

export function createGround(ctx: RenderContext, kit: WeaponKit): GroundFamily {
  const { textures: t, layers } = ctx;
  const w = t.weapons;
  // The zones lie on the ground with the speakers, under every bad vibe and boss, and under what
  // stands in them.
  const ground = layers.speakers.addChild(new Container());
  const zones = new ViewPool<Sprite>(
    () => add(ground, w.zone),
    (sprite) => {
      hide(sprite);
    },
  );
  const plates = createPlates(ctx, kit, ground);
  const totems = createTotems(ctx, kit);
  const marks = new ViewPool<Sprite>(
    () => add(layers.fx, w.dash),
    (sprite) => {
      hide(sprite);
    },
  );
  let marked = 0;

  function drawPlaced(state: SimState, alpha: number, frame: Frame): void {
    zones.begin();
    plates.begin();
    totems.begin(frame);
    for (const entry of state.placed ?? []) {
      const look = kit.style(entry.weaponId);
      const x = lerp(entry.prevX, entry.x, alpha);
      const y = lerp(entry.prevY, entry.y, alpha);
      if (look.kind !== 'totem') {
        plates.draw(entry, x, y, look, frame);
        continue;
      }
      // The totems draw it on the ground, shadow included, and dissolve it when it goes.
      const zone = zones.acquire(entry.id);
      zone.visible = true;
      setTint(zone, frame.palette[look.token]);
      zone.position.set(x, y);
      zone.rotation = frame.calm ? 0 : frame.now * 0.012;
      zone.scale.set(entry.radius / w.zone.radius);
      zone.alpha = 0.25 * totems.draw(entry, x, y, look, frame);
    }
    zones.end();
    plates.end();
    totems.end();
  }

  function drawMarks(state: SimState, alpha: number, frame: Frame): void {
    marks.begin();
    marked = 0;
    for (const enemy of state.enemies) {
      if (!enemy.marked) {
        continue;
      }
      marked += 1;
      const sprite = marks.acquire(enemy.id);
      sprite.visible = true;
      setTint(sprite, frame.palette.or);
      sprite.position.set(lerp(enemy.prevX, enemy.x, alpha), lerp(enemy.prevY, enemy.y, alpha));
      sprite.rotation = frame.calm ? 0 : frame.now * 0.05 + enemy.id;
      sprite.scale.set((enemy.radius * 1.5 + 5) / w.dash.radius);
      sprite.alpha = 0.9 * frame.light.haloAlpha + 0.1;
    }
    marks.end();
  }

  return {
    get marks(): number {
      return marked;
    },
    update(state, alpha, frame) {
      totems.rings(state, frame);
      drawPlaced(state, alpha, frame);
      drawMarks(state, alpha, frame);
    },
  };
}
