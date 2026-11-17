import { Container, Graphics, type Sprite } from 'pixi.js';
import { clamp01, smoothstep } from '../shared/scalar';
import type { CoreState } from '../sim/state';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { hash } from './hash';
import { easeOutQuad } from './motion';
import { WHITE } from './palette';
import type { Repair } from './stage-repair';
import { LOST_GREY, drawSpray } from './stage-repair-spray';
import { NAME_TEXTURE_SCALE } from './textures-names';
import { add, hide, setTint } from './util';

const TAU = Math.PI * 2;
// The review drawings' stage radius, from which their sizes scale.
export const DRAWN_DOME = 31;

// In beats from the landing, as chosen on the review page (.lavish/soin-de-la-scene).
const LAND = 0.8;
const POP = 0.25;
const HOLD = 2;
const RISE = 1.6;
const FADE_FROM = 2.3;
const GONE = 3.6;
const LOST = 2;
const PUFF = 0.4;
const PLUS_LIFE = 1.6;
const PLUS_SPREAD = 2.4;
const PLUS_DELAY = 0.15;

// The number, the size of the stage's hit numbers doubled; its offsets in screen pixels.
const NUMBER_SIZE = 2.3;
const NUMBER_GAP = 24;
const NUMBER_RISE = 16;

const PLUSES = 12;
// The plus signs' outline, dark at every hour so their green holds on the dawn ground too.
const PLUS_EDGE = 0x060a1c;

// A dozen plus signs around the stage, none on top where the number holds.
const PLUS_SIGNS = Array.from({ length: PLUSES }, (_, index) => ({
  angle:
    -Math.PI / 2 + 1.1 + ((index + 0.5) / PLUSES) * (TAU - 2.2) + (hash(index, 1) - 0.5) * 0.25,
  start: PLUS_DELAY + (((index * 5) % PLUSES) / PLUSES) * PLUS_SPREAD,
  size: 2.4 + hash(index, 2) * 1.4,
  sway: hash(index, 3) * TAU,
}));

// Where the bolt lands on the ring.
function impactOf(repair: Repair, core: Pick<CoreState, 'x' | 'y'>, ringRadius: number) {
  return {
    x: core.x + Math.cos(repair.toward) * ringRadius,
    y: core.y + Math.sin(repair.toward) * ringRadius,
  };
}

function plusSign(size: number): { root: Container; edge: Graphics; fill: Graphics } {
  const root = new Container();
  const cross = (graphics: Graphics, width: number) =>
    graphics
      .moveTo(-size, 0)
      .lineTo(size, 0)
      .moveTo(0, -size)
      .lineTo(0, size)
      .stroke({ width, color: WHITE, cap: 'round' });
  const edge = root.addChild(cross(new Graphics(), size * 0.9 + 2.4));
  const fill = root.addChild(cross(new Graphics(), size * 0.9));
  return { root, edge, fill };
}

export interface RepairFx {
  update(
    repair: Repair,
    since: number,
    core: Pick<CoreState, 'x' | 'y' | 'radius'>,
    ringRadius: number,
    frame: Frame,
  ): void;
  hide(): void;
}

export function createRepairFx(ctx: RenderContext): RepairFx {
  const { textures: t, layers } = ctx;
  const numberGlow = add(layers.fx, t.halo);
  const landGlow = add(layers.fx, t.halo);
  const landWhite = add(layers.fx, t.halo);
  const landRing = add(layers.fx, t.ring);
  // In the plain layer: at night the fx layer adds light, which would wash their grey and green out.
  const sparks = layers.bubbles.addChild(new Graphics());
  const pluses = PLUS_SIGNS.map((sign) => ({ sign, ...plusSign(sign.size) }));
  for (const plus of pluses) {
    layers.bubbles.addChild(plus.root);
  }
  const edge = add(layers.bubbles, t.halo);
  const fill = add(layers.bubbles, t.halo);
  let label = '';

  function hideAll(): void {
    hide(numberGlow, landGlow, landWhite, landRing, edge, fill);
    sparks.clear();
    for (const plus of pluses) {
      plus.root.visible = false;
    }
  }
  hideAll();

  function glowAt(
    sprite: Sprite,
    x: number,
    y: number,
    radius: number,
    tint: number,
    alpha: number,
  ) {
    sprite.visible = alpha > 0;
    sprite.position.set(x, y);
    sprite.scale.set(radius / t.halo.radius);
    setTint(sprite, tint);
    sprite.alpha = alpha;
  }

  function showNumber(
    text: string,
    tint: number,
    size: number,
    lift: number,
    alpha: number,
    core: Pick<CoreState, 'x' | 'y'>,
    ringRadius: number,
    frame: Frame,
  ): void {
    if (text !== label) {
      label = text;
      const texts = t.names.get(text);
      fill.texture = texts.fill;
      edge.texture = texts.edge;
    }
    const { camera, light, palette } = frame;
    const y = core.y - ringRadius - (NUMBER_GAP + NUMBER_RISE * lift) / camera.scale;
    const scale = (NUMBER_SIZE * size) / (NAME_TEXTURE_SCALE * camera.scale);
    for (const sprite of [edge, fill]) {
      sprite.visible = alpha > 0;
      sprite.position.set(core.x, y);
      sprite.scale.set(scale);
    }
    setTint(fill, tint);
    setTint(edge, light.additive ? palette.sol : palette.texte);
    fill.alpha = alpha;
    edge.alpha = (light.additive ? 0.7 : 0.9) * alpha;
  }

  function healed(
    repair: Repair,
    since: number,
    core: Pick<CoreState, 'x' | 'y' | 'radius'>,
    ringRadius: number,
    frame: Frame,
  ) {
    const { palette, calm, light } = frame;
    const scale = core.radius / DRAWN_DOME;
    const impact = impactOf(repair, core, ringRadius);
    const land = since / LAND;
    const landing = !calm && land >= 0 && land < 1;
    if (landing) {
      glowAt(landWhite, impact.x, impact.y, 22 * scale, WHITE, 0.9 * (1 - land));
      glowAt(landGlow, impact.x, impact.y, 30 * scale, palette.healer, 0.6 * (1 - land));
      landRing.visible = true;
      landRing.position.set(impact.x, impact.y);
      landRing.scale.set(((4 + 14 * smoothstep(land)) * scale) / t.ring.radius);
      setTint(landRing, palette.healer);
      landRing.alpha = 1 - land;
    }
    for (const { sign, root, edge: rim, fill: body } of pluses) {
      const age = (since - sign.start) / PLUS_LIFE;
      root.visible = !calm && age >= 0 && age < 1;
      if (!root.visible) {
        continue;
      }
      const reach = ringRadius + 6 * scale;
      root.position.set(
        core.x + Math.cos(sign.angle) * reach + Math.sin(sign.sway + age * 5) * 3 * scale,
        core.y + Math.sin(sign.angle) * reach - 24 * scale * smoothstep(age),
      );
      root.scale.set(scale * (age < 0.15 ? smoothstep(age / 0.15) : 1));
      root.alpha = 1 - age * age;
      setTint(body, palette.healer);
      setTint(rim, PLUS_EDGE);
    }
    const pop = calm || since >= POP ? 1 : smoothstep(clamp01(since / POP));
    const over = calm ? 1 : 1 + 0.35 * Math.exp(-6 * Math.max(0, since - POP)) * pop;
    const fade = 1 - clamp01((since - FADE_FROM) / (GONE - FADE_FROM));
    const shown = since >= 0 && since < GONE;
    const lift = smoothstep(clamp01((since - HOLD) / RISE));
    glowAt(
      numberGlow,
      core.x,
      core.y - ringRadius - NUMBER_GAP / frame.camera.scale,
      30 * scale,
      palette.healer,
      shown ? 0.3 * fade * pop * light.haloAlpha : 0,
    );
    showNumber(
      `+${String(Math.round(repair.amount))}`,
      palette.healer,
      pop * over,
      lift,
      shown ? fade : 0,
      core,
      ringRadius,
      frame,
    );
  }

  function lost(
    since: number,
    repair: Repair,
    core: Pick<CoreState, 'x' | 'y' | 'radius'>,
    ringRadius: number,
    frame: Frame,
  ) {
    const scale = core.radius / DRAWN_DOME;
    const impact = impactOf(repair, core, ringRadius);
    const calm = frame.calm;
    glowAt(
      landGlow,
      impact.x,
      impact.y,
      16 * scale,
      LOST_GREY,
      !calm && since >= 0 && since < PUFF ? 0.55 * (1 - since / PUFF) : 0,
    );
    if (!calm) {
      drawSpray(sparks, impact, repair.toward, since, scale);
    }
    const age = since / LOST;
    const pop = calm || since >= POP ? 0 : 0.4 * (1 - since / POP);
    showNumber(
      '+0',
      LOST_GREY,
      1 + pop,
      easeOutQuad(clamp01(age)),
      since >= 0 && age < 1 ? 1 - age * age : 0,
      core,
      ringRadius,
      frame,
    );
  }

  return {
    update(repair, since, core, ringRadius, frame): void {
      hideAll();
      if (repair.amount > 0) {
        healed(repair, since, core, ringRadius, frame);
      } else {
        lost(since, repair, core, ringRadius, frame);
      }
    },
    hide: hideAll,
  };
}
