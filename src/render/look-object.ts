import type { Container } from 'pixi.js';
import { TICKS_PER_BAR } from '../shared/tempo';
import { TAU } from './paint';
import type { Look } from './player-look';
import type { Textures } from './textures';
import { REFERENCE } from './textures-looks';
import { add, hide, placeOutline, setTint } from './util';

// The parasol makes one turn per two bars.
export function parasolAngle(now: number): number {
  const period = 2 * TICKS_PER_BAR;
  return (((now % period) + period) % period) * (TAU / period);
}

// A look drawn as one object: the parasol turning on time.
export function createObjectLook(bodies: Container, textures: Textures, kind: 'parasol'): Look {
  const shape = textures.players.looks[kind].object;
  if (shape === undefined) {
    throw new Error(`The ${kind} look has no object texture`);
  }
  const outline = add(bodies, shape);
  const object = add(bodies, shape);
  return {
    reset() {
      // Nothing moves on its own.
    },
    hide() {
      hide(outline, object);
    },
    place({ x, y, scale, color, frame }) {
      object.visible = true;
      object.position.set(x, y);
      object.scale.set(scale);
      object.rotation = parasolAngle(frame.now);
      setTint(object, color);
      placeOutline(outline, object, shape.texture, REFERENCE, frame);
      return 0;
    },
  };
}
