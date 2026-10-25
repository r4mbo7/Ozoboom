import { lerp } from '../shared/scalar';
import type { SimState } from '../sim/state';
import { type EdgeMarker, edgeMarker } from './camera';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { add, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const INSET = 34;
const SIZE = 1.25;
const HALO = 40;
const FIREFLIES = [
  { along: -26, across: -7, phase: 0 },
  { along: -34, across: 4, phase: 2.1 },
  { along: -24, across: 9, phase: 4.2 },
] as const;
const FIREFLY_SIZE = 1.5;
const FIREFLY_HALO = 11;
const TAU = Math.PI * 2;

export function arrowFireflyAlpha(beats: number, phase: number, calm: boolean): number {
  return calm ? 0.85 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((beats / 2) * TAU + phase));
}

export function createMarkers(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const root = layers.screen;
  const views = new ViewPool(
    () => ({
      halo: add(root, textures.halo),
      outline: add(root, textures.arrow),
      arrow: add(root, textures.arrow),
      flies: FIREFLIES.map(() => ({
        halo: add(root, textures.halo),
        core: add(root, textures.players.downed.firefly),
      })),
    }),
    (view) => {
      hide(view.halo, view.outline, view.arrow);
      for (const { halo, core } of view.flies) {
        hide(halo, core);
      }
    },
  );
  const marker: EdgeMarker = { x: 0, y: 0, angle: 0 };
  const point = { x: 0, y: 0 };

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light, pulse } = frame;
      views.begin();
      for (const player of state.players) {
        point.x = lerp(player.prevX, player.x, alpha);
        point.y = lerp(player.prevY, player.y, alpha);
        if (!edgeMarker(frame.camera, point, INSET, marker)) {
          continue;
        }
        const { halo, outline, arrow, flies } = views.acquire(player.id);
        const color = palette[lookup(ctx.classTokens, player.classId, 'class')];

        arrow.visible = true;
        setTint(arrow, color);
        arrow.position.set(marker.x, marker.y);
        arrow.rotation = marker.angle;
        arrow.scale.set(SIZE * (1 + 0.12 * pulse));
        placeOutline(outline, arrow, textures.arrow.texture, textures.arrow.radius, frame);

        const blend = light.additive ? 'add' : 'normal';
        if (halo.blendMode !== blend) {
          halo.blendMode = blend;
        }
        halo.visible = true;
        setTint(halo, color);
        halo.position.set(marker.x, marker.y);
        halo.scale.set(HALO / textures.halo.radius);
        halo.alpha = light.haloAlpha;

        const cos = Math.cos(marker.angle);
        const sin = Math.sin(marker.angle);
        const beats = frame.now / frame.tempo.ticksPerBeat;
        for (const [index, fly] of flies.entries()) {
          const spot = FIREFLIES[index];
          fly.halo.visible = fly.core.visible = player.downed && spot !== undefined;
          if (spot === undefined || !player.downed) {
            continue;
          }
          const x = marker.x + spot.along * cos - spot.across * sin;
          const y = marker.y + spot.along * sin + spot.across * cos;
          const shine = arrowFireflyAlpha(beats, spot.phase, frame.calm);
          setTint(fly.core, color);
          fly.core.position.set(x, y);
          fly.core.scale.set(FIREFLY_SIZE);
          fly.core.alpha = shine;
          if (fly.halo.blendMode !== blend) {
            fly.halo.blendMode = blend;
          }
          setTint(fly.halo, color);
          fly.halo.position.set(x, y);
          fly.halo.scale.set(FIREFLY_HALO / textures.halo.radius);
          fly.halo.alpha = light.haloAlpha * shine;
        }
      }
      views.end();
    },
    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
