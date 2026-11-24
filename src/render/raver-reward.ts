import type { Container, Sprite } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { SimState } from '../sim/state';
import type { Frame } from './frame';
import { mixColor } from './palette';
import {
  VIBE_GAP_BEATS,
  VIBE_FLIGHT_BEATS,
  flightPoint,
  rewardBeats,
  vibeFlight,
} from './raver-cues';
import type { Textures } from './textures';
import { add, hide, setTint } from './util';

const MAX_VIBES = 12;
const VIBE_RADIUS = 12;
const GLOW_RADIUS = 24;
const TRAIL = [0.06, 0.12] as const;
const FLASH_RADIUS = 30;
const FLASH_BEATS = 0.2;
const LAST_RING_BEATS = 0.6;

interface Reward {
  start: number;
  x: number;
  y: number;
  count: number;
}

interface Sprites {
  readonly items: Sprite[];
  used: number;
}

export interface RaverReward {
  start(tick: number, x: number, y: number, count: number): void;
  update(state: SimState, alpha: number, frame: Frame): void;
  reset(): void;
}

export function createRaverReward(parent: Container, textures: Textures): RaverReward {
  const rewards: Reward[] = [];
  const halos: Sprites = { items: [], used: 0 };
  const stars: Sprites = { items: [], used: 0 };
  const rings: Sprites = { items: [], used: 0 };
  const from = { x: 0, y: 0 };
  const to = { x: 0, y: 0 };
  const at = { x: 0, y: 0 };

  function take(sprites: Sprites, texture: Textures['halo']): Sprite {
    let sprite = sprites.items[sprites.used];
    if (sprite === undefined) {
      sprite = add(parent, texture);
      sprites.items.push(sprite);
    }
    sprites.used += 1;
    sprite.visible = true;
    return sprite;
  }

  function put(sprite: Sprite, x: number, y: number, scale: number, alpha: number): void {
    sprite.position.set(x, y);
    sprite.scale.set(scale);
    sprite.alpha = alpha;
  }

  function glowAt(x: number, y: number, radius: number, tint: number, alpha: number): void {
    const halo = take(halos, textures.halo);
    setTint(halo, tint);
    put(halo, x, y, radius / textures.halo.radius, alpha);
  }

  function drawStream(reward: Reward, beats: number, frame: Frame): void {
    const { palette } = frame;
    const gold = palette.noyau;
    const star = mixColor(0xffffff, palette.noyau, 0.6);
    for (let index = 0; index < reward.count; index += 1) {
      const share = vibeFlight(index, beats);
      if (share === null) {
        continue;
      }
      for (const lag of TRAIL) {
        flightPoint(from, to, index, Math.max(0, share - lag), at);
        glowAt(at.x, at.y, GLOW_RADIUS * (0.5 - lag * 2), gold, 0.5 - lag * 2);
      }
      flightPoint(from, to, index, share, at);
      const size = 1.05 - 0.25 * share;
      glowAt(at.x, at.y, GLOW_RADIUS * size, gold, 1);
      const sprite = take(stars, textures.vibes);
      setTint(sprite, star);
      put(sprite, at.x, at.y, (VIBE_RADIUS * size) / textures.vibes.radius, 1);
      sprite.rotation = (to.x >= from.x ? 1 : -1) * share * 3;
    }
  }

  function drawFlash(reward: Reward, beats: number, frame: Frame): void {
    let flash = 0;
    for (let index = 0; index < reward.count; index += 1) {
      const landed = beats - index * VIBE_GAP_BEATS - VIBE_FLIGHT_BEATS;
      if (landed >= 0 && landed < FLASH_BEATS) {
        flash = Math.max(flash, 1 - landed / FLASH_BEATS);
      }
    }
    const gold = frame.palette.noyau;
    if (flash > 0) {
      glowAt(to.x, to.y, FLASH_RADIUS, gold, (frame.calm ? 0.3 : 0.9) * flash);
    }
    const last = beats - rewardBeats(reward.count);
    if (last >= 0 && last < LAST_RING_BEATS) {
      const share = last / LAST_RING_BEATS;
      const ring = take(rings, textures.ring);
      setTint(ring, gold);
      put(ring, to.x, to.y, (14 + 14 * share) / textures.ring.radius, 1 - share);
    }
  }

  function end(sprites: Sprites): void {
    for (let index = sprites.used; index < sprites.items.length; index += 1) {
      const sprite = sprites.items[index];
      if (sprite !== undefined) {
        hide(sprite);
      }
    }
    sprites.used = 0;
  }

  return {
    start(tick, x, y, count) {
      rewards.push({ start: tick, x, y, count: Math.min(MAX_VIBES, count) });
    },
    update(state, alpha, frame) {
      const { now, tempo } = frame;
      let kept = 0;
      for (const reward of rewards) {
        const beats = (now - reward.start) / tempo.ticksPerBeat;
        if (beats >= rewardBeats(reward.count) + LAST_RING_BEATS) {
          continue;
        }
        rewards[kept] = reward;
        kept += 1;
        from.x = reward.x;
        from.y = reward.y;
        for (const player of state.players) {
          to.x = lerp(player.prevX, player.x, alpha);
          to.y = lerp(player.prevY, player.y, alpha);
          drawFlash(reward, beats, frame);
          drawStream(reward, beats, frame);
        }
      }
      rewards.length = kept;
      end(halos);
      end(stars);
      end(rings);
    },
    reset() {
      rewards.length = 0;
      end(halos);
      end(stars);
      end(rings);
    },
  };
}
