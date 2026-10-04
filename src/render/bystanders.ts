import type { Family, RenderContext } from './context';

export function createBystanders(ctx: RenderContext): Family {
  return {
    update: () => undefined,
    destroy(): void {
      ctx.layers.bystanders.destroy({ children: true });
    },
  };
}
