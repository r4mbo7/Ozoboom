import { Container, Graphics, type Sprite } from 'pixi.js';
import { clamp01, lerp } from '../shared/scalar';
import type { EntityId, SimEvent, SimState } from '../sim/state';
import { GIFTS_BEATS } from './boss-gifts';
import { BURST_AT } from './boss-moments';
import type { Family, RenderContext } from './context';
import {
  TORCH,
  WHISTLE_WAVES,
  capFlight,
  sunRise,
  torchLight,
  torchSweep,
  whistleWave,
} from './couvre-feu-moments';
import type { EnemyPose } from './enemies';
import { FACE_RADIUS } from './face-kit';
import { COUVRE_FEU_WHISTLE, couvreFeuCap } from './faces-bosses';
import type { Frame } from './frame';
import { TAU, WHITE, circle, paint, type Shape } from './paint';
import { add, hide, setTint } from './util';
import { ViewPool } from './views';

const KIND = 'couvre-feu';
const FINE = 2;
const TORCH_LIGHT = 0xe1e8ff;
const CONE = { length: 256, from: 24.6, width: 6.2, night: 0.32, day: 0.34, dayTint: 0x8ea4e6 };
const HOOP = { size: 1.75, alpha: 0.85 };
const WAVE = { from: 14, travel: 26, spread: 0.7, width: 3.4 };
const LIGHT_UP_BEATS = 1;

interface Boss {
  readonly cone: Sprite;
  readonly waves: Graphics;
}

interface Exit {
  readonly start: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly side: number;
  readonly cap: Sprite;
  readonly sun: Sprite;
}

interface Looks {
  readonly cone: Shape;
  readonly hoop: Shape;
  readonly cap: Shape;
  readonly sun: Shape;
}

function paintLooks(): Looks {
  const coneHeight = 2 * Math.ceil(Math.tan(TORCH.half) * CONE.length + 4);
  return {
    cone: paint(CONE.length, coneHeight, CONE.length, (ctx) => {
      ctx.translate(-CONE.length / 2, 0);
      const spread = Math.tan(TORCH.half) * CONE.length;
      const light = ctx.createLinearGradient(CONE.from, 0, CONE.length, 0);
      light.addColorStop(0, WHITE);
      light.addColorStop(0.45, 'rgb(255 255 255 / 0.6)');
      light.addColorStop(1, 'rgb(255 255 255 / 0)');
      ctx.beginPath();
      ctx.moveTo(CONE.from, -CONE.width);
      ctx.lineTo(CONE.length, -spread);
      ctx.lineTo(CONE.length, spread);
      ctx.lineTo(CONE.from, CONE.width);
      ctx.closePath();
      ctx.fillStyle = light;
      ctx.fill();
    }),
    hoop: paint(80, 80, 32, (ctx) => {
      circle(ctx, 32);
      ctx.lineWidth = 3.6;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    }),
    cap: paint(144 * FINE, 144 * FINE, FACE_RADIUS * FINE, (ctx) => {
      ctx.scale(FINE, FINE);
      couvreFeuCap(ctx);
    }),
    sun: paint(48 * FINE, 48 * FINE, FACE_RADIUS * FINE, (ctx) => {
      ctx.scale(FINE, FINE);
      ctx.shadowColor = WHITE;
      ctx.shadowBlur = 21 * FINE;
      circle(ctx, 9.5);
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = WHITE;
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 13.7, Math.sin(angle) * 13.7);
        ctx.lineTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
        ctx.stroke();
      }
    }),
  };
}

export function createCouvreFeu(
  ctx: RenderContext,
  poseOf: (id: EntityId) => EnemyPose | undefined,
): Family {
  const { layers } = ctx;
  const looks = paintLooks();
  const torches = layers.dim.addChild(new Container());
  const hoops = layers.zones.addChild(new Container());
  const whistles = layers.enemyShots.addChild(new Container());
  const caps = layers.farewells.addChild(new Container());
  const suns = layers.fx.addChild(new Container());
  const firstDrawnAt = new Map<EntityId, number>();
  const exits: Exit[] = [];
  const spareExits: Pick<Exit, 'cap' | 'sun'>[] = [];
  const cones: { x: number; y: number; aim: number; reach: number; light: number }[] = [];

  const bosses = new ViewPool<Boss>(
    () => ({ cone: add(torches, looks.cone, 0), waves: whistles.addChild(new Graphics()) }),
    (boss) => {
      boss.cone.visible = boss.waves.visible = false;
    },
  );
  const rings = new ViewPool<Sprite>(
    () => add(hoops, looks.hoop),
    (ring) => {
      ring.visible = false;
    },
  );

  function torch(boss: Boss, pose: EnemyPose, aim: number, light: number, frame: Frame): void {
    const { cone } = boss;
    const night = frame.light.additive;
    cone.visible = true;
    cone.blendMode = night ? 'add' : 'normal';
    setTint(cone, night ? TORCH_LIGHT : CONE.dayTint);
    cone.alpha = (night ? CONE.night : CONE.day) * light;
    cone.position.set(pose.x, pose.y);
    cone.rotation = aim;
    cone.scale.set((TORCH.reach * pose.radius) / CONE.length);
  }

  function whistle(boss: Boss, pose: EnemyPose, frame: Frame): void {
    const { waves } = boss;
    const beats = frame.now / frame.tempo.ticksPerBeat;
    waves.clear();
    waves.visible = true;
    setTint(waves, frame.palette.badVibeRim);
    waves.position.set(pose.x, pose.y);
    waves.rotation = pose.tilt;
    waves.scale.set(pose.radius / FACE_RADIUS);
    const [x, y] = COUVRE_FEU_WHISTLE;
    const count = frame.calm ? WHISTLE_WAVES.calm : WHISTLE_WAVES.normal;
    for (let index = 0; index < count; index += 1) {
      const progress = whistleWave(beats, index);
      if (progress === null) {
        continue;
      }
      const radius = WAVE.from + progress * WAVE.travel;
      waves
        .moveTo(x + Math.cos(-WAVE.spread) * radius, y + Math.sin(-WAVE.spread) * radius)
        .arc(x, y, radius, -WAVE.spread, WAVE.spread)
        .stroke({ width: WAVE.width, color: WHITE, alpha: 1 - progress, cap: 'round' });
    }
  }

  function ring(state: SimState, alpha: number, frame: Frame): void {
    rings.begin();
    const night = frame.light.additive;
    for (const player of state.players) {
      const x = lerp(player.prevX, player.x, alpha);
      const y = lerp(player.prevY, player.y, alpha);
      let lit = 0;
      for (const cone of cones) {
        lit = Math.max(lit, cone.light * torchLight(x - cone.x, y - cone.y, cone.aim, cone.reach));
      }
      if (lit <= 0) {
        continue;
      }
      const hoop = rings.acquire(player.id);
      hoop.visible = true;
      setTint(hoop, night ? TORCH_LIGHT : frame.palette.badVibe);
      hoop.alpha = HOOP.alpha * lit;
      hoop.position.set(x, y);
      hoop.scale.set((HOOP.size * player.radius) / looks.hoop.radius);
    }
    rings.end();
  }

  function leave(exit: Exit, frame: Frame): boolean {
    const beats = (frame.show - exit.start) / frame.tempo.ticksPerBeat - BURST_AT;
    if (beats >= GIFTS_BEATS) {
      return false;
    }
    const { cap, sun, x, y, radius, side } = exit;
    const scale = radius / FACE_RADIUS / FINE;
    cap.visible = sun.visible = beats >= 0;
    if (beats < 0) {
      return true;
    }
    const flight = capFlight(beats, GIFTS_BEATS, side);
    setTint(cap, frame.palette.badVibeRim);
    cap.position.set(x + flight.dx * radius, y + flight.dy * radius);
    cap.rotation = flight.turn;
    cap.scale.set(scale);
    cap.alpha = flight.alpha;
    const rise = sunRise(beats, GIFTS_BEATS);
    setTint(sun, frame.palette.noyau);
    sun.position.set(x, y + rise.dy * radius);
    sun.rotation = rise.turn;
    sun.scale.set(scale);
    sun.alpha = rise.alpha;
    return true;
  }

  return {
    update(state: SimState, alpha: number, frame: Frame): void {
      bosses.begin();
      cones.length = 0;
      for (const enemy of state.enemies) {
        const pose = enemy.kind === KIND ? poseOf(enemy.id) : undefined;
        if (pose === undefined) {
          continue;
        }
        const boss = bosses.acquire(enemy.id);
        let at = firstDrawnAt.get(enemy.id);
        if (at === undefined) {
          at = frame.now;
          firstDrawnAt.set(enemy.id, at);
        }
        const since = (frame.now - at) / frame.tempo.ticksPerBeat;
        const toStage = Math.atan2(state.core.y - pose.y, state.core.x - pose.x);
        const aim = toStage + torchSweep(since, frame.calm);
        const light = clamp01(since / LIGHT_UP_BEATS);
        const reach = TORCH.reach * pose.radius;
        cones.push({ x: pose.x, y: pose.y, aim, reach, light });
        torch(boss, pose, aim, light, frame);
        whistle(boss, pose, frame);
      }
      bosses.end();
      ring(state, alpha, frame);
      for (let index = exits.length - 1; index >= 0; index -= 1) {
        const exit = exits[index];
        if (exit !== undefined && !leave(exit, frame)) {
          hide(exit.cap, exit.sun);
          spareExits.push(exit);
          exits.splice(index, 1);
        }
      }
    },
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (event.type === 'enemyFled') {
        firstDrawnAt.delete(event.id);
      } else if (event.type === 'enemyDied' && event.kind === KIND) {
        firstDrawnAt.delete(event.id);
        const sprites = spareExits.pop() ?? {
          cap: add(caps, looks.cap),
          sun: add(suns, looks.sun),
        };
        exits.push({
          ...sprites,
          start: frame.show,
          x: event.x,
          y: event.y,
          radius: poseOf(event.id)?.radius ?? ctx.enemyRadii?.get(KIND) ?? FACE_RADIUS,
          side: state.core.x >= event.x ? -1 : 1,
        });
      }
    },
    reset(): void {
      bosses.releaseAll();
      rings.releaseAll();
      firstDrawnAt.clear();
      for (const exit of exits) {
        hide(exit.cap, exit.sun);
        spareExits.push(exit);
      }
      exits.length = 0;
    },
    destroy(): void {
      for (const container of [torches, hoops, whistles, caps, suns]) {
        container.destroy({ children: true });
      }
      for (const look of [looks.cone, looks.hoop, looks.cap, looks.sun]) {
        look.texture.destroy(true);
      }
    },
  };
}
