import type { Sprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { TRAP_TOKENS } from './textures';
import { add, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const CRATE_WIDTH = 30;
const ICON_RADIUS = 7;
const HALO_RADIUS = 34;
const CARRIER_GAP = 7;
const CARRIER_CRATE_WIDTH = 24;
const CARRIER_CRATE_LIFT = 15;
// A loot blinks on the beat over its last bars, so that the team sees it is about to go.
const FADING_BARS = 4;

interface CrateView {
  readonly halo: Sprite;
  readonly outline: Sprite;
  readonly crate: Sprite;
  readonly icon: Sprite;
}

interface CarrierView {
  readonly halo: Sprite;
  readonly ring: Sprite;
  readonly outline: Sprite;
  readonly crate: Sprite;
}

// A loot lies as a turquoise flight case showing the icon of its trap; the bad vibe carrying one
// wears a turquoise ring and the case floats above it.
export function createLoots(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const crates = new ViewPool<CrateView>(
    () => ({
      halo: add(layers.glow, t.halo),
      outline: add(layers.pickups, t.crate),
      crate: add(layers.pickups, t.crate),
      icon: add(layers.pickups, t.traps.shockwave),
    }),
    (view) => {
      hide(view.halo, view.outline, view.crate, view.icon);
    },
  );
  const carriers = new ViewPool<CarrierView>(
    // Above the zones and the crowd: the carrier must stand out among hundreds of bad vibes.
    () => ({
      halo: add(layers.glow, t.halo),
      ring: add(layers.bubbles, t.ring),
      outline: add(layers.bubbles, t.crate),
      crate: add(layers.bubbles, t.crate),
    }),
    (view) => {
      hide(view.halo, view.ring, view.outline, view.crate);
    },
  );

  function placeCrate(
    crate: Sprite,
    outline: Sprite,
    x: number,
    y: number,
    width: number,
    frame: Frame,
  ): void {
    crate.visible = true;
    setTint(crate, frame.palette.turquoise);
    crate.position.set(x, y);
    crate.scale.set(width / (2 * t.crate.radius));
    placeOutline(outline, crate, t.crate.texture, t.crate.radius, frame);
  }

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const beat = frame.calm ? 0 : frame.pulse;
      crates.begin();
      for (const loot of state.loots ?? []) {
        const view = crates.acquire(loot.id);
        const fading = !frame.calm && loot.ticksLeft < FADING_BARS * frame.tempo.ticksPerBar;
        const shown = fading ? 0.45 + 0.55 * frame.pulse : 1;
        placeCrate(
          view.crate,
          view.outline,
          loot.x,
          loot.y,
          CRATE_WIDTH * (1 + 0.06 * beat),
          frame,
        );
        view.crate.alpha = shown;
        view.outline.alpha = shown;

        const kind = lookup(ctx.trapLooks, loot.trapId, 'trap kind').effect.kind;
        const shape = t.traps[kind];
        view.icon.texture = shape.texture;
        view.icon.visible = true;
        setTint(view.icon, frame.palette[TRAP_TOKENS[kind]]);
        view.icon.position.set(loot.x, loot.y + 1);
        view.icon.scale.set(ICON_RADIUS / shape.radius);
        view.icon.alpha = shown;

        view.halo.visible = true;
        setTint(view.halo, frame.palette.turquoise);
        view.halo.position.set(loot.x, loot.y);
        view.halo.scale.set(HALO_RADIUS / t.halo.radius);
        view.halo.alpha = (0.7 + 0.3 * beat) * frame.light.haloAlpha * shown;
      }
      crates.end();

      carriers.begin();
      for (const enemy of state.enemies) {
        if (enemy.carriesLoot !== true) {
          continue;
        }
        const view = carriers.acquire(enemy.id);
        const x = lerp(enemy.prevX, enemy.x, alpha);
        const y = lerp(enemy.prevY, enemy.y, alpha);
        view.halo.visible = true;
        setTint(view.halo, frame.palette.turquoise);
        view.halo.position.set(x, y);
        view.halo.scale.set((enemy.radius * 2.4) / t.halo.radius);
        view.halo.alpha = frame.light.haloAlpha;
        view.ring.visible = true;
        setTint(view.ring, frame.palette.turquoise);
        view.ring.position.set(x, y);
        view.ring.scale.set((enemy.radius + CARRIER_GAP) / t.ring.radius);
        view.ring.alpha = 0.85 + 0.15 * beat;
        const lift = enemy.radius + CARRIER_CRATE_LIFT + 3 * beat;
        placeCrate(view.crate, view.outline, x, y - lift, CARRIER_CRATE_WIDTH, frame);
      }
      carriers.end();
    },
    destroy(): void {
      crates.begin();
      crates.end();
      carriers.begin();
      carriers.end();
    },
  };
}
