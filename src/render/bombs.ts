import { Graphics, type Sprite } from 'pixi.js';
import type { Arena, SimEvent, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { BOMB_FUSE_TIP } from './textures-traps';
import { add, hide, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const BOMB_WIDTH = 42;
const CARRIER_BOMB_WIDTH = 34;
const CARRIER_GAP = 7;
const CARRIER_BOMB_LIFT = 20;
const HALO_RADIUS = 40;
const SPARK_RADIUS = 8;
// A bomb blinks on the beat over its last bars, like a loot.
const FADING_BARS = 4;
const FLASH_RADIUS = { from: 40, to: 320 };

// How the wave crosses the floor, in bars of the stage: softer and slower in calm mode.
const WAVE = { bars: 1, peak: 0.95, band: 34, line: 6 };
const CALM_WAVE = { bars: 2, peak: 0.4, band: 0, line: 4 };

interface BombView {
  readonly halo: Sprite;
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly spark: Sprite;
}

interface CarrierView extends BombView {
  readonly ring: Sprite;
}

interface Wave {
  x: number;
  y: number;
  start: number;
  reach: number;
}

export function farthestCorner(arena: Arena, x: number, y: number): number {
  const dx = Math.max(x, arena.width - x);
  const dy = Math.max(y, arena.height - y);
  return Math.sqrt(dx * dx + dy * dy);
}

// A bomb lies as a round magenta bomb whose fuse sparkles on the beat; the bad vibe carrying one
// wears a magenta ring and the bomb floats above it. Set off, a wave runs from it over the whole
// floor.
export function createBombs(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const lying = new ViewPool<BombView>(
    () => ({
      halo: add(layers.glow, t.halo),
      outline: add(layers.pickups, t.bomb),
      body: add(layers.pickups, t.bomb),
      spark: add(layers.pickups, t.vibes),
    }),
    (view) => {
      hide(view.halo, view.outline, view.body, view.spark);
    },
  );
  const carriers = new ViewPool<CarrierView>(
    // Above the zones and the crowd, like a loot carrier.
    () => ({
      halo: add(layers.glow, t.halo),
      ring: add(layers.bubbles, t.ring),
      outline: add(layers.bubbles, t.bomb),
      body: add(layers.bubbles, t.bomb),
      spark: add(layers.bubbles, t.vibes),
    }),
    (view) => {
      hide(view.halo, view.ring, view.outline, view.body, view.spark);
    },
  );
  const wave = new Graphics();
  layers.fx.addChild(wave);
  const flash = add(layers.glow, t.halo);
  flash.visible = false;
  const waves: Wave[] = [];

  function placeBomb(view: BombView, x: number, y: number, width: number, frame: Frame): void {
    const scale = width / (2 * t.bomb.radius);
    view.body.visible = true;
    setTint(view.body, frame.palette.mage);
    view.body.position.set(x, y);
    view.body.scale.set(scale);
    placeOutline(view.outline, view.body, t.bomb.texture, t.bomb.radius, frame);
    const beat = frame.calm ? 0 : frame.pulse;
    view.spark.visible = true;
    setTint(view.spark, frame.palette.or);
    view.spark.position.set(x + BOMB_FUSE_TIP.x * scale, y + BOMB_FUSE_TIP.y * scale);
    view.spark.scale.set((SPARK_RADIUS * (1 + 0.5 * beat)) / t.vibes.radius);
    view.spark.rotation = frame.calm ? 0 : frame.now * 0.15;
  }

  function placeHalo(halo: Sprite, x: number, y: number, radius: number, frame: Frame): void {
    halo.visible = true;
    setTint(halo, frame.palette.mage);
    halo.position.set(x, y);
    halo.scale.set(radius / t.halo.radius);
  }

  function drawWaves(frame: Frame): void {
    wave.clear();
    flash.visible = false;
    const look = frame.calm ? CALM_WAVE : WAVE;
    const duration = look.bars * frame.tempo.ticksPerBar;
    let kept = 0;
    for (const item of waves) {
      const progress = (frame.now - item.start) / duration;
      if (progress >= 1) {
        continue;
      }
      waves[kept] = item;
      kept += 1;
      if (progress < 0) {
        continue;
      }
      const eased = 1 - (1 - progress) * (1 - progress) * (1 - progress);
      const radius = Math.max(1, item.reach * eased);
      const fade = look.peak * (1 - progress);
      if (look.band > 0) {
        wave.circle(item.x, item.y, radius).stroke({
          width: look.band * (1 - progress) + 4,
          color: frame.palette.mage,
          alpha: fade * 0.35,
        });
        wave
          .circle(item.x, item.y, radius * 0.86)
          .stroke({ width: 3, color: frame.palette.or, alpha: fade * 0.8 });
      }
      wave
        .circle(item.x, item.y, radius)
        .stroke({ width: look.line, color: frame.palette.mage, alpha: fade });
      if (!frame.calm && progress < 0.5) {
        const burst = progress * 2;
        placeHalo(
          flash,
          item.x,
          item.y,
          FLASH_RADIUS.from + (FLASH_RADIUS.to - FLASH_RADIUS.from) * burst,
          frame,
        );
        flash.alpha = (1 - burst) * frame.light.haloAlpha;
      }
    }
    waves.length = kept;
  }

  function reset(): void {
    waves.length = 0;
    wave.clear();
    flash.visible = false;
  }

  return {
    onEvent(event: SimEvent, state: SimState): void {
      if (event.type === 'bombExploded') {
        const reach = farthestCorner(state.arena, event.x, event.y);
        waves.push({ x: event.x, y: event.y, start: state.tick, reach });
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const beat = frame.calm ? 0 : frame.pulse;
      lying.begin();
      for (const bomb of state.bombs ?? []) {
        const view = lying.acquire(bomb.id);
        const fading = !frame.calm && bomb.ticksLeft < FADING_BARS * frame.tempo.ticksPerBar;
        const shown = fading ? 0.45 + 0.55 * frame.pulse : 1;
        placeBomb(view, bomb.x, bomb.y, BOMB_WIDTH * (1 + 0.06 * beat), frame);
        view.body.alpha = view.outline.alpha = view.spark.alpha = shown;
        placeHalo(view.halo, bomb.x, bomb.y, HALO_RADIUS, frame);
        view.halo.alpha = (0.7 + 0.3 * beat) * frame.light.haloAlpha * shown;
      }
      lying.end();

      carriers.begin();
      for (const enemy of state.enemies) {
        if (enemy.carriesBomb !== true) {
          continue;
        }
        const view = carriers.acquire(enemy.id);
        const x = lerp(enemy.prevX, enemy.x, alpha);
        const y = lerp(enemy.prevY, enemy.y, alpha);
        placeHalo(view.halo, x, y, enemy.radius * 2.6, frame);
        view.halo.alpha = frame.light.haloAlpha;
        view.ring.visible = true;
        setTint(view.ring, frame.palette.mage);
        view.ring.position.set(x, y);
        view.ring.scale.set((enemy.radius + CARRIER_GAP) / t.ring.radius);
        view.ring.alpha = 0.85 + 0.15 * beat;
        const lift = enemy.radius + CARRIER_BOMB_LIFT + 3 * beat;
        placeBomb(view, x, y - lift, CARRIER_BOMB_WIDTH, frame);
      }
      carriers.end();

      drawWaves(frame);
    },
    reset,
    destroy(): void {
      lying.begin();
      lying.end();
      carriers.begin();
      carriers.end();
      wave.destroy();
      flash.destroy();
    },
  };
}
