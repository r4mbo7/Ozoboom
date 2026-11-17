import {
  ColorMatrixFilter,
  Container,
  Graphics,
  Matrix,
  type Renderer,
  RenderTexture,
  Sprite,
} from 'pixi.js';
import { lerp, smoothstep } from '../shared/scalar';
import type { SimEvent, SimState } from '../sim/state';
import type { Family } from './context';
import type { Frame } from './frame';
import { TAU } from './paint';
import { WHITE, mixColor } from './palette';
import {
  DRAWN_RADIUS,
  HUES,
  OUTLINE,
  type PotionBodies,
  PotionGlints,
  type PoweredBody,
  STRENGTH,
  flameClock,
  hueAt,
  trailFill,
} from './potion-aura-model';
import { FlameMesh, paletteTexture } from './potion-flame';
import { PotionTrail, type TrailStamp } from './potion-trail';
import { setTint } from './util';

const BAND = { rim: 3.3, outer: 2.4, middle: 1.6, core: 0.8, thinnest: 0.55, directions: 12 };
const BAND_TONES = [0, 0.45, 0.82] as const;
const GLINT = { beats: 0.45, calmBeats: 1, glow: 12, cross: 5, dots: 6, spread: 12 };
const CAPTURE = { margin: 1.15, step: 0.25 };
const TURN_BEATS = 4;
// The trail goes round the colours four times as fast as the band, so it streaks all of them.
const TRAIL_TURNS = 4;

interface Slot {
  readonly root: Container;
  readonly flames: FlameMesh;
  readonly band: readonly Sprite[];
  readonly stamps: TrailStamp[];
  readonly last: { x: number; y: number };
  captured: { readonly look: RenderTexture; readonly silhouette: RenderTexture } | null;
  half: number;
  resolution: number;
  frame: number;
}

const BAND_RINGS = [
  { offset: BAND.rim, tone: -1 },
  { offset: BAND.outer, tone: BAND_TONES[0] },
  { offset: BAND.middle, tone: BAND_TONES[1] },
  { offset: BAND.core, tone: BAND_TONES[2] },
] as const;
const BAND_DIRECTIONS = Array.from({ length: BAND.directions }, (_, index) => {
  const angle = (index * TAU) / BAND.directions;
  return { angle, cos: Math.cos(angle), sin: Math.sin(angle) };
});

// The render families have no renderer, so the scene makes this one after them.
export function createPotionAura(
  pixi: Renderer,
  bodies: PotionBodies,
  above: Container,
  world: Container,
): Family {
  const slots = new Map<number, Slot>();
  const trail = new PotionTrail(pixi, world, bodies.layer);
  const stamps: TrailStamp[] = [];
  const palette = paletteTexture();
  const glints = new PotionGlints();
  const sparkles = above.addChild(new Graphics());
  const whiten = new ColorMatrixFilter();
  whiten.matrix.fill(0);
  whiten.matrix[4] = whiten.matrix[9] = whiten.matrix[14] = whiten.matrix[18] = 1;
  const flatten = new Container();
  const flat = flatten.addChild(new Sprite());
  flat.filters = [whiten];
  const place = new Matrix();
  const bandHues = BAND_DIRECTIONS.map(() => 0);
  let frameIndex = 0;
  let glintsShown = false;

  function slotOf(playerId: number): Slot {
    let slot = slots.get(playerId);
    if (slot === undefined) {
      const root = bodies.layer.addChild(new Container());
      const sprite = (): Sprite => {
        const made = new Sprite();
        made.anchor.set(0.5);
        return made;
      };
      const flames = new FlameMesh(palette);
      root.addChild(flames.mesh);
      const band = BAND_RINGS.flatMap(() =>
        Array.from({ length: BAND.directions }, () => root.addChild(sprite())),
      );
      slot = {
        root,
        flames,
        band,
        stamps: [],
        last: { x: 0, y: 0 },
        captured: null,
        half: 0,
        resolution: 0,
        frame: 0,
      };
      slots.set(playerId, slot);
    }
    return slot;
  }

  function release(slot: Slot): void {
    slot.captured?.look.destroy(true);
    slot.captured?.silhouette.destroy(true);
    slot.captured = null;
  }

  function captureSilhouette(slot: Slot, body: PoweredBody, scale: number): RenderTexture {
    const half = Math.ceil(body.extent * CAPTURE.margin + BAND.rim * (body.radius / DRAWN_RADIUS));
    const resolution = Math.max(
      CAPTURE.step,
      Math.ceil((scale * pixi.resolution) / CAPTURE.step) * CAPTURE.step,
    );
    let { captured } = slot;
    if (captured === null || slot.half !== half || slot.resolution !== resolution) {
      release(slot);
      const options = { width: 2 * half, height: 2 * half, resolution };
      captured = { look: RenderTexture.create(options), silhouette: RenderTexture.create(options) };
      slot.captured = captured;
      slot.half = half;
      slot.resolution = resolution;
    }
    place.set(1, 0, 0, 1, half - body.x, half - body.y);
    pixi.render({ container: body.body, target: captured.look, clear: true, transform: place });
    flat.texture = captured.look;
    pixi.render({ container: flatten, target: captured.silhouette, clear: true });
    return captured.silhouette;
  }

  function placeBand(slot: Slot, body: PoweredBody, silhouette: RenderTexture): void {
    const unit =
      (body.radius / DRAWN_RADIUS) *
      lerp(BAND.thinnest, 1, (body.reach - STRENGTH.smallest) / (1 - STRENGTH.smallest));
    BAND_RINGS.forEach((ring, ringIndex) => {
      for (let index = 0; index < BAND.directions; index += 1) {
        const sprite = slot.band[ringIndex * BAND.directions + index];
        const direction = BAND_DIRECTIONS[index];
        if (sprite === undefined || direction === undefined) {
          continue;
        }
        sprite.visible = true;
        sprite.texture = silhouette;
        sprite.position.set(
          body.x + direction.cos * ring.offset * unit,
          body.y + direction.sin * ring.offset * unit,
        );
        const hue = bandHues[index] ?? WHITE;
        setTint(sprite, ring.tone < 0 ? OUTLINE.color : mixColor(hue, WHITE, ring.tone));
        sprite.alpha = (ring.tone < 0 ? OUTLINE.alpha : 1) * body.alpha;
      }
    });
  }

  // From where the player stood last frame to where he stands now, so a slow frame still leaves
  // one streak and not separate prints of him.
  function stampTrail(
    slot: Slot,
    body: PoweredBody,
    silhouette: RenderTexture,
    turn: number,
    continued: boolean,
  ): void {
    const { last } = slot;
    const count = continued ? trailFill(last.x, last.y, body.x, body.y, body.radius) : 1;
    const tint = hueAt(0, turn * TRAIL_TURNS);
    for (let index = 1; index <= count; index += 1) {
      let stamp = slot.stamps[index - 1];
      if (stamp === undefined) {
        stamp = { texture: silhouette, x: 0, y: 0, tint, alpha: 0 };
        slot.stamps.push(stamp);
      }
      stamp.texture = silhouette;
      stamp.x = lerp(last.x, body.x, index / count);
      stamp.y = lerp(last.y, body.y, index / count);
      stamp.tint = tint;
      stamp.alpha = body.alpha;
      stamps.push(stamp);
    }
    last.x = body.x;
    last.y = body.y;
  }

  function drawGlints(frame: Frame): void {
    const ticks = (frame.calm ? GLINT.calmBeats : GLINT.beats) * frame.tempo.ticksPerBeat;
    const live = glints.live(frame.now, ticks);
    if (live.length === 0 && !glintsShown) {
      return;
    }
    sparkles.clear();
    glintsShown = live.length > 0;
    for (const { x, y, age } of live) {
      const fade = 1 - age;
      if (frame.calm) {
        sparkles.circle(x, y, GLINT.glow * 0.6).fill({ color: 0xfff3c0, alpha: 0.4 * fade });
        continue;
      }
      sparkles.circle(x, y, GLINT.glow).fill({ color: 0xfff3c0, alpha: 0.3 * fade });
      sparkles.circle(x, y, GLINT.glow * 0.45).fill({ color: 0xfff8e0, alpha: 0.7 * fade });
      const arm = GLINT.cross * fade;
      sparkles
        .moveTo(x - arm, y)
        .lineTo(x + arm, y)
        .moveTo(x, y - arm)
        .lineTo(x, y + arm)
        .stroke({ color: 0xfff8e0, alpha: fade, width: 1.4 });
      const spread = 3 + GLINT.spread * smoothstep(age);
      for (let index = 0; index < GLINT.dots; index += 1) {
        const angle = (index * TAU) / GLINT.dots;
        sparkles
          .circle(x + Math.cos(angle) * spread, y + Math.sin(angle) * spread, 1.7 - age)
          .fill({ color: HUES[index] ?? WHITE, alpha: fade });
      }
    }
  }

  return {
    onEvent(event: SimEvent, _state: SimState, frame: Frame): void {
      glints.onEvent(event, frame.now);
    },
    update(_state: SimState, _alpha: number, frame: Frame): void {
      frameIndex += 1;
      const beats = frame.now / frame.tempo.ticksPerBeat;
      const turn = frame.calm ? 0 : -beats * (TAU / TURN_BEATS);
      if (bodies.powered.length > 0) {
        BAND_DIRECTIONS.forEach(({ angle }, index) => {
          bandHues[index] = hueAt(angle, turn);
        });
      }
      stamps.length = 0;
      for (const body of bodies.powered) {
        const slot = slotOf(body.playerId);
        const continued = slot.frame === frameIndex - 1;
        slot.frame = frameIndex;
        const silhouette = captureSilhouette(slot, body, frame.camera.scale);
        slot.root.visible = true;
        stampTrail(slot, body, silhouette, turn, continued);
        slot.flames.draw(body, flameClock(frame), turn);
        placeBand(slot, body, silhouette);
      }
      for (const slot of slots.values()) {
        if (slot.frame !== frameIndex) {
          slot.root.visible = false;
        }
      }
      trail.draw(frame, stamps);
      drawGlints(frame);
    },
    reset(): void {
      glints.clear();
      sparkles.clear();
      glintsShown = false;
      trail.reset();
      for (const slot of slots.values()) {
        slot.root.visible = false;
      }
    },
    destroy(): void {
      for (const slot of slots.values()) {
        release(slot);
        slot.flames.destroy();
      }
      trail.destroy();
      flatten.destroy({ children: true });
      palette.destroy(true);
      whiten.destroy();
    },
  };
}
