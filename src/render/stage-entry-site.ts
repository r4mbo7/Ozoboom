import { Container, Graphics, Sprite } from 'pixi.js';
import { seedRng } from '../shared/prng';
import { clamp01, smoothstep } from '../shared/scalar';
import { BEATS_PER_BAR } from '../shared/tempo';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import { Particles } from './effects';
import { STAGE, STAGES, type Site, drawSite } from './festival-site';
import type { Frame } from './frame';
import { TAU } from './paint';
import { createTrees } from './ground-trees';
import { diveOf, diveProgress } from './stage-entry';
import type { StageEntry } from './types';
import { lookup } from './util';

const BEAMS = { count: 3, length: 1100, width: 34, alpha: 0.3, sway: 0.5 };
const CORE_GLOW = { radius: 1400, alpha: 0.7 };
const CLOUDS = [
  [-0.9, -0.5],
  [0.8, 0.6],
  [0.4, -0.9],
  [-0.5, 0.8],
] as const;
const CLOUD = { beats: 2.6, from: 0.1, travel: 0.9, grow: 0.6, alpha: 0.5 };
const STREAKS = { count: 16, alpha: 0.35, width: 2 };
const DUST = { beats: 0.9, puffs: 18, reach: 5, peak: 0.7 };

function glow(ctx: RenderContext, parent: Container): Sprite {
  const sprite = new Sprite(ctx.textures.halo.texture);
  sprite.anchor.set(0.5);
  sprite.blendMode = 'add';
  parent.addChild(sprite);
  return sprite;
}

function sized(sprite: Sprite, ctx: RenderContext, radius: number): void {
  sprite.scale.set(radius / ctx.textures.halo.radius);
}

export function createStageEntry(ctx: RenderContext): Family {
  // On the arena's ground, which goes on under it.
  const festival = new Container();
  ctx.layers.ground.addChild(festival);
  const site = new Graphics();
  const grove = new Container();
  const beams = new Graphics();
  beams.blendMode = 'add';
  festival.addChild(site, grove, beams);
  const trees = createTrees(grove);
  const stageGlows = STAGES.map(() => glow(ctx, festival));
  const coreGlow = glow(ctx, ctx.layers.glow);
  const clouds = CLOUDS.map(() => glow(ctx, ctx.layers.screen));
  const streaks = new Graphics();
  ctx.layers.screen.addChild(streaks);
  const rings = new Particles(ctx.layers.fx, ctx.textures.ring, 1);
  const dust = new Particles(ctx.layers.fx, ctx.textures.halo, DUST.puffs);
  let stages: Site['stages'] = [];
  let drawnFor: StageEntry | null = null;
  let landed = false;

  const shown = [festival, coreGlow, streaks, ...clouds];

  function show(visible: boolean): void {
    for (const drawn of shown) {
      drawn.visible = visible;
    }
  }

  function begin(entry: StageEntry, state: SimState, frame: Frame): void {
    drawnFor = entry;
    landed = false;
    const set = lookup(ctx.stages, state.setId, 'set');
    const drawn = drawSite(site, seedRng((state.seed ^ 0x5e7e) >>> 0), state, set, frame.palette);
    stages = drawn.stages;
    trees.draw(drawn.trees);
    stages.forEach((stage, index) => {
      const shown = stageGlows[index];
      if (shown !== undefined) {
        shown.position.set(stage.x, stage.y);
        shown.tint = frame.palette[stage.token];
        shown.alpha = 0.6;
        sized(shown, ctx, STAGE.glow);
      }
    });
    coreGlow.tint = frame.palette.noyau;
    sized(coreGlow, ctx, CORE_GLOW.radius);
  }

  // The beams sweep the sky over the other stages and fade as the camera dives under them.
  function drawBeams(entry: StageEntry, page: number, frame: Frame): void {
    beams.clear();
    const alpha = BEAMS.alpha * (1 - diveOf(entry, page)) ** 2;
    const swing = page / 1000;
    stages.forEach((stage, index) => {
      for (let beam = 0; beam < BEAMS.count; beam += 1) {
        const angle =
          (beam * TAU) / BEAMS.count + BEAMS.sway * Math.sin(swing * 0.4 + beam + index * 1.7);
        beams
          .moveTo(stage.x, stage.y)
          .lineTo(
            stage.x + Math.cos(angle) * BEAMS.length,
            stage.y + Math.sin(angle) * BEAMS.length,
          );
      }
      beams.stroke({ width: BEAMS.width, color: frame.palette[stage.token], alpha, cap: 'round' });
    });
  }

  // Over the first beats of the dive, puffs of cloud fly out past the screen's edges.
  function drawClouds(entry: StageEntry, page: number, frame: Frame): void {
    const progress = (diveProgress(entry, page) * BEATS_PER_BAR) / CLOUD.beats;
    const shown = !frame.calm && progress > 0 && progress < 1;
    const { screenWidth: width, screenHeight: height } = frame.camera;
    const size = Math.max(width, height);
    clouds.forEach((cloud, index) => {
      const [dx, dy] = CLOUDS[index] ?? [0, 0];
      cloud.visible = shown;
      if (!shown) {
        return;
      }
      const distance = size * (CLOUD.from + CLOUD.travel * progress ** 1.4) + index * 8;
      cloud.position.set(width / 2 + dx * distance, height / 2 + dy * distance * 0.7);
      cloud.tint = frame.palette.texte;
      cloud.alpha = CLOUD.alpha * (1 - progress) * smoothstep(clamp01(progress * 6));
      sized(cloud, ctx, size * (0.15 + CLOUD.grow * progress));
    });
  }

  // The speed of the dive, as streaks rushing out from the screen's centre.
  function drawStreaks(entry: StageEntry, page: number, frame: Frame): void {
    streaks.clear();
    const progress = diveProgress(entry, page);
    if (frame.calm || progress <= 0 || progress >= 1) {
      return;
    }
    const speed = progress ** 0.8;
    const { screenWidth: width, screenHeight: height } = frame.camera;
    const size = Math.min(width, height);
    for (let index = 0; index < STREAKS.count; index += 1) {
      const angle = (index * TAU) / STREAKS.count + 0.37 * index;
      const along = (index * 0.31 + page / 600) % 1;
      const from = size * (0.2 + 0.8 * along);
      const to = from + size * (0.07 + 0.25 * speed);
      streaks
        .moveTo(width / 2 + Math.cos(angle) * from, height / 2 + Math.sin(angle) * from)
        .lineTo(width / 2 + Math.cos(angle) * to, height / 2 + Math.sin(angle) * to);
    }
    streaks.stroke({
      width: STREAKS.width,
      color: frame.palette.texte,
      alpha: STREAKS.alpha * speed,
    });
  }

  // On the landing, a dust ring on the ground around the stage, and the camera shakes.
  function land(entry: StageEntry, state: SimState, page: number, frame: Frame): void {
    landed = true;
    frame.shakeTick = frame.now;
    const { x, y, radius } = state.core;
    const duration = DUST.beats * entry.beatMs;
    rings.spawn({
      now: page,
      duration,
      x,
      y,
      fromRadius: radius * 1.2,
      toRadius: radius * DUST.reach,
      tint: frame.palette.texte,
      peak: DUST.peak,
    });
    for (let puff = 0; puff < DUST.puffs; puff += 1) {
      const angle = (puff * TAU) / DUST.puffs + 0.2;
      dust.spawn({
        now: page,
        duration,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        dx: Math.cos(angle) * radius * (DUST.reach - 1),
        dy: Math.sin(angle) * radius * (DUST.reach - 1),
        fromRadius: radius * 0.5,
        toRadius: radius * 0.15,
        tint: frame.palette.texte,
        peak: DUST.peak / 2,
      });
    }
  }

  show(false);
  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      const entry = ctx.options.entry ?? null;
      const page = performance.now();
      if (entry !== null && entry !== drawnFor) {
        begin(entry, state, frame);
      }
      const flying = entry !== null && page < entry.landsAt;
      show(flying);
      if (entry !== null && flying) {
        trees.style(frame);
        drawBeams(entry, page, frame);
        coreGlow.position.set(state.core.x, state.core.y);
        coreGlow.alpha = CORE_GLOW.alpha * (1 - diveOf(entry, page));
        drawClouds(entry, page, frame);
        drawStreaks(entry, page, frame);
      } else if (entry !== null && !landed) {
        land(entry, state, page, frame);
      }
      rings.update(page);
      dust.update(page);
    },
    reset(): void {
      rings.clear();
      dust.clear();
    },
    destroy(): void {
      rings.clear();
      dust.clear();
      trees.destroy();
      for (const drawn of shown) {
        drawn.destroy({ children: true });
      }
    },
  };
}
