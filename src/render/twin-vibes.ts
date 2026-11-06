import { Graphics, type Sprite } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { SimEvent, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { easeOutCubic } from './motion';
import { add, hide, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const TAU = Math.PI * 2;
const LYING = { star: 17, orbit: 15, halo: 44 };
const CARRIED = { star: 11, orbit: 9, lift: 22 };
const CARRIER_GAP = 7;
// The dark rim under each star, in pixels past it: what sets them apart from the vibes on the floor.
const SHADE = 4;
const FADING_BARS = 4;
const THREAD = { width: 2, alpha: 0.85 };
const TAKEN = { bars: 1, from: 18, to: 96, line: 5 };
// While the vibes are doubled: a gold halo on every player, dimmer bar after bar, and two vibe sparks
// rising off the shoulders on each beat, then one, then none.
const AURA = { reach: 3.2, core: 1.7, dimmest: 0.4, rest: 0.9, beat: 0.25, downbeat: 0.25 };
const SPARK = { from: 10, to: 6, rise: 30, drift: 8, shoulder: 0.8, lift: 0.4 };

interface TwinsView {
  readonly halo: Sprite;
  readonly shades: readonly [Sprite, Sprite];
  readonly outlines: readonly [Sprite, Sprite];
  readonly bodies: readonly [Sprite, Sprite];
}

interface CarrierView extends TwinsView {
  readonly ring: Sprite;
}

interface AuraView {
  readonly halo: Sprite;
  readonly core: Sprite;
  readonly sparks: readonly [Sprite, Sprite];
}

interface Taken {
  x: number;
  y: number;
  start: number;
}

// One turn a bar around their middle, the two always face to face.
function twinAngle(now: number, ticksPerBar: number): number {
  return (TAU * now) / ticksPerBar;
}

export function createTwinVibes(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const twins = (layer: typeof layers.pickups): TwinsView => ({
    halo: add(layers.glow, t.halo),
    shades: [add(layer, t.vibes), add(layer, t.vibes)],
    outlines: [add(layer, t.vibes), add(layer, t.vibes)],
    bodies: [add(layer, t.vibes), add(layer, t.vibes)],
  });
  const hideTwins = (view: TwinsView): void => {
    hide(view.halo, ...view.shades, ...view.outlines, ...view.bodies);
  };
  const lying = new ViewPool<TwinsView>(() => twins(layers.pickups), hideTwins);
  const carriers = new ViewPool<CarrierView>(
    () => ({ ring: add(layers.bubbles, t.ring), ...twins(layers.bubbles) }),
    (view) => {
      hide(view.ring);
      hideTwins(view);
    },
  );
  // Under the stars of their layer: the pools add their sprites after.
  const groundThreads = new Graphics();
  layers.pickups.addChild(groundThreads);
  const carriedThreads = new Graphics();
  layers.bubbles.addChild(carriedThreads);
  const rings = new Graphics();
  layers.fx.addChild(rings);
  const taken: Taken[] = [];
  const auras = new ViewPool<AuraView>(
    () => ({
      halo: add(layers.glow, t.halo),
      core: add(layers.glow, t.halo),
      sparks: [add(layers.bubbles, t.vibes), add(layers.bubbles, t.vibes)],
    }),
    (view) => {
      hide(view.halo, view.core, ...view.sparks);
    },
  );

  function placeTwins(
    view: TwinsView,
    x: number,
    y: number,
    look: { star: number; orbit: number },
    threads: Graphics,
    frame: Frame,
  ): void {
    const angle = twinAngle(frame.now, frame.tempo.ticksPerBar);
    const dx = look.orbit * Math.cos(angle);
    const dy = look.orbit * Math.sin(angle);
    view.bodies.forEach((body, index) => {
      const side = index === 0 ? 1 : -1;
      body.visible = true;
      setTint(body, frame.palette.or);
      body.position.set(x + side * dx, y + side * dy);
      body.scale.set(look.star / t.vibes.radius);
      body.rotation = angle;
      const outline = view.outlines[index];
      if (outline !== undefined) {
        placeOutline(outline, body, t.vibes.texture, t.vibes.radius, frame);
      }
      const shade = view.shades[index];
      if (shade !== undefined) {
        shade.visible = true;
        setTint(shade, frame.palette.sol);
        shade.position.copyFrom(body.position);
        shade.rotation = angle;
        shade.scale.set((look.star + SHADE) / t.vibes.radius);
      }
    });
    threads
      .moveTo(x + dx, y + dy)
      .lineTo(x - dx, y - dy)
      .stroke({ width: THREAD.width, color: frame.palette.or, alpha: THREAD.alpha });
  }

  function placeHalo(halo: Sprite, x: number, y: number, radius: number, frame: Frame): void {
    halo.visible = true;
    setTint(halo, frame.palette.or);
    halo.position.set(x, y);
    halo.scale.set(radius / t.halo.radius);
  }

  function placeAuras(state: SimState, alpha: number, frame: Frame): void {
    auras.begin();
    const twins = state.twinVibes;
    const bars = frame.set.twinVibes?.bars;
    if (twins?.stage === 'doubling' && bars !== undefined) {
      const { ticksPerBar, ticksPerBeat, originTick } = frame.tempo;
      const barsLeft = Math.ceil(twins.ticksLeft / ticksPerBar);
      const left = barsLeft / bars;
      const beat = frame.calm ? 0 : frame.pulse;
      const sinceBar = (frame.now - originTick) % ticksPerBar;
      const downbeat = sinceBar < ticksPerBeat ? beat : 0;
      const blink = barsLeft <= 1 && !frame.calm ? 0.35 + 0.65 * frame.pulse : 1;
      const strength = (AURA.dimmest + (1 - AURA.dimmest) * left) * blink;
      const sparks = left > 2 / 3 ? 2 : left > 1 / 3 ? 1 : 0;
      const age = (sinceBar % ticksPerBeat) / ticksPerBeat;
      for (const player of state.players) {
        if (player.downed || player.gone === true) {
          continue;
        }
        const view = auras.acquire(player.id);
        const x = lerp(player.prevX, player.x, alpha);
        const y = lerp(player.prevY, player.y, alpha);
        placeHalo(view.halo, x, y, player.radius * AURA.reach, frame);
        const breath = strength * (AURA.rest + AURA.beat * beat + AURA.downbeat * downbeat);
        view.halo.alpha = breath * frame.light.haloAlpha;
        placeHalo(view.core, x, y, player.radius * AURA.core, frame);
        view.core.alpha = Math.min(1, breath) * frame.light.haloAlpha;
        view.sparks.forEach((spark, index) => {
          if (index >= sparks) {
            spark.visible = false;
            return;
          }
          const side = index === 0 ? -1 : 1;
          spark.visible = true;
          setTint(spark, frame.palette.or);
          spark.position.set(
            x + side * (player.radius * SPARK.shoulder + SPARK.drift * age),
            y - player.radius * SPARK.lift - SPARK.rise * age,
          );
          spark.scale.set((SPARK.from + (SPARK.to - SPARK.from) * age) / t.vibes.radius);
          spark.alpha = 1 - age;
        });
      }
    }
    auras.end();
  }

  function drawTaken(frame: Frame): void {
    rings.clear();
    const duration = TAKEN.bars * frame.tempo.ticksPerBar;
    let kept = 0;
    for (const item of taken) {
      const progress = (frame.now - item.start) / duration;
      if (progress >= 1) {
        continue;
      }
      taken[kept] = item;
      kept += 1;
      if (progress < 0) {
        continue;
      }
      const radius = TAKEN.from + (TAKEN.to - TAKEN.from) * easeOutCubic(progress);
      rings
        .circle(item.x, item.y, radius)
        .stroke({ width: TAKEN.line, color: frame.palette.or, alpha: 1 - progress });
    }
    taken.length = kept;
  }

  return {
    onEvent(event: SimEvent, state: SimState): void {
      if (event.type === 'twinVibesTaken') {
        const player = state.players.find(({ id }) => id === event.playerId);
        taken.push({ x: player?.x ?? event.x, y: player?.y ?? event.y, start: state.tick });
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const beat = frame.calm ? 0 : frame.pulse;
      groundThreads.clear();
      carriedThreads.clear();
      lying.begin();
      const ground = state.twinVibes;
      if (ground?.stage === 'lying') {
        const view = lying.acquire(ground.id);
        const fading = !frame.calm && ground.ticksLeft < FADING_BARS * frame.tempo.ticksPerBar;
        placeTwins(view, ground.x, ground.y, LYING, groundThreads, frame);
        placeHalo(view.halo, ground.x, ground.y, LYING.halo, frame);
        view.halo.alpha = (0.7 + 0.3 * beat) * frame.light.haloAlpha;
        const shown = fading ? 0.45 + 0.55 * frame.pulse : 1;
        for (const sprite of [...view.bodies, ...view.outlines, ...view.shades]) {
          sprite.alpha = shown;
        }
      }
      lying.end();

      carriers.begin();
      for (const enemy of state.enemies) {
        if (enemy.carriesTwinVibes !== true) {
          continue;
        }
        const view = carriers.acquire(enemy.id);
        const x = lerp(enemy.prevX, enemy.x, alpha);
        const y = lerp(enemy.prevY, enemy.y, alpha);
        placeHalo(view.halo, x, y, enemy.radius * 2.6, frame);
        view.halo.alpha = frame.light.haloAlpha;
        view.ring.visible = true;
        setTint(view.ring, frame.palette.or);
        view.ring.position.set(x, y);
        view.ring.scale.set((enemy.radius + CARRIER_GAP) / t.ring.radius);
        view.ring.alpha = 0.85 + 0.15 * beat;
        placeTwins(
          view,
          x,
          y - enemy.radius - CARRIED.lift - 3 * beat,
          CARRIED,
          carriedThreads,
          frame,
        );
      }
      carriers.end();

      placeAuras(state, alpha, frame);
      drawTaken(frame);
    },
    reset(): void {
      taken.length = 0;
      groundThreads.clear();
      carriedThreads.clear();
      rings.clear();
    },
    destroy(): void {
      lying.begin();
      lying.end();
      carriers.begin();
      carriers.end();
      auras.begin();
      auras.end();
      groundThreads.destroy();
      carriedThreads.destroy();
      rings.destroy();
    },
  };
}
