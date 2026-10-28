import type { Container } from 'pixi.js';
import { clamp01, lerp } from '../shared/scalar';
import type { Vec2 } from '../shared/vec';
import type { EntityId, SimState } from '../sim/state';
import { type Spot, createFollowspots, polar, teamCenter } from './followspot';
import type { Frame } from './frame';
import { easeInOutCubic, easeOutCubic } from './motion';
import { lerpAngle } from './player-look';
import { byId } from './util';

const RISE_BEATS = 0.15;
const SWEEP_BEATS = 1.5;
const FULL_BEATS = SWEEP_BEATS + 4;
const SETTLE_BEATS = 1;
const WATCH = 0.5;
const FADE_BEATS = 1;
const CALM_FILL_BEATS = 1;
const POOL_REACH = 1.6;
const BRIGHTNESS = { night: 0.85, day: 0.55 };

// The stage's followspot leaves the team on the 1 of the drop, sweeps to the boss, follows it in
// full light for a bar, then settles to a watch light for as long as it lives and goes out over a
// beat once it is chased (`gone` counts the beats since, on the show clock: the sim waits for the
// relic choice meanwhile). In calm mode it does not sweep: it fills from the core toward the boss.
export function spotOf(
  beats: number,
  core: Vec2,
  team: Vec2,
  boss: Vec2,
  calm: boolean,
  gone: number | null,
): Spot | null {
  if (beats < 0 || (gone !== null && gone >= FADE_BEATS)) {
    return null;
  }
  const settled = lerp(1, WATCH, easeInOutCubic(clamp01((beats - FULL_BEATS) / SETTLE_BEATS)));
  const out = gone === null ? 1 : 1 - gone / FADE_BEATS;
  const light = Math.min(clamp01(beats / RISE_BEATS), settled) * out;
  const to = polar(core, boss);
  if (calm) {
    return { aim: to.aim, reach: to.reach * easeOutCubic(clamp01(beats / CALM_FILL_BEATS)), light };
  }
  const from = polar(core, team);
  const share = easeInOutCubic(clamp01(beats / SWEEP_BEATS));
  return {
    aim: lerpAngle(from.aim, to.aim, share),
    reach: lerp(from.reach, to.reach, share),
    light,
  };
}

interface Followed {
  readonly id: EntityId;
  x: number;
  y: number;
  radius: number;
  readonly landedTick: number;
  goneShow: number | null;
}

export interface BossSpotlight {
  land(id: EntityId, at: Vec2, tick: number): void;
  chased(id: EntityId, show: number): void;
  update(state: SimState, frame: Frame): void;
  reset(): void;
  destroy(): void;
}

// One followspot per boss alive, lit from its own lyre on the core's rim.
export function createBossSpotlight(light: Container, rig: Container): BossSpotlight {
  const spots = createFollowspots(light, rig, BRIGHTNESS);
  const followed: Followed[] = [];

  return {
    land(id, at, tick): void {
      followed.push({ id, x: at.x, y: at.y, radius: 0, landedTick: tick, goneShow: null });
    },
    chased(id, show): void {
      const chase = byId(followed, id);
      if (chase !== undefined) {
        chase.goneShow ??= show;
      }
    },
    update(state, frame): void {
      const between = frame.now - state.tick;
      const { ticksPerBeat } = frame.tempo;
      const team = teamCenter(state.players, state.core, between);
      spots.begin();
      let kept = 0;
      for (const chase of followed) {
        const boss = byId(state.enemies, chase.id);
        if (boss === undefined) {
          chase.goneShow ??= frame.show;
        } else {
          chase.x = lerp(boss.prevX, boss.x, between);
          chase.y = lerp(boss.prevY, boss.y, between);
          chase.radius = boss.radius;
        }
        const beats = (frame.now - chase.landedTick) / ticksPerBeat;
        const gone = chase.goneShow === null ? null : (frame.show - chase.goneShow) / ticksPerBeat;
        const spot = spotOf(beats, state.core, team, chase, frame.calm, gone);
        if (spot === null) {
          continue;
        }
        followed[kept] = chase;
        kept += 1;
        spots.show(chase.id, spot, state, frame, chase.radius * POOL_REACH);
      }
      followed.length = kept;
      spots.end();
    },
    reset(): void {
      followed.length = 0;
      spots.reset();
    },
    destroy(): void {
      spots.destroy();
    },
  };
}
