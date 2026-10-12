import type { PaletteToken } from '../shared/palette';
import { TICKS_PER_BEAT } from '../shared/tempo';
import { Particles } from './effects';
import type { Frame } from './frame';
import type { Layers } from './layers';
import type { Textures } from './textures';

const TAU = Math.PI * 2;
const COLORS: readonly PaletteToken[] = ['mage', 'tank', 'healer', 'or', 'turquoise'];

export interface Burst {
  burst(x: number, y: number, id: number, boss: boolean, now: number, frame: Frame): void;
  update(now: number): void;
  clear(): void;
}

// The colors a chased bad vibe bursts into once its smile is over.
export function createBurst(layers: Layers, textures: Textures): Burst {
  const shards = new Particles(layers.fx, textures.shard, 600);
  const puffs = new Particles(layers.fx, textures.halo, 96);
  return {
    burst(x, y, id, boss, now, frame) {
      const count = boss ? 28 : 12;
      const reach = boss ? 140 : 42;
      const offset = (id * 0.618) % 1;
      for (let index = 0; index < count; index += 1) {
        const angle = ((index + offset) / count) * TAU;
        const distance = reach * (0.6 + 0.4 * ((index * 7) % 5) * 0.25);
        shards.spawn({
          now,
          duration: TICKS_PER_BEAT,
          x,
          y,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          fromRadius: boss ? 11 : 7,
          toRadius: boss ? 7 : 4,
          tint: frame.palette[COLORS[(index + id) % COLORS.length] ?? 'or'],
          peak: 1,
          spin: angle + Math.PI,
        });
      }
      puffs.spawn({
        now,
        duration: TICKS_PER_BEAT / 2,
        x,
        y,
        fromRadius: boss ? 60 : 16,
        toRadius: boss ? 160 : 40,
        tint: frame.palette[COLORS[id % COLORS.length] ?? 'or'],
        peak: 0.8,
      });
    },
    update(now) {
      shards.update(now);
      puffs.update(now);
    },
    clear() {
      shards.clear();
      puffs.clear();
    },
  };
}
