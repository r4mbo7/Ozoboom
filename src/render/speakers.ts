import { Graphics, type Sprite } from 'pixi.js';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import type { SimEvent, SimState, SpeakerState } from '../sim/state';
import type { Family, RenderContext, SpeakerLook } from './context';
import type { Frame } from './frame';
import { drawCable, mixColor, plugShare, speakerToken, strokeCircle } from './speaker-kit';
import { add, hide, lookup, placeOutline, setTint } from './util';
import { ViewPool } from './views';

const NO_LOOKS: ReadonlyMap<string, SpeakerLook> = new Map();
const TAU = Math.PI * 2;
const MARKS = 5;
const CLOUDS = 3;
const FLASH_TICKS = TICKS_PER_BEAT;
const SHOCK_TICKS = TICKS_PER_BEAT / 2;
const DRIFT_TICKS = TICKS_PER_BAR * 2;
const STACK_SCALE = 0.8 / 32;
const OFF_LIFT = 0.35;
const BEAMS = 3;
const SWEEP_TICKS = TICKS_PER_BAR * 8;
const BEAM_REACH = 1.15;
const BEAM_ALPHA = 0.55;
const HALO_REACH = 0.62;

interface SpeakerView {
  readonly zone: Sprite;
  readonly cable: Graphics;
  readonly cableGlow: Graphics;
  readonly outline: Sprite;
  readonly body: Sprite;
  readonly track: Graphics;
  readonly arc: Graphics;
  readonly halo: Sprite;
  readonly beams: readonly Sprite[];
  readonly shock: Sprite;
  readonly flash: Sprite;
  readonly marks: readonly Sprite[];
  cableKey: string;
  arcShare: number;
}

export function createSpeakers(ctx: RenderContext): Family {
  const { textures: t, layers } = ctx;
  const beats = { last: Number.NEGATIVE_INFINITY };
  const flashes = new Map<string, number>();

  const views = new ViewPool<SpeakerView>(
    () => {
      const beams = Array.from({ length: BEAMS }, () => add(layers.speakers, t.sweep, 0));
      const zone = add(layers.speakers, t.zone);
      const cable = new Graphics();
      layers.speakers.addChild(cable);
      const cableGlow = new Graphics();
      layers.glow.addChild(cableGlow);
      const outline = add(layers.speakers, t.stack);
      const body = add(layers.speakers, t.stack);
      const track = new Graphics();
      const arc = new Graphics();
      layers.speakers.addChild(track, arc);
      const marks = Array.from({ length: MARKS }, () => add(layers.speakers, t.traps.mist));
      return {
        zone,
        cable,
        cableGlow,
        outline,
        body,
        track,
        arc,
        halo: add(layers.glow, t.halo),
        beams,
        shock: add(layers.fx, t.ring),
        flash: add(layers.fx, t.ring),
        marks,
        cableKey: '',
        arcShare: Number.NaN,
      };
    },
    (view) => {
      hide(
        view.zone,
        view.outline,
        view.body,
        view.halo,
        view.shock,
        view.flash,
        ...view.beams,
        ...view.marks,
      );
      view.cable.clear();
      view.cableGlow.clear();
      view.track.clear();
      view.arc.clear();
      view.cableKey = '';
      view.arcShare = Number.NaN;
    },
  );

  function drawAura(
    view: SpeakerView,
    speaker: SpeakerState,
    look: SpeakerLook,
    color: number,
    frame: Frame,
  ): void {
    const { aura } = look;
    const { light, pulse, calm, now } = frame;
    const radius = 'radius' in aura ? aura.radius : speaker.radius * 2;
    const x = speaker.x;
    const y = speaker.y;

    const glowShare = aura.kind === 'shockwave' ? 0.3 : aura.kind === 'lure' ? 0.4 : 0.5;
    setTint(view.halo, color);
    view.halo.visible = true;
    view.halo.position.set(x, y);
    view.halo.scale.set((radius * HALO_REACH) / t.halo.radius);
    view.halo.alpha = glowShare * (0.7 + 0.3 * pulse) * light.haloAlpha;

    const sweep = calm ? 0 : (now / SWEEP_TICKS) * TAU;
    for (const [index, beam] of view.beams.entries()) {
      setTint(beam, color);
      beam.visible = true;
      beam.position.set(x, y);
      beam.rotation = sweep + (index / BEAMS) * TAU;
      beam.scale.set((radius * BEAM_REACH) / t.sweep.radius);
      beam.alpha = BEAM_ALPHA * (calm ? 0.5 : 1) * light.haloAlpha;
      beam.blendMode = light.additive ? 'add' : 'normal';
    }

    const shape = aura.kind === 'lure' ? t.traps.lure : t.traps.mist;
    const count = aura.kind === 'mist' ? CLOUDS : aura.kind === 'lure' ? MARKS : 0;
    const drift = calm ? 0 : (now / DRIFT_TICKS) * TAU;
    for (let index = 0; index < MARKS; index += 1) {
      const mark = view.marks[index];
      if (mark === undefined) {
        continue;
      }
      mark.visible = index < count;
      if (!mark.visible) {
        continue;
      }
      const angle = (index / count) * TAU + (aura.kind === 'lure' ? drift : -drift);
      const distance = aura.kind === 'lure' ? radius * 0.82 : radius * 0.5;
      const size = aura.kind === 'lure' ? radius * 0.09 : radius * 0.3;
      mark.texture = shape.texture;
      setTint(mark, color);
      mark.position.set(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
      mark.rotation = aura.kind === 'lure' ? angle + Math.PI / 2 + Math.PI : 0;
      mark.scale.set(size / shape.radius);
      mark.alpha = aura.kind === 'lure' ? 0.9 : 0.5;
    }

    const shock = view.shock;
    shock.visible = aura.kind === 'shockwave';
    if (shock.visible) {
      const progress = (now - beats.last) / SHOCK_TICKS;
      setTint(shock, color);
      shock.position.set(x, y);
      if (calm) {
        shock.scale.set(radius / t.ring.radius);
        shock.alpha = 0.3;
      } else if (progress >= 0 && progress < 1) {
        const eased = 1 - (1 - progress) * (1 - progress);
        shock.scale.set((radius * (0.25 + 0.75 * eased)) / t.ring.radius);
        shock.alpha = (1 - progress) * (1 - progress) * 0.85;
      } else {
        shock.visible = false;
      }
    }
  }

  function drawFlash(view: SpeakerView, speaker: SpeakerState, color: number, frame: Frame): void {
    const progress =
      (frame.now - (flashes.get(speaker.id) ?? Number.NEGATIVE_INFINITY)) / FLASH_TICKS;
    const { flash } = view;
    flash.visible = progress >= 0 && progress < 1;
    if (!flash.visible) {
      return;
    }
    setTint(flash, color);
    flash.position.set(speaker.x, speaker.y);
    if (frame.calm) {
      flash.scale.set((speaker.radius * 2) / t.ring.radius);
      flash.alpha = 0.6 * Math.sin(progress * Math.PI);
    } else {
      const eased = 1 - (1 - progress) * (1 - progress);
      flash.scale.set((speaker.radius * (1 + 2 * eased)) / t.ring.radius);
      flash.alpha = (1 - progress) * (1 - progress);
    }
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      views.begin();
      const speakers = state.speakers ?? [];
      const looks = speakers.length > 0 ? lookup(ctx.speakerLooks, state.setId, 'set') : null;
      for (const [index, speaker] of speakers.entries()) {
        const look = lookup(looks ?? NO_LOOKS, speaker.id, 'speaker');
        const view = views.acquire(index);
        const { palette, light, pulse, calm } = frame;
        const color = palette[speakerToken(speaker.id)];
        const lit = speaker.plugged;
        const share = lit ? 1 : plugShare(speaker.plugTicks, look.plugBars);
        const plugging = !lit && speaker.plugTicks > 0;
        const off = mixColor(
          palette.badVibe,
          light.additive ? palette.texte : palette.sol,
          OFF_LIFT,
        );
        const tint = lit ? color : off;
        const shiver = plugging && !calm;
        const x = speaker.x + (shiver ? Math.sin(frame.now * 2.3) * 1.6 : 0);
        const y = speaker.y + (shiver ? Math.cos(frame.now * 3.1) * 1.1 : 0);

        drawCable(view, speaker, state);
        setTint(view.cable, tint);
        view.cable.alpha = lit ? 0.85 + 0.15 * pulse : 0.55;
        setTint(view.cableGlow, color);
        view.cableGlow.visible = lit;
        view.cableGlow.alpha = (0.18 + 0.2 * pulse) * light.haloAlpha;

        setTint(view.zone, tint);
        view.zone.visible = true;
        view.zone.position.set(speaker.x, speaker.y);
        view.zone.scale.set(speaker.radius / t.zone.radius);
        view.zone.alpha = lit ? 0.4 : 0.8;

        const { body } = view;
        setTint(body, tint);
        body.visible = true;
        body.position.set(x, y);
        body.scale.set(speaker.radius * STACK_SCALE * (lit ? 1 + 0.06 * pulse : 1));
        placeOutline(view.outline, body, t.stack.texture, t.stack.radius, frame);

        const ringRadius = speaker.radius + 9;
        view.track.visible = view.arc.visible = !lit && (plugging || share > 0);
        if (view.arc.visible) {
          if (view.arcShare !== share) {
            view.arcShare = share;
            view.track.clear();
            view.arc.clear();
            strokeCircle(view.track, ringRadius, 1, 2);
            strokeCircle(view.arc, ringRadius, share, 5);
          }
          view.track.position.set(speaker.x, speaker.y);
          view.arc.position.set(speaker.x, speaker.y);
          setTint(view.track, color);
          setTint(view.arc, color);
          view.track.alpha = 0.25;
          view.arc.alpha = 0.9;
        }

        if (lit) {
          drawAura(view, speaker, look, color, frame);
          drawFlash(view, speaker, color, frame);
        } else {
          hide(view.halo, view.shock, view.flash, ...view.beams, ...view.marks);
        }
      }
      views.end();
    },
    onEvent(event: SimEvent, state: SimState): void {
      if (event.type === 'beat') {
        beats.last = state.tick;
      } else if (event.type === 'speakerPlugged') {
        flashes.set(event.speakerId, state.tick);
      }
    },
    reset(): void {
      beats.last = Number.NEGATIVE_INFINITY;
      flashes.clear();
    },
    destroy(): void {
      layers.speakers.destroy({ children: true });
    },
  };
}
