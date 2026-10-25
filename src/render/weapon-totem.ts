import type { Sprite } from 'pixi.js';
import { clamp01, smoothstep } from '../shared/scalar';
import { isBarTick, isBeatTick, ticksIntoBar } from '../shared/tempo';
import type { EntityId, PlacedState, SimState } from '../sim/state';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import type { Shape } from './paint';
import { TOTEM_EYE_Y, TOTEM_FOOT, TOTEM_HEIGHT } from './textures-totem';
import { TotemGhosts } from './totem-ghosts';
import { add, hide, setTint } from './util';
import { ViewPool } from './views';
import type { WeaponKit } from './weapon-kit';
import type { WeaponStyle } from './weapon-looks';

// Height on screen of a totem at scale 1, foot to the tip of its flames: barely more than a
// festival-goer, and no halo (review of 2026-10-25).
const TOTEM_PX = 50;
const NO_TINT = 0xffffff;
// It is planted: it drops onto its shadow in a third of a beat, from this height in texture units,
// and squashes as it lands. In calm mode it fades in over a beat instead.
const LAND_BEATS = 1 / 3;
const DROP = 52;
const SQUASH_BEATS = 0.35;
const GHOSTS = 8;

interface Planted {
  readonly born: number;
  x: number;
  y: number;
  k: number;
  tick: number;
}

interface TotemView {
  readonly shadow: Sprite;
  readonly cone: Sprite;
  readonly body: Sprite;
  readonly eye: Sprite;
}

export interface Totems {
  begin(frame: Frame): void;
  // Draws a standing totem, and says how far it has landed, from 0 in the air to 1 on the ground.
  draw(entry: PlacedState, x: number, y: number, look: WeaponStyle, frame: Frame): number;
  end(): void;
  // Called once a frame, as the sim has no event for them: the totems a tick plants or takes
  // away, and the rings it starts.
  rings(state: SimState, frame: Frame): void;
}

function rise(share: number): number {
  return smoothstep(clamp01(share));
}

// The totem's moment in its bar, in beats: the speaker thumps and the third eye opens on the 1.
function beatsIntoBar(frame: Frame): number {
  return ticksIntoBar(frame.now, frame.tempo) / frame.tempo.ticksPerBeat;
}

export function createTotems(ctx: RenderContext, kit: WeaponKit): Totems {
  const { textures: t, layers } = ctx;
  const totem = t.weapons.totem;
  const views = new ViewPool<TotemView>(
    // On the ground with the speakers, under every bad vibe and boss.
    () => {
      const shadow = add(layers.speakers, t.weapons.shadow);
      const cone = add(layers.speakers, totem.cone);
      const body = add(layers.speakers, totem.body);
      body.anchor.set(0.5, (body.texture.height / 2 + TOTEM_FOOT) / body.texture.height);
      return { shadow, cone, body, eye: add(layers.speakers, totem.eye) };
    },
    (view) => {
      hide(view.shadow, view.cone, view.body, view.eye);
    },
  );
  const ghosts = new TotemGhosts(ctx, GHOSTS);
  const planted = new Map<EntityId, Planted>();
  let lastTick = -1;

  // A totem seen for the first time was planted on this tick; one no longer in the state leaves.
  function follow(state: SimState, frame: Frame): void {
    for (const entry of state.placed ?? []) {
      const look = kit.style(entry.weaponId);
      if (look.kind !== 'totem') {
        continue;
      }
      const k = (TOTEM_PX * look.scale) / TOTEM_HEIGHT;
      const known = planted.get(entry.id);
      if (known === undefined) {
        planted.set(entry.id, { born: state.tick, x: entry.x, y: entry.y, k, tick: state.tick });
        dust(entry, look, state.tick, frame);
      } else {
        known.x = entry.x;
        known.y = entry.y;
        known.tick = state.tick;
      }
    }
    for (const [id, known] of planted) {
      if (known.tick !== state.tick) {
        planted.delete(id);
        ghosts.spawn(known.x, known.y, known.k, state.tick);
      }
    }
  }

  // A soft ring of dust where it lands.
  function dust(entry: PlacedState, look: WeaponStyle, tick: number, frame: Frame): void {
    if (frame.calm) {
      return;
    }
    kit.transients.spawn({
      shape: t.ring,
      now: tick + LAND_BEATS * frame.tempo.ticksPerBeat,
      duration: frame.tempo.ticksPerBeat * 0.6,
      x: entry.x,
      y: entry.y,
      fromRadius: 6 * look.scale,
      toRadius: 24 * look.scale,
      tint: frame.palette.texte,
      peak: 0.35,
    });
  }

  function pulse(entry: PlacedState, look: WeaponStyle, state: SimState, frame: Frame): void {
    const { tempo, calm, palette } = frame;
    const color = palette[look.token];
    const beat = tempo.ticksPerBeat;
    const from = 12 * look.scale;
    const to = entry.radius + 6;
    const ring = (shape: Shape, delay: number, tint: number, peak: number) => {
      kit.transients.spawn({
        shape,
        now: state.tick + delay * beat,
        duration: beat * 0.55,
        x: entry.x,
        y: entry.y,
        fromRadius: from,
        toRadius: to,
        tint,
        peak,
      });
    };
    if (isBarTick(state.tick, tempo)) {
      // The thump: a thick bass ring with a white core, then two thinner echoes.
      ring(totem.bass, 0, color, calm ? 0.5 : 0.95);
      if (!calm) {
        ring(t.ring, 0, NO_TINT, 0.8);
        ring(t.ring, 0.09, color, 0.5);
        ring(t.ring, 0.18, color, 0.3);
      }
      return;
    }
    if (calm) {
      return;
    }
    // The speaker breathes in on the other beats: streaks and a faint ring close in on its foot.
    for (const [shape, peak, spin] of [
      [totem.pull, 0.7, 0.35],
      [t.ring, 0.22, 0],
    ] as const) {
      kit.transients.spawn({
        shape,
        now: state.tick,
        duration: beat * 0.9,
        x: entry.x,
        y: entry.y,
        fromRadius: entry.radius,
        toRadius: 18 * look.scale,
        spin,
        tint: color,
        peak,
      });
    }
  }

  return {
    begin(frame) {
      views.begin();
      ghosts.update(frame);
    },
    draw(entry, x, y, look, frame) {
      const { shadow, cone, body, eye } = views.acquire(entry.id);
      const { calm, tempo } = frame;
      const k = (TOTEM_PX * look.scale) / TOTEM_HEIGHT;
      const age = (frame.now - (planted.get(entry.id)?.born ?? frame.now)) / tempo.ticksPerBeat;
      const landed = calm ? clamp01(age) : clamp01(age / LAND_BEATS);
      const fall = calm ? 0 : DROP * k * (1 - landed * landed);
      const squash = calm ? 0 : Math.sin(Math.PI * clamp01((age - LAND_BEATS) / SQUASH_BEATS));
      const alpha = calm ? landed : clamp01(landed * 2);
      const b = beatsIntoBar(frame);
      const thump = 1 - rise(b / 0.3);
      const open = rise(b / 0.12) * (1 - rise((b - 0.9) / 0.5));
      const breath =
        rise((b - 0.55) / 0.55) *
        (1 - rise((b - 3.7) / 0.3)) *
        (0.5 - 0.5 * Math.cos((b % 1) * Math.PI * 2));
      const coneScale = calm ? 1 : 1 + 0.14 * thump - 0.06 * breath;
      const sy = k * (1 - 0.12 * squash);

      // The shadow comes first, and grows as the totem falls onto it.
      shadow.visible = true;
      shadow.position.set(x, y + 2);
      shadow.scale.set(((17 * look.scale) / t.weapons.shadow.radius) * (0.5 + 0.5 * landed));
      shadow.alpha = 0.4 + 0.6 * landed;

      cone.visible = true;
      setTint(cone, NO_TINT);
      cone.position.set(x, y - fall);
      cone.scale.set(k * coneScale);
      cone.alpha = alpha;

      body.visible = true;
      setTint(body, NO_TINT);
      body.position.set(x, y - fall);
      body.scale.set(k * (1 + 0.08 * squash), sy);
      body.alpha = alpha;

      eye.visible = open > 0.02;
      setTint(eye, NO_TINT);
      eye.position.set(x, y - fall + TOTEM_EYE_Y * sy);
      eye.scale.set(k, calm ? k : k * open);
      eye.alpha = alpha * (calm ? open : 1);
      return landed;
    },
    end() {
      views.end();
    },
    rings(state, frame) {
      if (state.tick === lastTick) {
        return;
      }
      lastTick = state.tick;
      follow(state, frame);
      if (!isBeatTick(state.tick, frame.tempo)) {
        return;
      }
      for (const entry of state.placed ?? []) {
        const look = kit.style(entry.weaponId);
        if (look.kind === 'totem') {
          pulse(entry, look, state, frame);
        }
      }
    },
  };
}
