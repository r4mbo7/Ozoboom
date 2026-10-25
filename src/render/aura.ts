import { Graphics, type Sprite } from 'pixi.js';
import { lerp, smoothstep } from '../shared/scalar';
import { ticksIntoBeat } from '../shared/tempo';
import type { AuraAttack } from '../data/kiffeur';
import { auraRadius } from '../sim/attacks/aura';
import type { PlayerState } from '../sim/state';
import type { Burster } from './class-bursts';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { TAU, WHITE } from './paint';
import { add, setTint } from './util';
import { ViewPool } from './views';

const DASH = { length: 16, on: 0.55, width: 2.2, min: 16 };
const AURA_ALPHA = { night: 0.55, day: 0.75, calmBeat: 0.25 };
const AURA_GLOW = 0.22;
const BEAT_WAVE = { width: 3, alpha: 0.75, fill: 1.9 };
const GROW_TICKS = 3;

interface AuraView {
  readonly glow: Sprite;
  readonly lines: Graphics;
  radius: number;
  notches: number;
  seen: number | undefined;
}

export interface Auras {
  readonly views: ViewPool<AuraView>;
  draw(player: PlayerState, attack: AuraAttack, alpha: number, frame: Frame): void;
}

// The Kiffeur's good mood: a dashed ring that grows with the Kiff and beats with the music.
export function createAuras(ctx: RenderContext, burster: Burster): Auras {
  const { layers, textures } = ctx;
  const views = new ViewPool<AuraView>(
    () => {
      const glow = add(layers.glow, textures.halo);
      const lines = new Graphics();
      layers.zones.addChild(lines);
      return { glow, lines, radius: 0, notches: 0, seen: undefined };
    },
    (view) => {
      view.glow.visible = view.lines.visible = false;
      view.seen = undefined;
    },
  );

  function draw(player: PlayerState, attack: AuraAttack, alpha: number, frame: Frame): void {
    const { now, calm, palette, light, tempo } = frame;
    const view = views.acquire(player.id);
    const x = lerp(player.prevX, player.x, alpha);
    const y = lerp(player.prevY, player.y, alpha);
    const color = palette[ctx.classTokens.get(player.classId) ?? 'or'];
    const target = auraRadius(player, attack);
    const notches = Math.floor(player.gauge ?? 0);
    if (view.seen === undefined) {
      view.radius = target;
    } else {
      const dt = Math.max(0, now - view.seen);
      view.radius += (target - view.radius) * (1 - Math.exp(-dt / GROW_TICKS));
      if (notches > view.notches) {
        burster.spawn(frame, {
          shape: textures.ring,
          now,
          duration: 6,
          x,
          y,
          fromRadius: view.radius,
          toRadius: target * 1.15,
          tint: color,
          peak: 0.8,
        });
      }
    }
    view.notches = notches;
    view.seen = now;
    const radius = view.radius;

    view.glow.visible = true;
    view.glow.position.set(x, y);
    view.glow.scale.set(radius / textures.halo.radius);
    view.glow.alpha = AURA_GLOW * light.haloAlpha;
    setTint(view.glow, color);

    const { lines } = view;
    const beat = ticksIntoBeat(now, tempo) / tempo.ticksPerBeat;
    lines.visible = true;
    lines.position.set(x, y);
    lines.blendMode = light.additive ? 'add' : 'normal';
    lines.tint = color;
    lines.alpha = 1;
    lines.clear();
    const strength = light.additive ? AURA_ALPHA.night : AURA_ALPHA.day;
    const dashes = Math.max(DASH.min, Math.round((TAU * radius) / DASH.length));
    const ringAlpha = calm
      ? strength * (1 - AURA_ALPHA.calmBeat + AURA_ALPHA.calmBeat * frame.pulse)
      : strength;
    for (let dash = 0; dash < dashes; dash += 1) {
      const from = (dash * TAU) / dashes;
      const to = from + (DASH.on * TAU) / dashes;
      lines.moveTo(Math.cos(from) * radius, Math.sin(from) * radius).arc(0, 0, radius, from, to);
    }
    lines.stroke({ width: DASH.width, color: WHITE, alpha: ringAlpha, cap: 'round' });
    if (!calm && player.dash === undefined) {
      const filled = Math.min(1, beat * BEAT_WAVE.fill);
      const eased = smoothstep(filled);
      lines
        .circle(0, 0, Math.max(1, radius * eased))
        .stroke({ width: BEAT_WAVE.width, color: WHITE, alpha: BEAT_WAVE.alpha * (1 - beat) });
    }
  }

  return { views, draw };
}
