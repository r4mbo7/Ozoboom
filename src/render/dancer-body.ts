import type { Graphics } from 'pixi.js';
import type { DancerLook } from '../data/types';
import { smoothstep } from '../shared/scalar';
import { ticksIntoBar } from '../shared/tempo';
import type { Vec2 } from '../sim/state';
import { DANCER, frameAt } from './dance-kit';
import { DANCES, lookOf, paintDance } from './dancer-looks';
import { SHADOW } from './fallen-mask';
import type { Frame } from './frame';
import type { Layers } from './layers';
import type { Shape } from './paint';
import { add, hide, setTint } from './util';

const JUMP = {
  grow: 0.12,
  shadow: 13,
  shadowFlat: 0.73,
  shadowOffset: 4,
  shadowSlide: 14,
  shadowDrop: 8,
  shadowShrink: 0.32,
  shadowAlpha: 0.5,
  shadowFade: 0.3,
};
const DUST = {
  puffs: 6,
  turn: 0.5,
  from: 11,
  travel: 8,
  wide: 1.3,
  flat: 0.75,
  size: 1.8,
  end: 0.7,
  alpha: 0.4,
  color: 0xd9c9a8,
};
const GLOW = { alpha: 0.14, reach: 2.3 };
const WHITE = 0xffffff;

type Dancing = Vec2 & { readonly radius: number };

export interface DancerBody {
  // `shown` from 1 down to 0 as he fades under his mask.
  place(at: Dancing, core: Vec2, frame: Frame, shown?: number): void;
  hide(): void;
  destroy(): void;
}

// The dancer himself, the stage's look: his height, if he jumps, reads in his shadow alone, smaller
// and further from the core's light.
export function createDancerBody(layers: Layers, halo: Shape, ground: Graphics): DancerBody {
  const glow = add(layers.glow, halo);
  const body = add(layers.bystanders, halo);
  // Each stage's dancer is painted the first time he unmasks there.
  const dances = new Map<DancerLook, Shape[]>();

  // A small puff of dust round his shadow as he lands.
  function dust(x: number, y: number, unit: number, landing: number): void {
    const spread = unit * (DUST.from + DUST.travel * smoothstep(landing));
    for (let puff = 0; puff < DUST.puffs; puff += 1) {
      const angle = (puff * Math.PI * 2) / DUST.puffs + DUST.turn;
      ground
        .circle(
          x + Math.cos(angle) * spread * DUST.wide,
          y + Math.sin(angle) * spread * DUST.flat,
          unit * (DUST.size * (1 - landing) + DUST.end),
        )
        .fill({ color: DUST.color, alpha: DUST.alpha * (1 - landing) });
    }
  }

  return {
    place(at, core, frame, shown = 1): void {
      const { calm, tempo, palette } = frame;
      const look = lookOf(frame.set);
      const dance = DANCES[look];
      const frames = dances.get(look) ?? paintDance(dance);
      dances.set(look, frames);
      const beat = calm ? dance.still : ticksIntoBar(frame.now, tempo) / tempo.ticksPerBeat;
      const jump = dance.jumpAt(beat);
      const height = calm ? 0 : jump.height;
      const squash = calm ? 0 : jump.squash;
      const unit = at.radius / DANCER.size;
      body.visible = true;
      body.texture = frames[frameAt(dance, beat)]?.texture ?? body.texture;
      body.position.set(at.x, at.y);
      body.rotation = 0;
      const grow = unit * (1 + JUMP.grow * height);
      body.scale.set(grow * (1 + squash), grow * (1 - squash));
      body.alpha = shown;
      setTint(body, WHITE);
      const away = Math.atan2(at.y - core.y, at.x - core.x);
      const off = unit * (JUMP.shadowOffset + JUMP.shadowSlide * height);
      const x = at.x + Math.cos(away) * off;
      const y = at.y + Math.sin(away) * off + unit * JUMP.shadowDrop;
      const shrink = unit * (1 - JUMP.shadowShrink * height);
      ground.ellipse(x, y, JUMP.shadow * shrink, JUMP.shadow * JUMP.shadowFlat * shrink).fill({
        color: SHADOW.color,
        alpha: JUMP.shadowAlpha * (1 - JUMP.shadowFade * height) * shown,
      });
      if (!calm && jump.landing !== null) {
        dust(x, y, unit, jump.landing);
      }
      glow.visible = true;
      glow.position.set(at.x, at.y);
      glow.scale.set((at.radius * GLOW.reach) / halo.radius);
      glow.alpha = GLOW.alpha * shown;
      setTint(glow, palette.or);
    },
    hide(): void {
      hide(body, glow);
    },
    destroy(): void {
      for (const shape of [...dances.values()].flat()) {
        shape.texture.destroy(true);
      }
    },
  };
}
