import type { SimState } from '../sim/state';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { add, placeOutline, setTint } from './util';

const TAU = Math.PI * 2;
const FLASH_TICKS = TICKS_PER_BEAT / 2;
const FADE_TICKS = TICKS_PER_BEAT;
const RAY_TURN_TICKS = TICKS_PER_BAR * 4;

export function createCore(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const rays = [add(layers.glow, t.coreRay, 0), add(layers.glow, t.coreRay, 0)] as const;
  const halo = add(layers.glow, t.halo);
  const outline = add(layers.core, t.core);
  const body = add(layers.core, t.core);
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

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      const { core } = state;
      const { pulse, palette, light } = frame;
      body.position.set(core.x, core.y);
      body.scale.set((core.radius / t.core.radius) * (1 + 0.05 * pulse));
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
