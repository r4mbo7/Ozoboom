import { Graphics, type Sprite } from 'pixi.js';
import type { PaletteToken } from '../shared/palette';
import { clamp01, lerp } from '../shared/scalar';
import type { AuraAttack, OlaEffect } from '../data/kiffeur';
import { KIFF } from '../sim/gauges/kiff';
import { OLA, olaFront } from '../sim/skills/ola';
import type { PropState, SimEvent, SimState } from '../sim/state';
import { createAuras } from './aura';
import { createBurster } from './class-bursts';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import {
  type Ctx,
  type Piece,
  type Sheet,
  SHADE_DEEP,
  WHITE,
  paintSheet,
  paintedLater,
} from './paint';
import { REFERENCE_RADIUS } from './textures-looks';
import { add, byId, setTint } from './util';
import { ViewPool } from './views';
import { CREAM } from './kiffeur-paint';

const OLA_RINGS = [
  { behind: 0, width: 5, alpha: 0.8 },
  { behind: 11, width: 3.5, alpha: 0.55 },
  { behind: 22, width: 2.5, alpha: 0.35 },
] as const;
const OLA_CALM = { width: 4, alpha: 0.45 };
const OLA_FADE_BEATS = 0.6;
const CHEVRON = { above: 14, bob: 2, size: 0.55 };
const SLOW_REACH = 40;
const CHEER = { grow: 1.45, swell: 0.12, alpha: 0.75 };

function chevrons(ctx: Ctx): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [width, color] of [
    [7.5, SHADE_DEEP],
    [4.2, WHITE],
  ] as const) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    for (const y of [4, -6]) {
      ctx.beginPath();
      ctx.moveTo(-9, y + 5);
      ctx.lineTo(0, y - 4);
      ctx.lineTo(9, y + 5);
      ctx.stroke();
    }
  }
}

const MOOD_PIECES = {
  chevrons: [40, 40, REFERENCE_RADIUS, chevrons],
} satisfies Record<string, Piece>;

export function createMood(ctx: RenderContext): Family {
  const { layers, textures } = ctx;
  const auras = new Map<string, AuraAttack>();
  for (const [classId, attack] of ctx.attacks) {
    if (attack.kind === 'aura') {
      auras.set(classId, attack);
    }
  }
  const olas = new Map<string, OlaEffect>();
  let cheerer: PaletteToken = 'or';
  for (const [classId, effect] of ctx.skillEffects) {
    if (effect.kind === 'ola') {
      olas.set(classId, effect);
      cheerer = ctx.classTokens.get(classId) ?? cheerer;
    }
  }
  const sheet = paintedLater((): Sheet<keyof typeof MOOD_PIECES> => paintSheet(MOOD_PIECES));
  const burster = createBurster(ctx, 16);
  const slowed = new Set<number>();

  const auraRings = createAuras(ctx, burster);
  const waveViews = new ViewPool<Graphics>(
    () => {
      const graphics = new Graphics();
      layers.fx.addChild(graphics);
      return graphics;
    },
    (graphics) => {
      graphics.visible = false;
    },
  );
  const chevronPool = (): ViewPool<Sprite> => {
    const { shapes } = sheet.get();
    return new ViewPool<Sprite>(
      () => add(layers.fx, shapes.chevrons),
      (sprite) => {
        sprite.visible = false;
      },
    );
  };
  let cheerViews: ViewPool<Sprite> | undefined;
  let slowViews: ViewPool<Sprite> | undefined;
  const ringViews = new ViewPool<Sprite>(
    () => add(layers.glow, textures.ring),
    (sprite) => {
      sprite.visible = false;
    },
  );

  function drawWave(wave: PropState, effect: OlaEffect, alpha: number, frame: Frame): void {
    const { calm, palette, light, tempo } = frame;
    const graphics = waveViews.acquire(wave.id);
    const front = olaFront(effect, tempo.ticksPerBeat, wave.ticksLeft + 1 - alpha);
    const left = (wave.ticksLeft - alpha) / tempo.ticksPerBeat;
    const shown = clamp01(left / OLA_FADE_BEATS);
    const color = palette[cheerer];
    graphics.visible = true;
    graphics.position.set(wave.x, wave.y);
    graphics.blendMode = light.additive ? 'add' : 'normal';
    graphics.clear();
    const rings = calm ? [{ behind: 0, ...OLA_CALM }] : OLA_RINGS;
    rings.forEach((ring, index) => {
      const radius = front - ring.behind;
      if (radius > 0) {
        graphics.circle(0, 0, radius).stroke({
          width: ring.width,
          color: index === 0 ? CREAM : color,
          alpha: ring.alpha * shown,
        });
      }
    });
  }

  function placeChevron(
    sprite: Sprite,
    x: number,
    y: number,
    radius: number,
    up: boolean,
    color: number,
    frame: Frame,
  ): void {
    const bob = frame.calm ? 0 : CHEVRON.bob * frame.pulse;
    sprite.visible = true;
    sprite.position.set(
      x,
      up ? y - radius - CHEVRON.above - bob : y - radius - CHEVRON.above + bob,
    );
    sprite.rotation = up ? 0 : Math.PI;
    sprite.scale.set(CHEVRON.size);
    setTint(sprite, color);
  }

  function drawCheers(state: SimState, alpha: number, frame: Frame): void {
    const { palette, light } = frame;
    cheerViews ??= chevronPool();
    cheerViews.begin();
    ringViews.begin();
    const color = palette[cheerer];
    for (const player of state.players) {
      if (player.downed || player.boosts === undefined) {
        continue;
      }
      const x = lerp(player.prevX, player.x, alpha);
      const y = lerp(player.prevY, player.y, alpha);
      if (player.boosts.some((boost) => boost.id === OLA)) {
        placeChevron(cheerViews.acquire(player.id), x, y, player.radius, true, color, frame);
      }
      if (!auras.has(player.classId) && player.boosts.some((boost) => boost.id === KIFF)) {
        const ring = ringViews.acquire(player.id);
        ring.visible = true;
        ring.position.set(x, y);
        const swell = frame.calm ? 0 : CHEER.swell * frame.pulse;
        ring.scale.set((player.radius * CHEER.grow * (1 + swell)) / textures.ring.radius);
        ring.alpha = CHEER.alpha * Math.max(0.5, light.haloAlpha);
        setTint(ring, color);
      }
    }
    cheerViews.end();
    ringViews.end();
  }

  function drawSlowed(state: SimState, alpha: number, frame: Frame): void {
    slowViews ??= chevronPool();
    slowViews.begin();
    for (const id of slowed) {
      const enemy = byId(state.enemies, id);
      if (enemy === undefined || enemy.hp <= 0 || enemy.statuses?.slowed === undefined) {
        slowed.delete(id);
        continue;
      }
      const x = lerp(enemy.prevX, enemy.x, alpha);
      const y = lerp(enemy.prevY, enemy.y, alpha);
      placeChevron(
        slowViews.acquire(id),
        x,
        y,
        enemy.radius,
        false,
        frame.palette.turquoise,
        frame,
      );
    }
    slowViews.end();
  }

  function nearAWave(state: SimState, x: number, y: number, frame: Frame): boolean {
    for (const prop of state.props ?? []) {
      const owner = prop.kind === OLA ? byId(state.players, prop.playerId) : undefined;
      const effect = owner === undefined ? undefined : olas.get(owner.classId);
      if (effect === undefined) {
        continue;
      }
      const front = olaFront(effect, frame.tempo.ticksPerBeat, prop.ticksLeft);
      const reach = front + SLOW_REACH;
      if ((x - prop.x) * (x - prop.x) + (y - prop.y) * (y - prop.y) <= reach * reach) {
        return true;
      }
    }
    return false;
  }

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (
        olas.size > 0 &&
        event.type === 'enemyStatusStarted' &&
        event.status === 'slowed' &&
        nearAWave(state, event.x, event.y, frame)
      ) {
        slowed.add(event.id);
      }
    },
    reset(): void {
      slowed.clear();
      burster.bursts.clear();
      auraRings.views.releaseAll();
      waveViews.releaseAll();
      ringViews.releaseAll();
      cheerViews?.releaseAll();
      slowViews?.releaseAll();
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      if (auras.size === 0 && olas.size === 0) {
        return;
      }
      auraRings.views.begin();
      for (const player of state.players) {
        const attack = player.downed ? undefined : auras.get(player.classId);
        if (attack !== undefined) {
          auraRings.draw(player, attack, alpha, frame);
        }
      }
      auraRings.views.end();
      waveViews.begin();
      for (const prop of state.props ?? []) {
        const owner = prop.kind === OLA ? byId(state.players, prop.playerId) : undefined;
        const effect = owner === undefined ? undefined : olas.get(owner.classId);
        if (effect !== undefined) {
          drawWave(prop, effect, alpha, frame);
        }
      }
      waveViews.end();
      drawCheers(state, alpha, frame);
      drawSlowed(state, alpha, frame);
      burster.bursts.update(state, alpha, frame);
    },
    destroy(): void {
      burster.bursts.clear();
      slowed.clear();
      sheet.painted?.source.destroy();
    },
  };
}
