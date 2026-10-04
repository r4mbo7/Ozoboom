import type { Family, RenderContext } from './context';

export function createSpeakers(ctx: RenderContext): Family {
  return {
    update: () => undefined,
    destroy(): void {
      ctx.layers.speakers.destroy({ children: true });
    },
  };
}
