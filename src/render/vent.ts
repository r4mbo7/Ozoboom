import { Graphics } from 'pixi.js';
import type { EntityId, SimEvent, SimState } from '../sim/state';
import { BURST_AT, farewellPose } from './boss-moments';
import type { Family, RenderContext } from './context';
import type { EnemyPose } from './enemies';
import { BOSS_SCALE, FACE_RADIUS, MASK_BODY, maskTone } from './face-kit';
import type { Frame } from './frame';
import { type RibbonColors, drawMane, partyColors, windTints } from './vent-mane';
import { EXIT_BEATS, type GustTimes, gustPhase, mane, wavePhase } from './vent-moments';
import { type Exit, createWeather } from './vent-weather';

const KIND = 'coup-de-vent';
const WHITE = 0xffffff;

interface Farewell extends Exit {
  readonly radius: number;
  readonly scale: number;
  readonly tilt: number;
}

export function createCoupDeVent(
  ctx: RenderContext,
  poseOf: (id: EntityId) => EnemyPose | undefined,
): Family {
  const ribbons = new Graphics();
  ctx.layers.enemies.addChildAt(ribbons, 0);
  const weather = createWeather(ctx);
  const exits: Farewell[] = [];
  let lastGust: GustTimes | undefined;
  let wave = 0;
  let wavedAt = 0;

  function colorsOf(frame: Frame, glad: boolean): (index: number) => RibbonColors {
    const { palette } = frame;
    const rim = palette.badVibeRim;
    const body = maskTone(rim, MASK_BODY);
    const tints = windTints(palette);
    const party = partyColors(palette);
    return (index) => {
      if (glad) {
        return {
          fill: party[index % party.length] ?? rim,
          fillAlpha: 1,
          rim,
          rimAlpha: 1,
          line: WHITE,
          lineAlpha: 0.75,
        };
      }
      const [line, lineAlpha] = tints[index % tints.length] ?? [rim, 0.5];
      return { fill: body, fillAlpha: 1, rim, rimAlpha: 1, line, lineAlpha };
    };
  }

  function placeMane(x: number, y: number, tilt: number, scale: number, alpha: number): void {
    ribbons.visible = true;
    ribbons.position.set(x, y);
    ribbons.rotation = tilt;
    ribbons.scale.set(scale * BOSS_SCALE);
    ribbons.alpha = alpha;
  }

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      ribbons.clear();
      ribbons.visible = false;
      if (state.gust !== undefined) {
        lastGust = { ...state.gust };
      }
      const { ticksPerBeat } = frame.tempo;
      const beats = frame.show / ticksPerBeat;
      const phase = gustPhase(lastGust, frame.now, ticksPerBeat);
      if (phase === undefined) {
        lastGust = undefined;
      }
      const streaming = mane(phase, beats, frame.calm);
      wave = wavePhase(wave, beats - wavedAt, streaming.rate);
      wavedAt = beats;
      for (const enemy of state.enemies) {
        const pose = enemy.kind === KIND ? poseOf(enemy.id) : undefined;
        if (pose === undefined) {
          continue;
        }
        const { sprite } = pose;
        placeMane(
          sprite.position.x,
          sprite.position.y,
          sprite.rotation,
          sprite.scale.x,
          sprite.alpha,
        );
        drawMane(
          ribbons,
          wave,
          { ...streaming, angle: streaming.angle - sprite.rotation },
          colorsOf(frame, false),
        );
      }
      for (let index = exits.length - 1; index >= 0; index -= 1) {
        const exit = exits[index];
        if (exit === undefined) {
          continue;
        }
        const since = (frame.show - exit.start) / ticksPerBeat;
        if (since >= BURST_AT + EXIT_BEATS) {
          exits.splice(index, 1);
        } else if (since < BURST_AT) {
          const pose = farewellPose(since, frame.calm);
          placeMane(
            exit.x + pose.tremble * exit.radius,
            exit.y - pose.lift * exit.radius,
            exit.tilt,
            exit.scale * pose.scale,
            1,
          );
          drawMane(
            ribbons,
            wave,
            { ...streaming, angle: streaming.angle - exit.tilt },
            colorsOf(frame, pose.phase === 'glad'),
          );
        }
      }
      weather.update(phase, state, alpha, frame, exits);
    },
    onEvent(event: SimEvent, _state: SimState, frame: Frame): void {
      if (event.type !== 'enemyDied' || event.kind !== KIND) {
        return;
      }
      const pose = poseOf(event.id);
      const radius = pose?.radius ?? ctx.enemyRadii?.get(KIND) ?? FACE_RADIUS;
      exits.push({
        start: frame.show,
        x: event.x,
        y: event.y,
        radius,
        scale: pose?.sprite.scale.x ?? radius / (FACE_RADIUS * BOSS_SCALE),
        tilt: pose?.tilt ?? 0,
      });
    },
    reset(): void {
      ribbons.clear();
      ribbons.visible = false;
      exits.length = 0;
      lastGust = undefined;
      wave = wavedAt = 0;
      weather.reset();
    },
    destroy(): void {
      ribbons.destroy();
      weather.destroy();
    },
  };
}
