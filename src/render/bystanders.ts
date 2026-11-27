import type { Sprite } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { BystanderState, SimEvent, SimState } from '../sim/state';
import type { BystanderLook, Family, RenderContext } from './context';
import { Particles } from './effects';
import type { Frame } from './frame';
import { ringStep } from './help';
import { beatEnvelope } from './motion';
import { mixColor } from './palette';
import { beadsLit, crossStep } from './raver-cues';
import {
  CROSS_LIFT,
  CROSS_RADIUS,
  MASK_RADIUS,
  MASK_SCALE,
  createRaverFarewells,
  paleOf,
} from './raver-farewells';
import { createRaverReward } from './raver-reward';
import { add, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const RING_RADIUS = 26;
// The beads sit on an arc under the face, one per bar of its lifetime: the rightmost goes out first.
const BEAD_ARC = 9;
const BEAD_SPREAD = 0.4;
const BEAD_RADIUS = 3.2;

interface BystanderView {
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly glow: Sprite;
  readonly cross: Sprite;
  readonly ring: Sprite;
  readonly beads: readonly Sprite[];
  lit: number;
  help: number;
  leaking: boolean;
}

export function createBystanders(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const t = textures.specials;
  const maxBeads = Math.max(
    0,
    ...[...ctx.bystanderLooks.values()].map((look) => look.lifetimeBars),
  );
  const views = new ViewPool<BystanderView>(
    () => ({
      outline: add(layers.bystanders, t.distress),
      body: add(layers.bystanders, t.distress),
      glow: add(layers.bystanders, textures.halo),
      cross: add(layers.bystanders, t.cross),
      ring: add(layers.bystanders, t.helpRing[0] ?? t.distress),
      beads: Array.from({ length: maxBeads }, () => add(layers.bystanders, t.bead)),
      lit: 0,
      help: 0,
      leaking: false,
    }),
    (view) => {
      hide(view.outline, view.body, view.glow, view.cross, view.ring, ...view.beads);
      view.lit = 0;
      view.help = 0;
      view.leaking = false;
    },
  );
  const pops = new Particles(layers.fx, textures.ring, 16);
  const farewells = createRaverFarewells(layers.bystanders, layers.fx, textures);
  const reward = createRaverReward(layers.fx, textures);

  function drawCross(
    view: BystanderView,
    bystander: BystanderState,
    look: BystanderLook,
    x: number,
    y: number,
    frame: Frame,
  ): void {
    const { palette, tempo, calm, now } = frame;
    const lifetime = look.lifetimeBars * tempo.ticksPerBar;
    const lastBar = bystander.ticksLeft <= tempo.ticksPerBar;
    const eighth = tempo.ticksPerBeat / 2;
    const beat = calm
      ? 0
      : lastBar
        ? beatEnvelope(((now - tempo.originTick) % eighth) * 2, tempo)
        : frame.pulse;
    const { cross, glow } = view;
    const cy = y - bystander.radius - CROSS_LIFT;
    cross.visible = true;
    cross.texture = (t.crossClock[crossStep(bystander.ticksLeft, lifetime)] ?? t.cross).texture;
    setTint(cross, palette.healer);
    cross.position.set(x, cy);
    cross.scale.set((8 / CROSS_RADIUS) * (1 + (lastBar ? 0.4 : 0.3) * beat));
    glow.visible = lastBar && !calm;
    if (glow.visible) {
      setTint(glow, palette.healer);
      glow.position.set(x, cy);
      glow.scale.set(14 / textures.halo.radius);
      glow.alpha = 0.6 * beat;
    }
  }

  function drawBeads(
    view: BystanderView,
    bystander: BystanderState,
    look: BystanderLook,
    x: number,
    y: number,
    frame: Frame,
  ): void {
    const { palette, tempo, pulse, calm, now } = frame;
    const count = look.lifetimeBars;
    const lit = beadsLit(bystander.ticksLeft, tempo.ticksPerBar, count);
    const arc = bystander.radius + BEAD_ARC;
    for (let index = 0; index < view.beads.length; index += 1) {
      const bead = view.beads[index];
      if (bead === undefined) {
        continue;
      }
      if (index >= count) {
        bead.visible = false;
        continue;
      }
      const angle = Math.PI / 2 + ((count - 1) / 2 - index) * BEAD_SPREAD;
      const bx = x + Math.cos(angle) * arc;
      const by = y + Math.sin(angle) * arc;
      if (index < view.lit && index >= lit) {
        pops.spawn({
          now,
          duration: tempo.ticksPerBeat * 0.6,
          x: bx,
          y: by,
          fromRadius: BEAD_RADIUS * 1.2,
          toRadius: BEAD_RADIUS * 2.8,
          tint: palette.healer,
          peak: 0.7,
        });
      }
      bead.visible = true;
      bead.position.set(bx, by);
      const on = index < lit;
      const blink = on && lit === 1 && !calm ? 0.3 + 0.7 * pulse : 1;
      setTint(bead, on ? palette.healer : palette.badVibe);
      bead.alpha = on ? blink : 0.55;
      bead.scale.set((BEAD_RADIUS / t.bead.radius) * (on && lit === 1 ? 1 + 0.25 * pulse : 1));
    }
    view.lit = lit;
  }

  function drawRing(
    view: BystanderView,
    bystander: BystanderState,
    look: BystanderLook,
    x: number,
    y: number,
    frame: Frame,
  ): void {
    const { palette } = frame;
    if (bystander.helpTicks !== view.help) {
      view.leaking = bystander.helpTicks < view.help;
      view.help = bystander.helpTicks;
    }
    const step = ringStep(bystander.helpTicks, look.helpTicks);
    const { ring } = view;
    ring.visible = step > 0;
    if (step > 0) {
      ring.texture = (t.helpRing[step] ?? t.helpRing[0] ?? t.distress).texture;
      setTint(ring, view.leaking ? mixColor(palette.healer, 0xffffff, 0.45) : palette.healer);
      ring.alpha = view.leaking ? 0.6 : 1;
      ring.position.set(x, y);
      ring.scale.set((bystander.radius + 9) / RING_RADIUS);
    }
  }

  function reset(): void {
    pops.clear();
    farewells.reset();
    reward.reset();
  }

  return {
    onEvent(event: SimEvent, state: SimState): void {
      if (event.type === 'bystanderHelped') {
        farewells.start('helped', state.tick, event.x, event.y, 11);
        const look = lookup(ctx.bystanderLooks, event.kind, 'bystander');
        reward.start(state.tick, event.x, event.y, look.vibesReward);
      } else if (event.type === 'bystanderLost') {
        farewells.start(event.reason, state.tick, event.x, event.y, 11);
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { calm, now } = frame;
      const pale = paleOf(frame);
      views.begin();
      for (const bystander of state.bystanders ?? []) {
        const view = views.acquire(bystander.id);
        const look = lookup(ctx.bystanderLooks, bystander.kind, 'bystander');
        const x = lerp(bystander.prevX, bystander.x, alpha);
        const y = lerp(bystander.prevY, bystander.y, alpha);
        const { body, outline } = view;
        body.visible = true;
        body.texture = t.distress.texture;
        setTint(body, pale);
        body.position.set(x, y);
        body.scale.set((bystander.radius * MASK_SCALE) / MASK_RADIUS);
        body.rotation = calm ? 0 : Math.sin(now * 0.35 + bystander.id) * 0.1;
        placeOutline(outline, body, t.distress.texture, MASK_RADIUS, frame);
        drawCross(view, bystander, look, x, y, frame);
        drawBeads(view, bystander, look, x, y, frame);
        drawRing(view, bystander, look, x, y, frame);
      }
      views.end();
      farewells.update(frame);
      pops.update(now);
      reward.update(state, alpha, frame);
    },
    reset,
    destroy(): void {
      reset();
    },
  };
}
