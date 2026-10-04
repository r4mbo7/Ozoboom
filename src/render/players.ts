import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { lerp } from './motion';
import { add, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

export function createPlayers(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const views = new ViewPool(
    () => ({
      halo: add(layers.glow, t.halo),
      outline: add(layers.players, t.playerRing),
      body: add(layers.players, t.player),
      aim: add(layers.players, t.aim),
    }),
    (view) => {
      hide(view.halo, view.outline, view.body, view.aim);
    },
  );

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light, pulse } = frame;
      views.begin();
      for (const player of state.players) {
        const view = views.acquire(player.id);
        const color = palette[lookup(ctx.classTokens, player.classId, 'class')];
        const x = lerp(player.prevX, player.x, alpha);
        const y = lerp(player.prevY, player.y, alpha);
        const { body, halo, aim, outline } = view;
        body.visible = true;
        body.texture = player.downed ? t.playerDowned.texture : t.player.texture;
        setTint(body, color);
        body.position.set(x, y);
        body.scale.set(player.radius / t.player.radius);
        body.alpha = player.downed ? 0.6 + 0.4 * pulse : 1;
        placeOutline(outline, body, t.playerRing.texture, t.playerRing.radius, frame);

        halo.visible = !player.downed;
        setTint(halo, color);
        halo.position.set(x, y);
        halo.scale.set(((player.radius * 3.2) / t.halo.radius) * (1 + 0.1 * pulse));
        halo.alpha = light.haloAlpha;

        aim.visible = !player.downed;
        setTint(aim, color);
        const reach = player.radius + 10;
        aim.position.set(x + player.aim.x * reach, y + player.aim.y * reach);
        aim.rotation = Math.atan2(player.aim.y, player.aim.x);
        aim.scale.set(player.radius / 24);
      }
      views.end();
    },
    destroy(): void {
      layers.players.destroy({ children: true });
    },
  };
}
