import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../shared/i18n';
import { lerp } from '../shared/scalar';
import type { Tempo } from '../shared/tempo';
import type { SimState, SpeakerState, Vec2 } from '../sim/state';
import { worldToScreen } from './camera';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { isNear } from './speaker-card';
import { speakerToken } from './speaker-kit';
import { NAME_TEXTURE_SCALE, type NameLabel } from './textures-names';
import { add, placeOutline, setTint } from './util';

// Screen pixels from the player's middle to the arrow.
const REACH = 64;
const SIZE = 1.6;
// Dots of the path from the arrow to the zone, in screen pixels, gliding one gap per beat.
const DOT_GAP = 30;
const DOT_RADIUS = 3.5;
const RING_WIDTH = 4;
const RING_GROW = 0.06;
const FLOOR_ALPHA = 0.16;
// The beacon over the zone, in screen pixels: a pin whose head carries « ici », tapping down on the beat.
const PIN_HEAD = 24;
const PIN_TIP = 36;
const PIN_LIFT = 10;
const PIN_TAP = 8;
const PIN_EDGE = 3;
const PIN_WORD = 1.55;
// The top of the screen the ribbon and the banner hold: a pin that would reach it goes below the zone.
const PIN_TOP_SHARE = 0.24;
// The beats left to plug, above the player's head: big inside the zone, small and pale once out.
const COUNT_ABOVE = 58;
const COUNT_SIZE = 2.3;
const COUNT_POP = 0.45;
const COUNT_POP_BEATS = 0.3;
const COUNT_OUT = { size: 0.8, alpha: 0.75 };

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

// The beats a speaker still needs to plug, from all of them for an empty charge down to 1.
export function beatsLeft(plugTicks: number, plugBars: number, tempo: Tempo): number {
  const needed = plugBars * tempo.ticksPerBar;
  return Math.max(1, Math.ceil((needed - plugTicks) / tempo.ticksPerBeat));
}

interface Label {
  readonly fill: Sprite;
  readonly edge: Sprite;
}

function label(parent: Container): Label {
  const edge = parent.addChild(new Sprite());
  const fill = parent.addChild(new Sprite());
  edge.anchor.set(0.5);
  fill.anchor.set(0.5);
  return { fill, edge };
}

function placeLabel(
  { fill, edge }: Label,
  texts: NameLabel,
  at: Vec2,
  size: number,
  colors: { fill: number; edge: number },
  alpha: number,
): void {
  fill.texture = texts.fill;
  edge.texture = texts.edge;
  for (const sprite of [fill, edge]) {
    sprite.position.set(at.x, at.y);
    sprite.scale.set(size / NAME_TEXTURE_SCALE);
  }
  setTint(fill, colors.fill);
  setTint(edge, colors.edge);
  fill.alpha = alpha;
  edge.alpha = alpha;
}

// The tutorial asks to plug a speaker: an arrow by the player points to the nearest one still off,
// a path of dots glides to it, its zone beats and lights its floor under a beacon « ici » until the
// player comes near or stands in it; there, the beats left to plug count down above the player's head.
export function createSpeakerGuide(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const root = layers.screen.addChild(new Container());
  const ring = new Graphics();
  const path = new Graphics();
  const pin = new Graphics();
  root.addChild(ring, path, pin);
  const word = label(root);
  const outline = add(root, textures.arrow);
  const arrow = add(root, textures.arrow);
  const count = label(root);
  const point = { x: 0, y: 0 };
  // The beats left last drawn, and the tick they changed, so that each new one pops.
  let shown = 0;
  let shownSince = 0;

  function drawPin(zone: Vec2, reach: number, color: number, frame: Frame): void {
    const { palette, light, pulse, calm, camera } = frame;
    const edge = light.additive ? palette.sol : palette.texte;
    // Above the zone, pointing down; below it, pointing up, when the top of the screen has no room.
    const room = zone.y - reach - PIN_LIFT - PIN_TIP - 2 * PIN_HEAD;
    const down = room >= camera.screenHeight * PIN_TOP_SHARE ? 1 : -1;
    const tipY = zone.y - down * (reach + PIN_LIFT - (calm ? 0 : PIN_TAP * pulse));
    const headY = tipY - down * PIN_TIP;
    const baseY = headY + down * PIN_HEAD * 0.6;
    const side = PIN_HEAD * 0.8;
    const shape = [zone.x - side, baseY, zone.x + side, baseY, zone.x, tipY];
    pin.clear();
    pin
      .poly(shape)
      .circle(zone.x, headY, PIN_HEAD)
      .stroke({ width: 2 * PIN_EDGE, color: edge, alpha: 0.9, join: 'round' });
    pin.poly(shape).circle(zone.x, headY, PIN_HEAD).fill({ color });
    placeLabel(
      word,
      textures.names.get(t('ici')),
      { x: zone.x, y: headY },
      PIN_WORD,
      { fill: palette.sol, edge: color },
      1,
    );
  }

  function drawCount(
    target: SpeakerState,
    at: Vec2,
    inside: boolean,
    color: number,
    frame: Frame,
  ): void {
    const plugBars = frame.set.speakers?.find((speaker) => speaker.id === target.id)?.plugBars;
    const visible = plugBars !== undefined && (inside || target.plugTicks > 0);
    count.fill.visible = count.edge.visible = visible;
    if (!visible) {
      shown = 0;
      return;
    }
    const left = beatsLeft(target.plugTicks, plugBars, frame.tempo);
    if (left !== shown) {
      shown = left;
      shownSince = frame.now;
    }
    const age = (frame.now - shownSince) / frame.tempo.ticksPerBeat;
    const pop =
      inside && !frame.calm && age < COUNT_POP_BEATS ? COUNT_POP * (1 - age / COUNT_POP_BEATS) : 0;
    const { palette, light } = frame;
    placeLabel(
      count,
      textures.names.get(String(left)),
      { x: at.x, y: at.y - COUNT_ABOVE },
      COUNT_SIZE * (inside ? 1 : COUNT_OUT.size) * (1 + pop),
      { fill: color, edge: light.additive ? palette.sol : palette.texte },
      inside ? 1 : COUNT_OUT.alpha,
    );
    count.edge.alpha *= light.additive ? 0.7 : 0.9;
  }

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      const player = state.players[0];
      const target =
        ctx.options.guideToSpeaker === true && player !== undefined && !player.downed
          ? nearestOff(state.speakers ?? [], player)
          : null;
      root.visible = target !== null;
      if (target === null || player === undefined) {
        shown = 0;
        return;
      }
      const { camera, palette, pulse } = frame;
      const color = palette[speakerToken(target.id)];
      const zone = worldToScreen(camera, target);
      const reach = target.radius * camera.scale;
      point.x = lerp(player.prevX, player.x, alpha);
      point.y = lerp(player.prevY, player.y, alpha);
      const inside = Math.hypot(target.x - point.x, target.y - point.y) <= target.radius;
      const at = worldToScreen(camera, point);

      ring.clear();
      if (!inside) {
        ring
          .circle(0, 0, reach)
          .fill({ color: 0xffffff, alpha: FLOOR_ALPHA * (0.6 + 0.4 * pulse) });
      }
      ring
        .circle(0, 0, reach * (1 + RING_GROW * pulse))
        .stroke({ width: RING_WIDTH, color: 0xffffff, alpha: 0.55 + 0.45 * pulse });
      ring.position.set(zone.x, zone.y);
      setTint(ring, color);
      drawCount(target, at, inside, color, frame);

      arrow.visible = outline.visible = path.visible = !inside;
      // Close by, the speaker's card stands over it and points to it: the beacon steps aside.
      const beacon = !inside && !isNear(target, state.players);
      pin.visible = word.fill.visible = word.edge.visible = beacon;
      if (inside) {
        return;
      }
      if (beacon) {
        drawPin(zone, reach, color, frame);
      }
      const angle = Math.atan2(zone.y - at.y, zone.x - at.x);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      path.clear();
      const glide = frame.calm ? 0 : ((frame.now / frame.tempo.ticksPerBeat) % 1) * DOT_GAP;
      const end = Math.hypot(zone.x - at.x, zone.y - at.y) - reach;
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
