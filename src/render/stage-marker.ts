import { Container, Graphics } from 'pixi.js';
import type { SimState } from '../sim/state';
import { type EdgeMarker, edgeMarker } from './camera';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { add, placeOutline, setTint } from './util';
import {
  SEGMENTS,
  drawSegments,
  litSegments,
  litShare,
  percentText,
  placeLabel,
  stageColor,
} from './vu-meter';

const INSET = 34;
const SIZE = 1.25;
const HALO = 40;
const RING_OFFSET = 40;
const RING_RADIUS = 14;
const SEGMENT_WIDTH = 5;
const RIM_GROW = 2;
const LABEL_GAP = 3;

// Screen space: while the scene is out of view, an arrow on the border toward it, with its VU-meter in small.
export function createStageMarker(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const root = layers.screen.addChild(new Container());
  const halo = add(root, textures.halo);
  const outline = add(root, textures.arrow);
  const arrow = add(root, textures.arrow);
  const track = new Graphics();
  const rim = new Graphics();
  const lit = new Graphics();
  root.addChild(track, rim, lit);
  const percent = { edge: add(root, textures.halo), fill: add(root, textures.halo) };
  const parts = [halo, outline, arrow, track, rim, lit, percent.edge, percent.fill];
  drawSegments(track, RING_RADIUS, 0, SEGMENTS, SEGMENT_WIDTH);
  const marker: EdgeMarker = { x: 0, y: 0, angle: 0 };
  let drawn = Number.NaN;

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      const { core } = state;
      const shown = edgeMarker(frame.camera, core, INSET, marker);
      for (const part of parts) {
        part.visible = shown;
      }
      if (!shown) {
        return;
      }
      const { palette, light, pulse } = frame;
      const segments = litSegments(core);
      if (segments !== drawn) {
        drawn = segments;
        drawSegments(lit, RING_RADIUS, 0, segments, SEGMENT_WIDTH);
        drawSegments(rim, RING_RADIUS, 0, segments, SEGMENT_WIDTH + RIM_GROW);
      }
      const color = stageColor(palette, litShare(core));

      setTint(arrow, color);
      arrow.position.set(marker.x, marker.y);
      arrow.rotation = marker.angle;
      arrow.scale.set(SIZE * (1 + 0.12 * pulse));
      placeOutline(outline, arrow, textures.arrow.texture, textures.arrow.radius, frame);

      const blend = light.additive ? 'add' : 'normal';
      if (halo.blendMode !== blend) {
        halo.blendMode = blend;
      }
      setTint(halo, color);
      halo.position.set(marker.x, marker.y);
      halo.scale.set(HALO / textures.halo.radius);
      halo.alpha = light.haloAlpha;

      const x = marker.x - Math.cos(marker.angle) * RING_OFFSET;
      const y = marker.y - Math.sin(marker.angle) * RING_OFFSET;
      for (const ring of [track, rim, lit]) {
        ring.position.set(x, y);
      }
      setTint(track, color);
      setTint(lit, color);
      setTint(rim, palette.texte);
      track.alpha = 0.25;
      rim.visible = !light.additive && segments > 0;

      const top = y + RING_RADIUS + (SEGMENT_WIDTH + RIM_GROW) / 2 + LABEL_GAP;
      placeLabel(textures, percent, percentText(core), palette.texte, x, top, 1, frame);
    },
    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
