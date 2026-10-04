import { Graphics } from 'pixi.js';
import type { CoreState, SimState } from '../sim/state';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { add, placeOutline, setTint } from './util';

const TAU = Math.PI * 2;
const FLASH_TICKS = TICKS_PER_BEAT / 2;
const FADE_TICKS = TICKS_PER_BEAT;
const RAY_TURN_TICKS = TICKS_PER_BAR * 4;
const RING_GAP = 2;
const RING_LINE = 1.6;
const RIM_WIDTH = 6.4;
const RING_START = -Math.PI / 2;
const RING_REACH = 1.12;

export interface CoreFamily extends Family {
  readonly lit: number;
}

export function litShare(core: Pick<CoreState, 'hp' | 'maxHp'>): number {
  return core.maxHp > 0 ? Math.min(1, Math.max(0, core.hp / core.maxHp)) : 0;
}

function strokeArc(ring: Graphics, radius: number, share: number, width: number): void {
  const end = RING_START + share * TAU;
  ring.moveTo(Math.cos(RING_START) * radius, Math.sin(RING_START) * radius);
  if (share >= 1) {
    ring.circle(0, 0, radius);
  } else {
    ring.arc(0, 0, radius, RING_START, end);
  }
  ring.stroke({ width, color: 0xffffff, cap: 'round' });
}

function drawRing(ring: Graphics, radius: number, share: number): void {
  ring.clear();
  if (share > 0) {
    strokeArc(ring, radius - RING_GAP, share, RING_LINE);
    strokeArc(ring, radius + RING_GAP, share, RING_LINE);
  }
}

export function createCore(ctx: RenderContext): CoreFamily {
  const { textures: t, layers } = ctx;
  const rays = [add(layers.glow, t.coreRay, 0), add(layers.glow, t.coreRay, 0)] as const;
  const halo = add(layers.glow, t.halo);
  const outline = add(layers.core, t.core);
  const body = add(layers.core, t.core);
  const track = new Graphics();
  const rim = new Graphics();
  const arc = new Graphics();
  layers.core.addChild(track, rim, arc);
  const rings = [track, rim, arc];
  const flash = add(layers.fx, t.ring);
  flash.visible = false;
  outline.visible = false;

  function drawFlash(radius: number, x: number, y: number, frame: Frame): void {
    const progress = (frame.now - frame.flashTick) / (frame.calm ? FADE_TICKS : FLASH_TICKS);
    flash.visible = progress >= 0 && progress < 1;
    if (!flash.visible) {
      return;
    }
    flash.position.set(x, y);
    const reach = frame.calm ? 1.15 : 1.05 + 0.75 * (1 - (1 - progress) * (1 - progress));
    flash.scale.set((radius * reach) / t.ring.radius);
    flash.alpha = frame.calm ? 0.6 * Math.sin(progress * Math.PI) : (1 - progress) * (1 - progress);
  }

  let share = 0;
  let drawn = { radius: Number.NaN, share: Number.NaN };

  return {
    get lit() {
      return share;
    },
    update(state: SimState, _alpha: number, frame: Frame): void {
      const { core } = state;
      const { pulse, palette, light } = frame;
      share = litShare(core);
      const ringRadius = core.radius * RING_REACH;
      if (drawn.radius !== ringRadius || drawn.share !== share) {
        drawn = { radius: ringRadius, share };
        drawRing(track, ringRadius, 1);
        drawRing(arc, ringRadius, share);
        rim.clear();
        if (share > 0) {
          strokeArc(rim, ringRadius, share, RIM_WIDTH);
        }
      }
      const swell = 1 + 0.05 * pulse;
      for (const ring of rings) {
        ring.position.set(core.x, core.y);
        ring.scale.set(swell);
      }
      setTint(track, palette.or);
      setTint(arc, palette.or);
      setTint(rim, palette.texte);
      track.alpha = 0.2;
      arc.alpha = 0.75 + 0.25 * pulse;
      rim.visible = !light.additive;
      body.position.set(core.x, core.y);
      body.scale.set((core.radius / t.core.radius) * swell);
      body.rotation = frame.calm ? 0 : (frame.now / RAY_TURN_TICKS) * TAU;
      setTint(body, palette.noyau);
      placeOutline(outline, body, t.core.texture, t.core.radius, frame);

      setTint(halo, palette.noyau);
      halo.position.set(core.x, core.y);
      halo.scale.set(((core.radius * 3.4) / t.halo.radius) * (1 + 0.3 * pulse));
      halo.alpha = (0.55 + 0.45 * pulse) * light.haloAlpha;

      let turn = frame.calm ? Math.PI / 4 : (frame.now / RAY_TURN_TICKS) * TAU;
      for (const ray of rays) {
        setTint(ray, palette.noyau);
        ray.position.set(core.x, core.y);
        ray.rotation = turn;
        ray.scale.set((core.radius * 9) / 256, (core.radius * 1.6) / 32);
        ray.alpha = (0.25 + 0.35 * pulse) * light.haloAlpha;
        turn += Math.PI;
      }

      setTint(flash, palette.or);
      drawFlash(core.radius, core.x, core.y, frame);
    },
    destroy(): void {
      layers.core.destroy({ children: true });
    },
  };
}
