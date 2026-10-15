import { Container, type Sprite } from 'pixi.js';
import { MAIN_TEMPO, type Tempo } from '../shared/tempo';
import { TAU } from './paint';
import { type Look, type Spawn, fade, spring } from './player-look';
import type { Textures } from './textures';
import { POMPOM_STRING, REFERENCE } from './textures-looks';
import { PARASOL_RADIUS } from './textures-players';
import { add, hide, placeOutline, setTint } from './util';

const POMPOMS = 8;
const FIREFLIES = 5;
const RUN_SPIN = 2.8;
// Springs in reference pixels and ticks: the pompoms fly out as the parasol spins faster, lag behind
// the run and bounce on the beat.
const FLING = { stiffness: 0.084, damping: 0.11, reach: 1.6, beat: 0.5, hit: 1.6 };
const LAG = { stiffness: 0.07, damping: 0.14, follow: 1, most: 8 };
const POMPOM_OUT = POMPOM_STRING - 1.5;
const LAND_TICKS = 1.2;
const JELLY_TICKS = 29;
const HOP_MOVING = 0.4;

const FLING_AT = 0;
const LAG_X = 2;
const LAG_Y = 4;

// The pompoms light up one after the other on the sixteenths, a tail of three behind the head; the
// calm mode holds them all at the same glow.
export function chase(
  now: number,
  index: number,
  calm: boolean,
  tempo: Tempo = MAIN_TEMPO,
): number {
  const step = tempo.ticksPerBeat / 4;
  if (calm) {
    return 0.65;
  }
  const head = Math.floor(now / step) % POMPOMS;
  return 0.3 + 0.7 * Math.max(0, 1 - ((head - index + POMPOMS) % POMPOMS) / 3);
}

// L'Hygie: a small hop on every beat while she walks, her sneakers out under the parasol, pompoms
// on springs that light up in turn, a pool of light under her at night and of shade by day.
export function createParasolLook(
  bodies: Container,
  glows: Container,
  textures: Textures,
  spawn: Spawn,
): Look {
  const t = textures.players;
  const object = t.looks.parasol.object;
  if (object === undefined) {
    throw new Error('The parasol look has no object texture');
  }
  const pool = add(glows, textures.halo);
  const lights: Sprite[] = [];
  const fireflies: Sprite[] = [];
  for (let index = 0; index < POMPOMS; index += 1) {
    lights.push(add(glows, textures.halo));
  }
  for (let index = 0; index < FIREFLIES; index += 1) {
    fireflies.push(add(glows, textures.halo));
  }
  const feet = [add(bodies, t.parasol.sneaker), add(bodies, t.parasol.sneaker)] as const;
  const canopy = bodies.addChild(new Container());
  const outline = add(canopy, object);
  const parasol = add(canopy, object);
  const pompoms: Sprite[] = [];
  for (let index = 0; index < POMPOMS; index += 1) {
    pompoms.push(add(bodies, t.parasol.pompom));
  }
  const sprites = [pool, ...lights, ...fireflies, ...feet, outline, parasol, ...pompoms];
  const springs = new Float64Array(6);
  let fresh = true;
  let spin = 0;
  let rate = Number.NaN;
  let lastBeat = -1;
  let landAt = Number.NEGATIVE_INFINITY;
  let lastHitAt = Number.NaN;
  let jellyAt = Number.NEGATIVE_INFINITY;
  let foot = 0;

  return {
    reset() {
      springs.fill(0);
      fresh = true;
      rate = Number.NaN;
      lastBeat = -1;
      landAt = jellyAt = Number.NEGATIVE_INFINITY;
      lastHitAt = Number.NaN;
    },
    hide() {
      hide(...sprites);
      canopy.visible = false;
    },
    place(input) {
      const { player, x, y, angle, scale, color, frame, dt } = input;
      const { now, calm, light, palette } = frame;
      const strength = calm ? 0.5 : 1;
      const run = Math.min(1, input.speed) * input.moving;
      const baseSpin = TAU / (2 * frame.tempo.ticksPerBar);
      if (Number.isNaN(rate)) {
        rate = baseSpin;
      }
      rate += (baseSpin * (1 + RUN_SPIN * run) - rate) * (1 - Math.exp(-dt * 0.1));
      spin += rate * dt;

      if (input.beatIndex !== lastBeat) {
        if (!fresh && input.moving > HOP_MOVING) {
          landAt = now;
          foot = 1 - foot;
          springs[FLING_AT + 1] = (springs[FLING_AT + 1] ?? 0) + FLING.beat;
          spawn(frame, {
            shape: textures.ring,
            now,
            duration: 5,
            x,
            y,
            fromRadius: 34 * scale,
            toRadius: 56 * scale,
            tint: color,
            peak: 0.35,
          });
        }
        lastBeat = input.beatIndex;
      }
      const hitAt = now - input.sinceHit;
      if (Number.isFinite(hitAt) && hitAt !== lastHitAt && !fresh) {
        jellyAt = now;
        springs[FLING_AT + 1] = (springs[FLING_AT + 1] ?? 0) + FLING.hit;
      }
      lastHitAt = hitAt;
      fresh = false;

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const driftX = (player.x - player.prevX) / scale;
      const driftY = (player.y - player.prevY) / scale;
      spring(
        springs,
        FLING_AT,
        (rate / baseSpin - 1) * FLING.reach,
        FLING.stiffness,
        FLING.damping,
        dt,
      );
      spring(
        springs,
        LAG_X,
        Math.max(-LAG.most, Math.min(LAG.most, -driftX * LAG.follow)),
        LAG.stiffness,
        LAG.damping,
        dt,
      );
      spring(
        springs,
        LAG_Y,
        Math.max(-LAG.most, Math.min(LAG.most, -driftY * LAG.follow)),
        LAG.stiffness,
        LAG.damping,
        dt,
      );

      const beatShare = Math.min(1, Math.max(0, input.sinceBeat / frame.tempo.ticksPerBeat));
      const hop = input.moving * Math.sin(Math.PI * beatShare) * strength;
      const land = input.moving * fade(now - landAt, LAND_TICKS) * strength;
      const sway = (1 - input.moving) * Math.sin((TAU * now) / (2 * frame.tempo.ticksPerBar));
      const shake = now - jellyAt;
      const jelly =
        shake >= 0 && shake < JELLY_TICKS
          ? Math.exp(-shake / 6.4) * Math.sin(shake * 1.1) * 0.17 * strength
          : 0;
      const centerX = x - sin * sway * 3 * scale;
      const centerY = y + cos * sway * 3 * scale;
      const lift = 1 + 0.08 * hop;
      const long = scale * lift * (1 - 0.1 * land) * (1 + jelly);
      const wide = scale * lift * (1 + 0.12 * land) * (1 - jelly);

      for (const sprite of sprites) {
        sprite.visible = true;
      }
      canopy.visible = true;

      for (let index = 0; index < 2; index += 1) {
        const side = index === 0 ? -1 : 1;
        const forward = (foot === index ? 6 : -1) * input.moving;
        const ahead = 49 + forward;
        const sneaker = index === 0 ? feet[0] : feet[1];
        sneaker.position.set(
          centerX + (ahead * cos - side * 10 * sin) * scale,
          centerY + (ahead * sin + side * 10 * cos) * scale,
        );
        sneaker.rotation = angle;
        sneaker.scale.set(scale);
        setTint(sneaker, color);
      }

      canopy.position.set(centerX, centerY);
      canopy.rotation = angle;
      canopy.scale.set(long, wide);
      parasol.rotation = spin - angle + sway * 0.12;
      parasol.scale.set(1);
      setTint(parasol, color);
      placeOutline(outline, parasol, object.texture, REFERENCE, frame);

      const fling = POMPOM_OUT + (springs[FLING_AT] ?? 0) + 2.5 * frame.pulse;
      const lagX = springs[LAG_X] ?? 0;
      const lagY = springs[LAG_Y] ?? 0;
      const flash = input.sinceSkill >= 0 && input.sinceSkill < 15 ? 1 - input.sinceSkill / 15 : 0;
      const glowShare = light.additive ? 0.7 : 0.25;
      for (let index = 0; index < POMPOMS; index += 1) {
        const rib = spin + (index / POMPOMS) * TAU + sway * 0.12;
        const reach = PARASOL_RADIUS + fling + Math.sin(now * 0.17 + index) * 0.8;
        // Along the aim and across it, squashed like the canopy, then the lag in the world.
        const localX = (Math.cos(rib - angle) * reach * long) / scale;
        const localY = (Math.sin(rib - angle) * reach * wide) / scale;
        const pompomX = centerX + (localX * cos - localY * sin) * scale + lagX * 0.9 * scale;
        const pompomY = centerY + (localX * sin + localY * cos) * scale + lagY * 0.9 * scale;
        const glow = Math.max(flash, chase(now, index, calm, frame.tempo));
        const tint = index % 2 === 0 ? palette.or : color;
        const pompom = pompoms[index];
        const lit = lights[index];
        if (pompom === undefined || lit === undefined) {
          continue;
        }
        pompom.position.set(pompomX, pompomY);
        pompom.rotation = rib;
        pompom.scale.set(scale * lift);
        pompom.alpha = 0.55 + 0.45 * glow;
        setTint(pompom, tint);
        lit.position.set(pompomX, pompomY);
        lit.scale.set((12 * scale) / textures.halo.radius);
        lit.alpha = glow * glowShare;
        setTint(lit, tint);
      }

      const poolRadius =
        player.radius *
        3 *
        (1 + 0.07 * frame.pulse) *
        (1 +
          (input.sinceSkill >= 0 && input.sinceSkill < 29
            ? 0.6 * Math.exp(-input.sinceSkill / 9)
            : 0));
      pool.position.set(x, y);
      pool.scale.set(poolRadius / textures.halo.radius);
      if (light.additive) {
        setTint(pool, color);
        pool.alpha = 0.3 + 0.14 * frame.pulse;
      } else {
        setTint(pool, 0x000000);
        pool.alpha = 0.16;
      }

      for (let index = 0; index < FIREFLIES; index += 1) {
        const firefly = fireflies[index];
        if (firefly === undefined) {
          continue;
        }
        const turn = now * 0.024 * (index % 2 === 0 ? -1 : 1) + index * 1.26;
        const away = player.radius * (1.9 + 0.5 * Math.sin(now * 0.038 + index * 2));
        firefly.position.set(
          x + Math.cos(turn) * away + Math.sin(now * 0.107 + index) * 3 * scale,
          y + Math.sin(turn) * away + Math.cos(now * 0.093 + index) * 3 * scale,
        );
        firefly.scale.set((9 * scale) / textures.halo.radius);
        firefly.alpha =
          (0.5 + 0.5 * Math.sin(now * 0.079 + index * 1.7)) * (light.additive ? 0.9 : 0.1);
        setTint(firefly, palette.or);
      }
      return hop;
    },
  };
}
