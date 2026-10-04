import type { Family, RenderContext } from './context';

export function createWeapons(ctx: RenderContext): Family {
  return {
    update: () => undefined,
    destroy(): void {
      ctx.layers.weapons.destroy({ children: true });
    },
  };
}
