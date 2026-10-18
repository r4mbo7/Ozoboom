import type { PlayerState, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { worldToScreen } from './camera';
import { lerp } from './motion';
import { TAU } from './paint';
import type { CameraFocus } from './types';
import { add, hide, lookup, setTint } from './util';

const SWARM = 14;
const SWARM_BEATS = 4;
const VEIL_ALPHA = 0.85;
// The veil reaches full strength at this share of the half-diagonal of the screen.
const VEIL_REACH = 0.85;
const FADE_BEATS = 1;
const FLY_SIZE = 1.6;
const FLY_HALO = 12;
const SOLO: CameraFocus = { kind: 'player', playerId: 0 };

export interface SwarmFly {
  x: number;
  y: number;
  alpha: number;
}

const ease = (t: number) => 1 - (1 - t) ** 3;

// Firefly `index` of the swarm that rises from the edges of the screen towards the player in its
// middle, as a share of the half-diagonal of the screen, one trip every few beats.
export function swarmFlyAt(index: number, beats: number, out: SwarmFly): SwarmFly {
  const angle = (index / SWARM) * TAU + (index % 3) * 0.4;
  const trip = (((beats / SWARM_BEATS + index / SWARM) % 1) + 1) % 1;
  const reach = 1 - 0.7 * ease(trip);
  out.x = Math.cos(angle) * reach;
  out.y = Math.sin(angle) * reach;
  out.alpha = Math.sin(trip * Math.PI);
  return out;
}

function watchedBy(state: SimState, focus: CameraFocus): PlayerState | undefined {
  return focus.kind === 'player'
    ? state.players.find((player) => player.id === focus.playerId)
    : undefined;
}

// The screen of a player lying down: the world loses its colours round them, and the fireflies
// of the lake come to them from the edges. In calm mode, the veil alone.
export function createDownedScreen(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const veil = add(layers.veil, textures.players.downed.veil);
  const swarm = Array.from({ length: SWARM }, () => ({
    halo: add(layers.screen, textures.halo),
    core: add(layers.screen, textures.players.downed.firefly),
  }));
  const fly: SwarmFly = { x: 0, y: 0, alpha: 0 };
  let level = 0;
  let lastNow = Number.NaN;

  function hideSwarm(): void {
    for (const { halo, core } of swarm) {
      hide(halo, core);
    }
  }

  return {
    reset(): void {
      level = 0;
      lastNow = Number.NaN;
      veil.visible = false;
      hideSwarm();
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const watched = watchedBy(state, ctx.options.focus ?? SOLO);
      const { now, tempo, camera, palette, light } = frame;
      const elapsed = Number.isNaN(lastNow) ? 0 : Math.max(0, now - lastNow);
      lastNow = now;
      const step = elapsed / (tempo.ticksPerBeat * FADE_BEATS);
      level = watched?.downed === true ? Math.min(1, level + step) : Math.max(0, level - step);
      veil.visible = level > 0;
      if (!veil.visible || watched === undefined) {
        hideSwarm();
        return;
      }
      const point = {
        x: lerp(watched.prevX, watched.x, alpha),
        y: lerp(watched.prevY, watched.y, alpha),
      };
      const width = camera.screenWidth / camera.scale;
      const height = camera.screenHeight / camera.scale;
      veil.position.set(point.x, point.y);
      const reach = (Math.hypot(width, height) / 2) * VEIL_REACH;
      veil.scale.set(reach / textures.players.downed.veil.radius);
      setTint(veil, palette.sol);
      veil.alpha = VEIL_ALPHA * level;

      if (frame.calm) {
        hideSwarm();
        return;
      }
      const color = palette[lookup(ctx.classTokens, watched.classId, 'class')];
      const half = Math.hypot(camera.screenWidth, camera.screenHeight) / 2;
      const target = worldToScreen(camera, point);
      const beats = now / tempo.ticksPerBeat;
      for (const [index, { halo, core }] of swarm.entries()) {
        swarmFlyAt(index, beats, fly);
        const x = target.x + fly.x * half;
        const y = target.y + fly.y * half;
        const shine = fly.alpha * level;
        halo.visible = core.visible = shine > 0;
        for (const sprite of [halo, core]) {
          sprite.position.set(x, y);
          setTint(sprite, color);
        }
        core.scale.set(FLY_SIZE);
        core.alpha = shine;
        const blend = light.additive ? 'add' : 'normal';
        if (halo.blendMode !== blend) {
          halo.blendMode = blend;
        }
        halo.scale.set(FLY_HALO / textures.halo.radius);
        halo.alpha = shine * light.haloAlpha;
      }
    },
    destroy(): void {
      veil.destroy();
      for (const { halo, core } of swarm) {
        halo.destroy();
        core.destroy();
      }
    },
  };
}
