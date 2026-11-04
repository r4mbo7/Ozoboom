import type { Sprite } from 'pixi.js';
import { clamp01 } from '../shared/scalar';
import type { DieState, EntityId, SimEvent, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { easeOutQuad } from './motion';
import { add, hide, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const TAU = Math.PI * 2;
const DIE_WIDTH = 30;
const HALO_RADIUS = 34;
const FADING_BARS = 4;
// A taken die rises and swells as it fades, a beat long.
const POP = { beats: 1, rise: 36, swell: 0.8 };
// A dropped die is thrown from its speaker or its boss: a high hop, then a low one that lands a beat
// after the throw, its gold ring bursting. On the show clock: a boss's dice fly while its relic is offered.
const THROW = {
  beats: 1,
  bounce: 0.6,
  // Where the first hop lands, along the way.
  along: 0.72,
  height: 0.5,
  minHeight: 44,
  rebound: 0.35,
  // Higher, nearer the eye: it grows by its height over this.
  nearer: 110,
  turns: 1.25,
  squashBeats: 0.06,
  settleBeats: 0.2,
  burstBeats: 0.7,
  trailStep: 0.05,
} as const;
const TRAIL = 5;

interface DieView {
  readonly halo: Sprite;
  readonly shadow: Sprite;
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly ring: Sprite;
  readonly trail: readonly Sprite[];
}

interface Throw {
  readonly fromX: number;
  readonly fromY: number;
  readonly start: number;
}

interface Pop {
  readonly x: number;
  readonly y: number;
  readonly start: number;
  readonly sprite: Sprite;
}

// Where the die is `beats` after its throw, z its height over the ground; past the landing, at rest.
function flight(from: Throw, die: DieState, beats: number) {
  const dx = die.x - from.fromX;
  const dy = die.y - from.fromY;
  const height = Math.max(THROW.minHeight, THROW.height * Math.sqrt(dx * dx + dy * dy));
  const first = beats < THROW.bounce;
  const u = first
    ? clamp01(beats / THROW.bounce)
    : clamp01((beats - THROW.bounce) / (THROW.beats - THROW.bounce));
  const [a, b] = first ? [0, THROW.along] : [THROW.along, 1];
  const along = a + (b - a) * u;
  const hop = first ? height : height * THROW.rebound;
  return {
    x: from.fromX + dx * along,
    y: from.fromY + dy * along,
    z: 4 * hop * u * (1 - u),
    spin: first ? -TAU * THROW.turns * (1 - u) : -(Math.PI / 2) * (1 - u),
  };
}

export function createDice(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const lying = new ViewPool<DieView>(
    () => ({
      halo: add(layers.glow, t.halo),
      shadow: add(layers.pickups, t.halo),
      outline: add(layers.pickups, t.die),
      body: add(layers.pickups, t.die),
      ring: add(layers.fx, t.ring),
      trail: Array.from({ length: TRAIL }, () => add(layers.fx, t.halo)),
    }),
    (view) => {
      hide(view.halo, view.shadow, view.outline, view.body, view.ring, ...view.trail);
    },
  );
  const throws = new Map<EntityId, Throw>();
  let pops: Pop[] = [];

  function clearPops(): void {
    for (const pop of pops) {
      pop.sprite.destroy();
    }
    pops = [];
  }

  function drawPops(frame: Frame): void {
    const duration = POP.beats * frame.tempo.ticksPerBeat;
    pops = pops.filter((pop) => {
      const progress = (frame.now - pop.start) / duration;
      if (progress >= 1 || frame.calm) {
        pop.sprite.destroy();
        return false;
      }
      pop.sprite.visible = true;
      setTint(pop.sprite, frame.palette.or);
      pop.sprite.position.set(pop.x, pop.y - POP.rise * progress);
      pop.sprite.scale.set((DIE_WIDTH / (2 * t.die.radius)) * (1 + POP.swell * progress));
      pop.sprite.alpha = 1 - progress;
      return true;
    });
  }

  // In the air: its shadow shrinks under it and a gold trail follows it.
  function drawFlight(view: DieView, from: Throw, die: DieState, beats: number, frame: Frame) {
    const at = flight(from, die, beats);
    const landing = Math.min(Math.abs(beats - THROW.bounce), Math.abs(beats - THROW.beats));
    const squash = landing < THROW.squashBeats ? 1 - landing / THROW.squashBeats : 0;
    const size = (DIE_WIDTH * (1 + at.z / THROW.nearer)) / (2 * t.die.radius);
    view.body.visible = true;
    setTint(view.body, frame.palette.or);
    view.body.position.set(at.x, at.y - at.z);
    view.body.rotation = at.spin;
    view.body.scale.set(size * (1 + 0.3 * squash), size * (1 - 0.3 * squash));
    view.body.alpha = 1;
    placeOutline(view.outline, view.body, t.die.texture, t.die.radius, frame);
    view.halo.visible = false;

    const spread = 1 / (1 + at.z / THROW.nearer);
    view.shadow.visible = true;
    setTint(view.shadow, 0x000000);
    view.shadow.position.set(at.x, at.y + 6);
    view.shadow.scale.set((18 * spread) / t.halo.radius, (7 * spread) / t.halo.radius);
    view.shadow.alpha = 0.6;

    view.trail.forEach((dot, index) => {
      const back = beats - (index + 1) * THROW.trailStep;
      dot.visible = back > 0;
      if (back <= 0) {
        return;
      }
      const past = flight(from, die, back);
      const fade = 1 - (index + 1) / (TRAIL + 1);
      setTint(dot, frame.palette.or);
      dot.position.set(past.x, past.y - past.z);
      dot.scale.set((14 * fade) / t.halo.radius);
      dot.alpha = fade;
    });
  }

  // A small ring where it bounces, a big one where it lands.
  function drawRing(view: DieView, from: Throw, die: DieState, beats: number, frame: Frame) {
    const landed = beats >= THROW.beats;
    const k = landed
      ? (beats - THROW.beats) / THROW.burstBeats
      : (beats - THROW.bounce) / (THROW.burstBeats / 2);
    view.ring.visible = k >= 0 && k < 1;
    if (!view.ring.visible) {
      return;
    }
    const along = landed ? 1 : THROW.along;
    const [inner, outer] = landed ? [16, 60] : [10, 30];
    setTint(view.ring, frame.palette.or);
    view.ring.position.set(
      from.fromX + (die.x - from.fromX) * along,
      from.fromY + (die.y - from.fromY) * along,
    );
    view.ring.scale.set((inner + (outer - inner) * easeOutQuad(k)) / t.ring.radius);
    view.ring.alpha = 1 - k;
  }

  function drawLying(view: DieView, die: DieState, sinceLanding: number, frame: Frame): void {
    const beat = frame.calm ? 0 : frame.pulse;
    const fading = !frame.calm && die.ticksLeft < FADING_BARS * frame.tempo.ticksPerBar;
    const shown = fading ? 0.45 + 0.55 * frame.pulse : 1;
    const settle = clamp01(1 - sinceLanding / THROW.settleBeats);
    const flare = clamp01(1 - sinceLanding / THROW.burstBeats);
    const size = (DIE_WIDTH * (1 + 0.06 * beat)) / (2 * t.die.radius);
    view.body.visible = true;
    setTint(view.body, frame.palette.or);
    view.body.position.set(die.x, die.y - 3 * beat);
    view.body.rotation = 0;
    view.body.scale.set(size * (1 + 0.3 * settle), size * (1 - 0.28 * settle));
    view.body.alpha = shown;
    placeOutline(view.outline, view.body, t.die.texture, t.die.radius, frame);
    view.outline.alpha = shown;
    view.halo.visible = true;
    setTint(view.halo, frame.palette.or);
    view.halo.position.set(die.x, die.y);
    view.halo.scale.set((HALO_RADIUS + 22 * flare) / t.halo.radius);
    view.halo.alpha = (0.7 + 0.3 * beat + 0.3 * flare) * frame.light.haloAlpha * shown;
    hide(view.shadow, ...view.trail);
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      lying.begin();
      for (const die of state.dice ?? []) {
        const view = lying.acquire(die.id);
        const thrown = frame.calm ? undefined : throws.get(die.id);
        const beats =
          thrown === undefined
            ? Number.POSITIVE_INFINITY
            : (frame.show - thrown.start) / frame.tempo.ticksPerBeat;
        if (thrown !== undefined && beats < THROW.beats) {
          drawFlight(view, thrown, die, beats, frame);
        } else {
          drawLying(view, die, beats - THROW.beats, frame);
        }
        if (thrown === undefined) {
          view.ring.visible = false;
        } else {
          drawRing(view, thrown, die, beats, frame);
        }
      }
      lying.end();
      for (const [id, thrown] of throws) {
        const over = frame.show - thrown.start > 2 * THROW.beats * frame.tempo.ticksPerBeat;
        if (over || lying.peek(id) === undefined) {
          throws.delete(id);
        }
      }
      drawPops(frame);
    },
    onEvent(event: SimEvent, _state: SimState, frame: Frame): void {
      if (frame.calm) {
        return;
      }
      if (event.type === 'dieDropped') {
        throws.set(event.id, { fromX: event.fromX, fromY: event.fromY, start: frame.show });
      } else if (event.type === 'dieCollected') {
        const sprite = add(layers.fx, t.die);
        pops.push({ x: event.x, y: event.y, start: frame.now, sprite });
      }
    },
    reset(): void {
      throws.clear();
      clearPops();
    },
    destroy(): void {
      lying.begin();
      lying.end();
      clearPops();
    },
  };
}
