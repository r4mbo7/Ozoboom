import type { Container, Sprite } from 'pixi.js';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { TAU } from './paint';
import { DOWNED_HEAD } from './textures-players-downed';
import { add, hide, setTint } from './util';

export const FIREFLIES = 8;
const CROWN = 17;
const HALO_REACH = 14;

export interface Fly {
  x: number;
  y: number;
  alpha: number;
}

export interface FlyMoment {
  readonly now: number;
  readonly ticksPerBeat: number;
  // Share of the relève done: the fireflies gather into the crown one after the other.
  readonly share: number;
  // 0 when the player stands back up, 1 once the fireflies are gone; null while lying down.
  readonly away: number | null;
  readonly calm: boolean;
}

const ease = (t: number) => 1 - (1 - t) ** 3;
const clamp = (v: number) => Math.min(1, Math.max(0, v));

// Where firefly `index` is, in reference pixels around the player, the body lying along +x.
export function fireflyAt(index: number, moment: FlyMoment, out: Fly): Fly {
  const { now, ticksPerBeat, share, away, calm } = moment;
  const beats = now / ticksPerBeat;
  const phase = (index / FIREFLIES) * TAU + (index % 2) * 1.9;
  const turn = (index % 2 === 0 ? -1 : 1) * (calm ? 0.04 : 0.2) * beats + phase;
  let x = Math.cos(turn) * (62 + (index % 3) * 8);
  let y = Math.sin(turn) * (46 + (index % 2) * 8);
  const gathered = away === null ? clamp(share * FIREFLIES - index) : 1;
  const crown = (index / FIREFLIES) * TAU + (calm ? 0 : beats * 0.15);
  const eased = ease(gathered);
  x += (DOWNED_HEAD.x + Math.cos(crown) * CROWN - x) * eased;
  y += (Math.sin(crown) * CROWN - y) * eased;
  let alpha = calm ? 0.85 : 0.4 + 0.6 * Math.max(0, Math.sin(beats * TAU + phase * 3));
  if (gathered >= 1) {
    alpha = 1;
  }
  if (away !== null) {
    const flight = ease(away);
    x += Math.cos(phase * 2) * 70 * flight;
    y -= Math.abs(Math.sin(phase * 2)) * 60 * flight;
    alpha = 1 - away;
  }
  out.x = x;
  out.y = y;
  out.alpha = alpha;
  return out;
}

// The fireflies of the lake that watch over a downed player, in its colour.
export class DownedFireflies {
  private readonly sprites: { readonly halo: Sprite; readonly core: Sprite }[] = [];
  private readonly haloRadius: number;
  private readonly fly: Fly = { x: 0, y: 0, alpha: 0 };

  constructor(ctx: RenderContext, marks: Container) {
    const { textures, layers } = ctx;
    this.haloRadius = textures.halo.radius;
    for (let index = 0; index < FIREFLIES; index += 1) {
      this.sprites.push({
        halo: add(layers.glow, textures.halo),
        core: add(marks, textures.players.downed.firefly),
      });
    }
  }

  hide(): void {
    for (const { halo, core } of this.sprites) {
      hide(halo, core);
    }
  }

  place(
    x: number,
    y: number,
    angle: number,
    scale: number,
    color: number,
    moment: FlyMoment,
    frame: Frame,
  ): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const [index, { halo, core }] of this.sprites.entries()) {
      const { x: fx, y: fy, alpha } = fireflyAt(index, moment, this.fly);
      const px = x + (fx * cos - fy * sin) * scale;
      const py = y + (fx * sin + fy * cos) * scale;
      halo.visible = core.visible = alpha > 0;
      halo.position.set(px, py);
      core.position.set(px, py);
      halo.scale.set((HALO_REACH * scale) / this.haloRadius);
      core.scale.set(scale);
      setTint(halo, color);
      setTint(core, color);
      halo.alpha = alpha * Math.min(1, frame.light.haloAlpha * 1.6);
      core.alpha = alpha;
    }
  }
}
