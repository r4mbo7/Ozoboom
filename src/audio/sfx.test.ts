import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../sim/state';
import { SFX_LIMITS, createSfxLimiter, sfxOf, type SfxName } from './sfx';

const trapEffects: Record<string, string> = {
  'caisson-de-basse': 'shockwave',
  laser: 'beam',
  brumisateur: 'mist',
};
const trapEffectOf = (kind: string) => trapEffects[kind] ?? kind;

const soundingEvents: readonly [SimEvent, SfxName][] = [
  [{ type: 'playerFired', playerId: 0, x: 0, y: 0, angle: 0 }, 'playerFired'],
  [{ type: 'enemyHit', id: 1, damage: 3, x: 0, y: 0 }, 'enemyHit'],
  [{ type: 'enemyDied', id: 1, kind: 'desagreable', x: 0, y: 0, byPlayer: 0 }, 'enemyDied'],
  [{ type: 'coreHit', damage: 2 }, 'coreHit'],
  [{ type: 'trapFired', id: 4, kind: 'caisson-de-basse', x: 0, y: 0 }, 'trapSub'],
  [{ type: 'trapFired', id: 5, kind: 'laser', x: 0, y: 0 }, 'trapBreath'],
  [{ type: 'levelUp', playerId: 0, level: 2 }, 'levelUp'],
  [{ type: 'upgradeChosen', playerId: 0, upgradeId: 'x' }, 'upgradeChosen'],
  [{ type: 'skillUsed', playerId: 0 }, 'skillUsed'],
  [{ type: 'ultimateUsed', playerId: 0 }, 'ultimateUsed'],
  [{ type: 'gameWon' }, 'gameWon'],
  [{ type: 'gameLost' }, 'gameLost'],
];

describe('sfxOf', () => {
  it.each(soundingEvents)('gives %j a sound', (event, name) => {
    expect(sfxOf(event, trapEffectOf)).toBe(name);
  });

  it('stays silent on rhythm and bookkeeping events', () => {
    const silent: SimEvent[] = [
      { type: 'beat', beat: 1 },
      { type: 'segment', segment: 'drop', tier: 0 },
      { type: 'enemySpawned', id: 1, kind: 'desagreable', x: 0, y: 0 },
      { type: 'trapFired', id: 6, kind: 'brumisateur', x: 0, y: 0 },
    ];

    expect(silent.map((event) => sfxOf(event, trapEffectOf))).toEqual([null, null, null, null]);
  });
});

describe('createSfxLimiter', () => {
  it('lets only a few of 50 deaths in the same frame through', () => {
    const limiter = createSfxLimiter(SFX_LIMITS);

    const played = Array.from({ length: 50 }, () => limiter.tryAcquire('enemyDied', 1)).filter(
      Boolean,
    ).length;

    expect(played).toBe(SFX_LIMITS.enemyDied.perFrame);
  });

  it('counts each sound type on its own', () => {
    const limiter = createSfxLimiter(SFX_LIMITS);
    limiter.tryAcquire('enemyHit', 1);
    limiter.tryAcquire('enemyHit', 1);

    expect(limiter.tryAcquire('enemyHit', 1)).toBe(false);
    expect(limiter.tryAcquire('coreHit', 1)).toBe(true);
  });

  it('opens again on the next frame', () => {
    const limiter = createSfxLimiter(SFX_LIMITS);
    limiter.tryAcquire('playerFired', 1);

    limiter.beginFrame();

    expect(limiter.tryAcquire('playerFired', 1.2)).toBe(true);
  });

  it('caps the voices still sounding across frames, then frees them as they end', () => {
    const limit = SFX_LIMITS.enemyDied;
    const limiter = createSfxLimiter(SFX_LIMITS);
    let played = 0;
    for (let frame = 0; frame < 10; frame += 1) {
      limiter.beginFrame();
      for (let death = 0; death < 50; death += 1) {
        played += limiter.tryAcquire('enemyDied', 1 + frame * 0.001) ? 1 : 0;
      }
    }

    expect(played).toBe(limit.concurrent);

    limiter.beginFrame();
    expect(limiter.tryAcquire('enemyDied', 1 + limit.seconds + 0.01)).toBe(true);
  });
});
