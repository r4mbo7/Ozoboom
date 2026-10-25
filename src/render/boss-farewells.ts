import type { Sprite, Texture } from 'pixi.js';
import type { PaletteToken } from '../shared/palette';
import { clamp01 } from '../shared/scalar';
import type { SimState } from '../sim/state';
import { type BossDecor, place, placeShadow } from './boss-decor';
import { GIFTS_BEATS, Gifts } from './boss-gifts';
import { BURST_AT, farewellPose } from './boss-moments';
import type { RenderContext } from './context';
import { Particles } from './effects';
import { createBurst } from './enemy-burst';
import type { Frame } from './frame';
import type { BossLook } from './textures-bosses';
import { add, hide, setTint } from './util';

const WHITE = 0xffffff;
const GLOW = { from: 0.5, radius: 1.8, alpha: 0.6 };
const CALM_COLORS = 10;

export interface FarewellSpec {
  readonly id: number;
  readonly chasedTick: number;
  readonly showStart: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly scale: number;
  readonly tilt: number;
  readonly texture: Texture;
  readonly look: BossLook;
  readonly chaserToken: PaletteToken;
}

interface Farewell {
  readonly shadow: Sprite;
  readonly mask: Sprite;
  readonly crack: Sprite;
  readonly light: Sprite;
  readonly glad: Sprite;
  readonly heart: Sprite;
  readonly smile: Sprite;
  readonly glow: Sprite;
  readonly gifts: Gifts;
  spec: FarewellSpec | null;
  burst: boolean;
  relics: boolean;
}

export interface BossFarewells {
  start(spec: FarewellSpec): void;
  dropRelics(tick: number): void;
  update(state: SimState, frame: Frame): void;
  clear(): void;
}

export function createBossFarewells(ctx: RenderContext, decor: BossDecor): BossFarewells {
  const { textures, layers } = ctx;
  const rings = new Particles(layers.fx, decor.ring, 8);
  const colors = createBurst(layers, textures);
  const items: Farewell[] = [];

  function free(): Farewell {
    const found = items.find((item) => item.spec === null);
    if (found !== undefined) {
      return found;
    }
    const sprite = () => {
      const made = add(layers.farewells, decor.shadow);
      made.visible = false;
      return made;
    };
    const glow = add(layers.fx, textures.halo);
    glow.visible = false;
    const item: Farewell = {
      shadow: sprite(),
      mask: sprite(),
      crack: sprite(),
      light: sprite(),
      glad: sprite(),
      heart: sprite(),
      smile: sprite(),
      glow,
      gifts: new Gifts(textures, decor, layers.fx, layers.farewells),
      spec: null,
      burst: false,
      relics: false,
    };
    items.push(item);
    return item;
  }

  function release(item: Farewell): void {
    item.spec = null;
    hide(item.shadow, item.mask, item.crack, item.light, item.glad, item.heart, item.smile);
    item.glow.visible = false;
    item.gifts.hide();
  }

  function burst(spec: FarewellSpec, frame: Frame): void {
    const { x, y, radius } = spec;
    const { calm, palette, show, tempo } = frame;
    colors.burst(x, y, spec.id, true, show, frame, calm ? CALM_COLORS : undefined);
    const ring = { now: show, x, y, duration: tempo.ticksPerBeat };
    if (!calm) {
      rings.spawn({
        ...ring,
        fromRadius: 1.5 * radius,
        toRadius: 4.5 * radius,
        tint: WHITE,
        peak: 1,
      });
    }
    rings.spawn({
      ...ring,
      duration: tempo.ticksPerBeat * (calm ? 2 : 1),
      fromRadius: radius,
      toRadius: 5 * radius,
      tint: palette.noyau,
      peak: calm ? 0.6 : 1,
    });
  }

  function show(item: Farewell, spec: FarewellSpec, state: SimState, frame: Frame): void {
    const { palette, calm, tempo } = frame;
    const beats = (frame.show - spec.showStart) / tempo.ticksPerBeat;
    hide(item.mask, item.crack, item.light, item.glad, item.heart, item.smile);
    item.glow.visible = false;
    const { look, x, y, radius, scale, tilt } = spec;
    const pose = farewellPose(beats, calm);
    item.shadow.visible = pose.phase !== 'gone';
    if (item.shadow.visible) {
      placeShadow(item.shadow, decor, x, y, radius, 1);
    }
    const lifted = y - pose.lift * radius;
    if (pose.phase === 'frozen') {
      const at = x + pose.tremble * radius;
      for (const [sprite, texture, tint] of [
        [item.mask, spec.texture, palette.badVibeRim],
        [item.crack, look.cracks[1].texture, palette.badVibeRim],
        [item.light, look.light.texture, palette.noyau],
      ] as const) {
        sprite.texture = texture;
        place(sprite, at, lifted, tilt, scale);
        setTint(sprite, tint);
      }
      item.light.alpha = pose.light;
      const glow = clamp01((beats - GLOW.from) * 2);
      if (glow > 0) {
        place(item.glow, at, lifted, 0, (GLOW.radius * radius) / textures.halo.radius);
        setTint(item.glow, palette.noyau);
        item.glow.alpha = GLOW.alpha * glow;
      }
    } else if (pose.phase === 'glad') {
      const color = palette[spec.chaserToken];
      for (const [sprite, shape, tint] of [
        [item.glad, look.glad, color],
        [item.heart, look.heart, WHITE],
        [item.smile, look.smile, color],
      ] as const) {
        sprite.texture = shape.texture;
        place(sprite, x, lifted, tilt, scale * pose.scale);
        setTint(sprite, tint);
      }
    }
    if (!item.burst && beats >= BURST_AT) {
      item.burst = true;
      burst(spec, frame);
    }
    item.gifts.show({ ...spec, relics: item.relics }, beats - BURST_AT, state, frame);
  }

  return {
    start(spec) {
      const item = free();
      item.spec = spec;
      item.burst = false;
      item.relics = false;
    },
    dropRelics(tick) {
      for (const item of items) {
        if (item.spec?.chasedTick === tick) {
          item.relics = true;
        }
      }
    },
    update(state, frame) {
      for (const item of items) {
        const { spec } = item;
        if (spec === null) {
          continue;
        }
        const beats = (frame.show - spec.showStart) / frame.tempo.ticksPerBeat;
        if (beats < 0 || beats >= BURST_AT + GIFTS_BEATS) {
          release(item);
        } else {
          show(item, spec, state, frame);
        }
      }
      rings.update(frame.show);
      colors.update(frame.show);
    },
    clear() {
      for (const item of items) {
        release(item);
      }
      rings.clear();
      colors.clear();
    },
  };
}
