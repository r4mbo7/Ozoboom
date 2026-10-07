import type { Container, Sprite } from 'pixi.js';
import { type Look, type Spawn, angleTo, fade, spring } from './player-look';
import type { Textures } from './textures';
import { BAG_BACK, MAT_BACK, MUG_HOOK, REFERENCE } from './textures-looks';
import { add, hide, placeOutline, setTint } from './util';

// Springs in reference pixels and ticks: the bag lags and bounces, the mug swings, the bag squashes.
const BAG = { stiffness: 0.42, damping: 0.5, lag: 0.9, reach: 7, bounce: 1.6 };
const MUG = { stiffness: 0.08, damping: 0.06, step: 0.25, turn: 0.6, hit: 0.5 };
const SQUISH = { stiffness: 0.6, damping: 0.35, hit: 0.12, most: 0.2 };
const STEP_TICKS = 1.5;
const STEP_MOVING = 0.35;

// Slots of the spring state.
const BAG_X = 0;
const BAG_Y = 2;
const MUG_ANGLE = 4;
const SQUISH_AT = 6;

// Le Nounours: a festival-goer with a huge camping bag on his back. A heavy step on every beat
// while he walks, the bag following on a spring, the mug swinging on its hook.
export function createBagLook(bodies: Container, textures: Textures, spawn: Spawn): Look {
  const t = textures.players;
  const parts = t.bag;
  const packOutline = add(bodies, parts.pack);
  const pack = add(bodies, parts.pack);
  const mat = add(bodies, parts.mat);
  const mug = add(bodies, parts.mug, 0.5);
  const torsoOutline = add(bodies, parts.torso);
  const torso = add(bodies, parts.torso);
  const hands = add(bodies, parts.hands);
  const head = add(bodies, t.head);
  const hat = add(bodies, parts.hat);
  const sprites = [packOutline, pack, mat, mug, torsoOutline, torso, hands, head, hat];
  const springs = new Float64Array(8);
  let fresh = true;
  let lastBeat = -1;
  let lastAngle = 0;
  let lastHitAt = Number.NaN;
  let stepAt = Number.NEGATIVE_INFINITY;
  let foot = 1;
  // The frame of the player for this image: where a point of its reference drawing lands.
  let originX = 0;
  let originY = 0;
  let cos = 1;
  let sin = 0;
  let size = 1;
  let facing = 0;

  function put(sprite: Sprite, along: number, across: number, turn: number): void {
    sprite.position.set(
      originX + (along * cos - across * sin) * size,
      originY + (along * sin + across * cos) * size,
    );
    sprite.rotation = facing + turn;
  }

  return {
    reset() {
      springs.fill(0);
      fresh = true;
      lastBeat = -1;
      lastHitAt = Number.NaN;
      stepAt = Number.NEGATIVE_INFINITY;
    },
    hide() {
      hide(...sprites);
    },
    place(input) {
      const { player, x, y, angle, scale, color, frame, dt } = input;
      originX = x;
      originY = y;
      cos = Math.cos(angle);
      sin = Math.sin(angle);
      size = scale;
      facing = angle;

      if (input.beatIndex !== lastBeat) {
        if (!fresh && input.moving > STEP_MOVING) {
          stepAt = frame.now;
          foot = -foot;
          springs[BAG_X + 1] = (springs[BAG_X + 1] ?? 0) - BAG.bounce;
          springs[MUG_ANGLE + 1] = (springs[MUG_ANGLE + 1] ?? 0) + foot * MUG.step;
          const footX = x - sin * foot * 12 * scale;
          const footY = y + cos * foot * 12 * scale;
          spawn(frame, {
            shape: textures.halo,
            now: frame.now,
            duration: 8,
            x: footX,
            y: footY,
            fromRadius: 4 * scale,
            toRadius: 18 * scale,
            tint: frame.palette.texte,
            peak: 0.22,
          });
          spawn(frame, {
            shape: textures.ring,
            now: frame.now,
            duration: 6,
            x: footX,
            y: footY,
            fromRadius: 8 * scale,
            toRadius: 30 * scale,
            tint: color,
            peak: 0.3,
          });
        }
        lastBeat = input.beatIndex;
      }
      const hitAt = frame.now - input.sinceHit;
      if (Number.isFinite(hitAt) && hitAt !== lastHitAt && !fresh) {
        springs[SQUISH_AT + 1] = (springs[SQUISH_AT + 1] ?? 0) + SQUISH.hit;
        springs[MUG_ANGLE + 1] = (springs[MUG_ANGLE + 1] ?? 0) + MUG.hit;
      }
      lastHitAt = hitAt;
      if (!fresh) {
        springs[MUG_ANGLE + 1] =
          (springs[MUG_ANGLE + 1] ?? 0) - angleTo(lastAngle, angle) * MUG.turn;
      }
      lastAngle = angle;
      fresh = false;

      const along = ((player.x - player.prevX) * cos + (player.y - player.prevY) * sin) / scale;
      const across = (-(player.x - player.prevX) * sin + (player.y - player.prevY) * cos) / scale;
      const lagX = Math.max(-BAG.reach, Math.min(BAG.reach, -along * BAG.lag));
      const lagY = Math.max(-BAG.reach, Math.min(BAG.reach, -across * BAG.lag));
      spring(springs, BAG_X, lagX, BAG.stiffness, BAG.damping, dt);
      spring(springs, BAG_Y, lagY, BAG.stiffness, BAG.damping, dt);
      spring(springs, MUG_ANGLE, 0, MUG.stiffness, MUG.damping, dt);
      spring(springs, SQUISH_AT, 0, SQUISH.stiffness, SQUISH.damping, dt);
      const bagX = springs[BAG_X] ?? 0;
      const bagY = springs[BAG_Y] ?? 0;
      const squish = Math.max(-SQUISH.most, Math.min(SQUISH.most, springs[SQUISH_AT] ?? 0));
      const squash = input.moving * fade(frame.now - stepAt, STEP_TICKS);
      const wide = scale * (1 + 0.06 * squash);
      const short = scale * (1 - 0.05 * squash);

      for (const sprite of sprites) {
        sprite.visible = true;
      }
      put(pack, bagX - BAG_BACK, bagY, 0);
      pack.scale.set(scale * (1 - squish), scale * (1 + squish * 0.6));
      setTint(pack, color);
      placeOutline(packOutline, pack, parts.pack.texture, REFERENCE, frame);
      put(mat, bagX - MAT_BACK, bagY, 0);
      mat.scale.set(scale);
      setTint(mat, frame.palette.turquoise);
      put(mug, bagX - MUG_HOOK.back, bagY + MUG_HOOK.side, Math.PI / 2 + (springs[MUG_ANGLE] ?? 0));
      mug.scale.set(scale);
      setTint(mug, frame.palette.or);

      put(torso, 0, 0, 0);
      torso.scale.set(short, wide);
      setTint(torso, color);
      placeOutline(torsoOutline, torso, parts.torso.texture, REFERENCE, frame);
      put(hands, 0, 0, 0);
      hands.scale.set(short, wide);
      setTint(hands, input.teint);
      put(head, 2, 0, 0);
      head.scale.set(scale * 1.1);
      setTint(head, input.teint);
      put(hat, 2, 0, 0);
      hat.scale.set(scale);
      setTint(hat, frame.palette.or);
      return 0;
    },
  };
}
