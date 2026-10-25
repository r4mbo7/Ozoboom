import { Container, type Sprite } from 'pixi.js';
import { clamp01, lerp, smoothstep } from '../shared/scalar';
import { ticksIntoBeat } from '../shared/tempo';
import type { PlacedState } from '../sim/state';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { TAU } from './paint';
import { add, hide, setTint } from './util';
import { ViewPool } from './views';
import type { WeaponKit } from './weapon-kit';
import type { WeaponStyle } from './weapon-looks';

// Width on screen of a plate at scale 1: about a quarter of its zone.
const PLATE_PX = 36;
const NO_TINT = 0xffffff;
// It is dropped: it lands in under half a beat, from this much larger, and its shadow slides under it.
const LAND_BEATS = 0.45;
const DROP_SCALE = 0.4;
// Turns per beat: the koi chase each other, the painted rim drifts.
const SPIN = 0.3;
const DRIFT = 0.018;
// The rim gathers onto its radius as it is laid, and swells a little on each beat.
const GATHER_BEATS = 0.8;
const BEAT_SWELL = 0.15;
// On its last beat the plate shrinks to this before it is gone.
const END_SCALE = 0.55;

interface PlateView {
  id: number;
  readonly rim: Sprite;
  readonly gilt: Sprite;
  readonly shadow: Sprite;
  readonly dish: Sprite;
  readonly glint: Sprite;
}

export interface Plates {
  begin(): void;
  draw(entry: PlacedState, x: number, y: number, look: WeaponStyle, frame: Frame): void;
  end(): void;
}

// Its rim goes into zones, on the ground with the speakers like its dish: under every bad vibe and boss.
export function createPlates(ctx: RenderContext, kit: WeaponKit, zones: Container): Plates {
  const { textures: t, layers } = ctx;
  const plate = t.weapons.plate;
  // Every dish above every zone.
  const dishes = layers.speakers.addChild(new Container());
  const views = new ViewPool<PlateView>(
    () => ({
      id: -1,
      rim: add(zones, plate.rim),
      gilt: add(zones, plate.gilt),
      shadow: add(dishes, t.weapons.shadow),
      dish: add(dishes, plate.dish),
      glint: add(dishes, plate.glint),
    }),
    (view) => {
      view.id = -1;
      hide(view.rim, view.gilt, view.shadow, view.dish, view.glint);
    },
  );

  // A white ring where it lands, once.
  function landing(entry: PlacedState, look: WeaponStyle, frame: Frame, age: number): void {
    if (frame.calm || age > LAND_BEATS) {
      return;
    }
    const beat = frame.tempo.ticksPerBeat;
    kit.transients.spawn({
      shape: t.ring,
      now: frame.now + (LAND_BEATS - age) * beat,
      duration: beat * 0.6,
      x: entry.x,
      y: entry.y,
      fromRadius: (PLATE_PX / 2) * look.scale,
      toRadius: (PLATE_PX / 2 + 14) * look.scale,
      tint: NO_TINT,
      peak: 0.55,
    });
  }

  return {
    begin() {
      views.begin();
    },
    draw(entry, x, y, look, frame) {
      const view = views.acquire(entry.id);
      const { rim, gilt, shadow, dish, glint } = view;
      const { calm, tempo, palette } = frame;
      const beat = tempo.ticksPerBeat;
      const effect = look.look.effect;
      const lasts = effect.kind === 'plate' ? effect.durationBars * tempo.ticksPerBar : 0;
      const age = Math.max(0, lasts - entry.ticksLeft) / beat;
      if (view.id !== entry.id) {
        view.id = entry.id;
        landing(entry, look, frame, age);
      }
      const landed = calm ? 1 : smoothstep(clamp01(age / LAND_BEATS));
      const fade = calm ? 1 : Math.min(1, entry.ticksLeft / beat);
      const beats = frame.now / beat;

      const gathered = calm ? 1 : smoothstep(clamp01((age - LAND_BEATS) / GATHER_BEATS));
      const swell = calm
        ? 0
        : BEAT_SWELL * (1 - smoothstep(clamp01(ticksIntoBeat(frame.now, tempo) / beat / 0.4)));
      const rimScale = (entry.radius / plate.rim.radius) * (0.85 + 0.15 * gathered);
      const rimTurn = calm ? 0 : beats * TAU * DRIFT;
      for (const sprite of [rim, gilt]) {
        sprite.visible = true;
        sprite.position.set(x, y);
        sprite.rotation = rimTurn;
        sprite.scale.set(rimScale);
      }
      setTint(rim, palette[look.token]);
      rim.alpha = gathered * fade * (1 - BEAT_SWELL + swell);
      setTint(gilt, palette.or);
      gilt.alpha = 0.75 * gathered * fade;

      const k = ((PLATE_PX / 2) * look.scale) / plate.dish.radius;
      const scale = k * lerp(1 + DROP_SCALE, 1, landed) * lerp(END_SCALE, 1, fade);
      const fall = 1 - landed;
      const alpha = landed * fade;
      shadow.visible = true;
      shadow.position.set(x + 1.5 + 5 * fall, y + 2.5 + 6 * fall);
      shadow.scale.set((scale * plate.dish.radius * 1.2) / t.weapons.shadow.radius);
      shadow.alpha = alpha;
      dish.visible = true;
      setTint(dish, NO_TINT);
      dish.position.set(x, y);
      dish.rotation = calm ? 0 : beats * TAU * SPIN;
      dish.scale.set(scale);
      dish.alpha = alpha;
      glint.visible = true;
      setTint(glint, NO_TINT);
      glint.position.set(x, y);
      glint.scale.set(scale);
      glint.alpha = alpha;
    },
    end() {
      views.end();
    },
  };
}
