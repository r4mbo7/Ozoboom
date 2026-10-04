import type { Face } from './face-kit';
import {
  arnaqueur,
  collant,
  desagreable,
  intolerant,
  maleAlpha,
  meprisant,
  random,
} from './faces-1';
import { bavard, fatigue, filmeur, neutral, zombie } from './faces-2';
import { batterieAPlat, couvreFeu } from './faces-bosses';

export { FACE_RADIUS, NEUTRAL, type Face, type Pose } from './face-kit';
export { drowsyZ, smile } from './faces-2';

const MAIN = { boss: false, loopBeats: 1 };

export const NEUTRAL_FACE: Face = { ...MAIN, draw: neutral, frames: 1 };

// One face per id of src/data/enemies.ts: a test holds the two lists together.
export const FACES: Readonly<Record<string, Face>> = {
  random: { ...MAIN, draw: random, frames: 4, loopBeats: 4 },
  desagreable: { ...MAIN, draw: desagreable, frames: 1 },
  meprisant: { ...MAIN, draw: meprisant, frames: 1 },
  'male-alpha': { ...MAIN, draw: maleAlpha, frames: 1 },
  collant: { ...MAIN, draw: collant, frames: 4 },
  intolerant: { ...MAIN, draw: intolerant, frames: 4 },
  arnaqueur: { ...MAIN, draw: arnaqueur, frames: 1 },
  fatigue: { ...MAIN, draw: fatigue, frames: 4, loopBeats: 4, drowsy: true },
  filmeur: { ...MAIN, draw: filmeur, frames: 4 },
  bavard: { ...MAIN, draw: bavard, frames: 4 },
  zombie: {
    ...MAIN,
    draw: zombie,
    frames: 4,
    loopBeats: 2,
    tone: { token: 'healer', amount: 0.14 },
  },
  'couvre-feu': { ...MAIN, draw: couvreFeu, frames: 4, loopBeats: 4, boss: true },
  'batterie-a-plat': { ...MAIN, draw: batterieAPlat, frames: 4, loopBeats: 2, boss: true },
};

// Looks a mask up by sort. A sort the renderer does not know gets the fallback and a warning,
// once, never an error: the content may be ahead of the drawings.
export function picker<T>(
  items: ReadonlyMap<string, T>,
  fallback: T,
  warn: (message: string) => void,
): (kind: string) => T {
  const warned = new Set<string>();
  return (kind) => {
    const found = items.get(kind);
    if (found !== undefined) {
      return found;
    }
    if (!warned.has(kind)) {
      warned.add(kind);
      warn(`No mask for the bad vibe "${kind}", drawing a neutral one`);
    }
    return fallback;
  };
}
