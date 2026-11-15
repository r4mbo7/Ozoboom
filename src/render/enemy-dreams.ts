import type { Container, Sprite } from 'pixi.js';
import type { Frame } from './frame';
import type { Shape } from './paint';
import { add, setTint } from './util';

const TAU = Math.PI * 2;
const ZS = 3;

interface Dreamer {
  zs: Sprite[] | null;
  readonly radius: number;
}

// The Zs that rise over a sleeping bad vibe, one round a bar.
export function createDreams(sleepers: Container, drowsy: Shape) {
  return (dreamer: Dreamer, x: number, y: number, strength: number, frame: Frame): void => {
    const zs = (dreamer.zs ??= Array.from({ length: ZS }, () => add(sleepers, drowsy)));
    const size = (dreamer.radius * 0.2) / drowsy.radius;
    zs.forEach((z, index) => {
      const progress = (frame.now / frame.tempo.ticksPerBar + index / ZS) % 1;
      z.visible = true;
      setTint(z, frame.palette.texte);
      z.position.set(
        x + dreamer.radius * (0.55 + 0.4 * progress),
        y - dreamer.radius * (0.8 + 2.2 * progress),
      );
      z.scale.set(size * (0.6 + 0.6 * progress));
      z.alpha = strength * Math.sin(progress * Math.PI);
      z.rotation = 0.25 * Math.sin(progress * TAU);
    });
  };
}
