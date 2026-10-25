import type { Container, Sprite } from 'pixi.js';
import { frac, smoothstep } from '../shared/scalar';
import type { ClassDrawing, PaintedDrawing } from './drawings';
import { type Shape, TAU, paintSheet } from './paint';
import { type Look, fade } from './player-look';
import type { Textures } from './textures';
import { REFERENCE_RADIUS } from './textures-looks';
import { add, hide, placeOutline, setTint } from './util';
import { CREAM, HAIR, HANDS, HEAD, HEART_SIZE, KIFFEUR_PIECES, UNIT } from './kiffeur-paint';

type Parts = Readonly<Record<keyof typeof KIFFEUR_PIECES, Shape>>;

const EXTENT = 42;
const MIDDLE = 2;
const BOB_TICKS = 2;
const BEAT_SWELL = 0.05;
const COLLAR_TURN = 0.2;
const CALM = { swing: 0.35, swell: 0.3, turn: 0.5 };
const PORTRAIT_RING = { from: 9, to: 33, alpha: 0.55, width: 3 };
const HEARTS = { count: 4, spread: 21, low: 25, high: -33, beats: 4, sway: 1.8, size: 0.7 };

function createDancerLook(
  bodies: Container,
  glows: Container,
  textures: Textures,
  parts: Parts,
): Look {
  const hearts = Array.from({ length: HEARTS.count }, () => add(bodies, parts.heart));
  const outline = add(bodies, parts.torso);
  const torso = add(bodies, parts.torso);
  const flowersEven = add(bodies, parts.flowersEven);
  const flowersOdd = add(bodies, parts.flowersOdd);
  const swingLeft = add(bodies, parts.swingLeft);
  const swingRight = add(bodies, parts.swingRight);
  const leftHand = add(bodies, parts.hand);
  const rightHand = add(bodies, parts.hand);
  const head = add(bodies, parts.head);
  const hair = add(bodies, parts.hair);
  const ring = add(glows, textures.ring);
  const body = [
    torso,
    flowersEven,
    flowersOdd,
    swingLeft,
    swingRight,
    leftHand,
    rightHand,
    head,
    hair,
  ];
  let originX = 0;
  let originY = 0;
  let cos = 1;
  let sin = 0;
  let size = 1;
  let facing = 0;

  function put(sprite: Sprite, along: number, across: number, turn = 0): void {
    sprite.position.set(
      originX + (along * cos - across * sin) * UNIT * size,
      originY + (along * sin + across * cos) * UNIT * size,
    );
    sprite.rotation = facing + turn;
    sprite.scale.set(size);
  }

  return {
    hide() {
      hide(...body, outline, ring, ...hearts);
    },
    place(input) {
      const { x, y, angle, scale, color, frame } = input;
      const { now, calm, palette, tempo, camera } = frame;
      const beats = now / tempo.ticksPerBeat;
      const swell = fade(input.sinceBeat, BOB_TICKS) * BEAT_SWELL * (calm ? CALM.swell : 1);
      originX = x;
      originY = y;
      cos = Math.cos(angle);
      sin = Math.sin(angle);
      size = scale * (1 + swell);
      facing = angle;
      for (const sprite of body) {
        sprite.visible = true;
      }

      put(torso, 0, 0);
      setTint(torso, color);
      placeOutline(outline, torso, parts.torso.texture, REFERENCE_RADIUS, frame);

      const turn = beats * COLLAR_TURN * (calm ? CALM.turn : 1);
      put(flowersEven, HEAD.along, 0, turn);
      setTint(flowersEven, palette.mage);
      put(flowersOdd, HEAD.along, 0, turn);
      setTint(flowersOdd, CREAM);

      const swing = Math.sin(TAU * beats) * HANDS.swing * (calm ? CALM.swing : 1);
      put(leftHand, HANDS.along + swing, -HANDS.across);
      put(rightHand, HANDS.along - swing, HANDS.across);
      setTint(leftHand, input.teint);
      setTint(rightHand, input.teint);
      put(swingLeft, HANDS.along + swing, -HANDS.across);
      put(swingRight, HANDS.along - swing, HANDS.across);
      for (const trace of [swingLeft, swingRight]) {
        trace.alpha = 0.6;
        setTint(trace, color);
      }

      put(head, HEAD.along, 0);
      setTint(head, input.teint);
      put(hair, HEAD.hair, 0);
      setTint(hair, HAIR);

      ring.visible = frame.portrait && !calm;
      for (const heart of hearts) {
        heart.visible = frame.portrait;
      }
      if (!frame.portrait) {
        return 0;
      }
      const unit = UNIT * scale;
      const half = Math.min(camera.screenWidth, camera.screenHeight) / (2 * camera.scale);
      const room = Math.max(0, half / unit - HEART_SIZE / UNIT);
      if (ring.visible) {
        const beat = frac(beats);
        const eased = smoothstep(beat);
        const radius = Math.min(PORTRAIT_RING.to, room) * eased + PORTRAIT_RING.from * (1 - eased);
        ring.position.set(x, y);
        ring.scale.set((radius * unit) / textures.ring.radius);
        ring.alpha = PORTRAIT_RING.alpha * (1 - beat);
        setTint(ring, color);
      }
      const spread = Math.min(HEARTS.spread, room);
      const low = Math.min(HEARTS.low, room);
      const high = Math.max(HEARTS.high, -room);
      hearts.forEach((heart, index) => {
        const rise = (beats / HEARTS.beats + index / HEARTS.count) % 1;
        const across = -spread + (2 * spread * index) / (HEARTS.count - 1);
        const sway = calm ? 0 : Math.sin(rise * 6 + index) * HEARTS.sway;
        heart.position.set(x + (across + sway) * unit, y + (low + (high - low) * rise) * unit);
        heart.rotation = 0;
        heart.scale.set(scale * HEARTS.size);
        heart.alpha = Math.min(1, 4 * rise, 4 * (1 - rise));
        setTint(heart, index % 2 === 0 ? color : palette.mage);
      });
      return 0;
    },
  };
}

export const KIFFEUR_DRAWING: ClassDrawing = {
  classId: 'kiffeur',
  paint(density): PaintedDrawing {
    const { shapes, source } = paintSheet(KIFFEUR_PIECES, density);
    return {
      aimless: true,
      extent: EXTENT,
      height: 1,
      centerAhead: MIDDLE,
      shadow: shapes.shadow,
      source,
      create: (bodies: Container, glows: Container, textures: Textures) =>
        createDancerLook(bodies, glows, textures, shapes),
    };
  },
};
