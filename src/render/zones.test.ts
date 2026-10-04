import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { VIEW_HEIGHT } from './camera';
import { MIN_TICKS_BETWEEN_FLASHES } from './motion';
import { ZONE_ALPHA, type ZoneKind, zoneAlpha } from './zones';

const KINDS = Object.keys(ZONE_ALPHA) as ZoneKind[];

describe('zoneAlpha', () => {
  it('is softer in calm mode for every zone', () => {
    for (const kind of KINDS) {
      expect(zoneAlpha(kind, true)).toBeLessThan(zoneAlpha(kind, false));
    }
  });

  it('never goes opaque, so a zone veils without hiding what it covers', () => {
    for (const kind of KINDS) {
      expect(zoneAlpha(kind, false)).toBeLessThanOrEqual(0.4);
    }
  });

  it('keeps the dazzle of the Filmeur local, far from a full screen flash', () => {
    const dazzle = ENEMIES.find((enemy) => enemy.special?.kind === 'dazzle')?.special;

    expect(dazzle?.kind === 'dazzle' ? dazzle.radius * 2 : Infinity).toBeLessThan(VIEW_HEIGHT / 3);
    expect(MIN_TICKS_BETWEEN_FLASHES).toBeGreaterThan(1);
  });
});
