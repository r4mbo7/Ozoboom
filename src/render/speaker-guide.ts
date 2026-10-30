import { Container, Graphics } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { SimState, SpeakerState, Vec2 } from '../sim/state';
import { worldToScreen } from './camera';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { speakerToken } from './speaker-kit';
import { add, placeOutline, setTint } from './util';

// Screen pixels from the player's middle to the arrow.
const REACH = 64;
const SIZE = 1.6;
// Dots of the path from the arrow to the zone, in screen pixels, gliding one gap per beat.
const DOT_GAP = 30;
const DOT_RADIUS = 3.5;
const RING_WIDTH = 4;
const RING_GROW = 0.06;

function nearestOff(speakers: readonly SpeakerState[], from: Vec2): SpeakerState | null {
  let nearest: SpeakerState | null = null;
  let best = Infinity;
  for (const speaker of speakers) {
    const distance = Math.hypot(speaker.x - from.x, speaker.y - from.y);
    if (!speaker.plugged && distance < best) {
      nearest = speaker;
      best = distance;
    }
  }
  return nearest;
}

// The tutorial asks to plug a speaker: an arrow by the player points to the nearest one still off,
// a path of dots glides to it, and its zone beats until the player stands in it.
export function createSpeakerGuide(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const root = layers.screen.addChild(new Container());
  const ring = new Graphics();
  const path = new Graphics();
  root.addChild(ring, path);
  const outline = add(root, textures.arrow);
  const arrow = add(root, textures.arrow);
  const point = { x: 0, y: 0 };

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const player = state.players[0];
      const target =
        ctx.options.guideToSpeaker === true && player !== undefined && !player.downed
          ? nearestOff(state.speakers ?? [], player)
          : null;
      root.visible = target !== null;
      if (target === null || player === undefined) {
        return;
      }
      const { camera, palette, pulse } = frame;
      const color = palette[speakerToken(target.id)];
      const zone = worldToScreen(camera, target);
      ring.clear();
      ring
        .circle(0, 0, target.radius * camera.scale * (1 + RING_GROW * pulse))
        .stroke({ width: RING_WIDTH, color: 0xffffff, alpha: 0.55 + 0.45 * pulse });
      ring.position.set(zone.x, zone.y);
      setTint(ring, color);

      point.x = lerp(player.prevX, player.x, alpha);
      point.y = lerp(player.prevY, player.y, alpha);
      const inside = Math.hypot(target.x - point.x, target.y - point.y) <= target.radius;
      arrow.visible = outline.visible = path.visible = !inside;
      if (inside) {
        return;
      }
      const at = worldToScreen(camera, point);
      const angle = Math.atan2(zone.y - at.y, zone.x - at.x);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      path.clear();
      const glide = frame.calm ? 0 : ((frame.now / frame.tempo.ticksPerBeat) % 1) * DOT_GAP;
      const end = Math.hypot(zone.x - at.x, zone.y - at.y) - target.radius * camera.scale;
      for (let along = REACH + DOT_GAP + glide; along < end; along += DOT_GAP) {
        path.circle(at.x + cos * along, at.y + sin * along, DOT_RADIUS);
      }
      path.fill({ color: 0xffffff, alpha: 0.7 });
      setTint(path, color);
      arrow.position.set(at.x + cos * REACH, at.y + sin * REACH);
      arrow.rotation = angle;
      arrow.scale.set(SIZE * (1 + 0.12 * pulse));
      setTint(arrow, color);
      placeOutline(outline, arrow, textures.arrow.texture, textures.arrow.radius, frame);
    },
    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
