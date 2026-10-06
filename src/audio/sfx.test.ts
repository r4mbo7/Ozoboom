import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../sim/state';
import {
  SFX_LIMITS,
  createSfx,
  createSfxLimiter,
  sfxOf,
  type SfxLookups,
  type SfxName,
} from './sfx';

const trapEffects: Record<string, string> = {
  'caisson-de-basse': 'shockwave',
  laser: 'beam',
  brumisateur: 'mist',
};
const trapEffectOf = (kind: string) => trapEffects[kind] ?? kind;

const weaponKinds: Record<string, string> = {
  'baton-de-feu': 'sweep',
  'baton-du-diable': 'spark',
  cerceaux: 'hoop',
  diabolo: 'lob',
  frisbee: 'boomerang',
  assiettes: 'plate',
  totem: 'totem',
  eventails: 'orbit',
  monocycle: 'trail',
  ruban: 'ribbon',
};
const skills: Record<string, string> = {
  'classe-nova': 'nova',
  'classe-charge': 'dash',
  'classe-soin': 'healPulse',
  'classe-inconnue': 'teleport',
};
const lookups: SfxLookups = {
  weaponKindOf: (id) => weaponKinds[id],
  specialKindOf: (kind) => (kind === 'meprisant' ? 'sigh' : undefined),
  skillKindOf: (classId) => skills[classId],
};
const players = [
  { id: 0, classId: 'classe-nova' },
  { id: 1, classId: 'classe-charge' },
  { id: 2, classId: 'classe-soin' },
];
const resolve = (event: SimEvent) => sfxOf(event, trapEffectOf, lookups, players);

const weaponFired = (weaponId: string): SimEvent => ({
  type: 'weaponFired',
  playerId: 0,
  weaponId,
  x: 0,
  y: 0,
});

const weaponHit = (weaponId: string, id = 1): SimEvent => ({
  type: 'weaponHit',
  playerId: 0,
  weaponId,
  id,
  x: 0,
  y: 0,
});

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
  [{ type: 'skillUsed', playerId: 1 }, 'skillCharge'],
  [{ type: 'skillUsed', playerId: 2 }, 'skillHeal'],
  [{ type: 'taunted', playerId: 1, x: 0, y: 0, radius: 120, count: 4 }, 'taunted'],
  [{ type: 'playerHealed', playerId: 0, amount: 12 }, 'playerHealed'],
  [{ type: 'playerDowned', playerId: 0 }, 'playerDowned'],
  [{ type: 'playerRevived', playerId: 0 }, 'playerRevived'],
  [{ type: 'playerReviving', playerId: 0, byPlayer: 1, progress: 0.4 }, 'playerReviving'],
  [{ type: 'gameWon' }, 'gameWon'],
  [{ type: 'gameLost' }, 'gameLost'],
  [weaponFired('baton-de-feu'), 'weaponSweep'],
  [weaponFired('baton-du-diable'), 'weaponSpark'],
  [weaponFired('cerceaux'), 'weaponHoop'],
  [weaponFired('diabolo'), 'weaponDiabolo'],
  [weaponFired('frisbee'), 'weaponFrisbee'],
  [weaponFired('assiettes'), 'weaponPlate'],
  [weaponFired('totem'), 'weaponTotem'],
  [weaponHit('eventails'), 'weaponFans'],
  [weaponFired('ruban'), 'weaponRibbon'],
  [{ type: 'weaponGained', playerId: 0, weaponId: 'ruban' }, 'weaponGained'],
  [{ type: 'weaponEvolved', playerId: 0, weaponId: 'ruban', resultId: 'x' }, 'weaponEvolved'],
  [{ type: 'enemyYawned', id: 1, kind: 'fatigue', x: 0, y: 0 }, 'enemyYawn'],
  [{ type: 'enemyShot', id: 1, kind: 'meprisant', x: 0, y: 0 }, 'enemySigh'],
  [{ type: 'enemyBabbled', id: 1, kind: 'bavard', x: 0, y: 0 }, 'enemyBabble'],
  [{ type: 'enemyRevived', id: 1, kind: 'zombie', x: 0, y: 0 }, 'enemyGrowl'],
  [{ type: 'vibesStolen', id: 1, kind: 'arnaqueur', x: 0, y: 0 }, 'vibesStolen'],
  [{ type: 'playerShoved', id: 1, kind: 'desagreable', playerId: 0, x: 0, y: 0 }, 'playerShoved'],
  [{ type: 'bystanderHelped', id: 1, kind: 'festivalier', x: 0, y: 0 }, 'bystanderHelped'],
  [{ type: 'bystanderLost', id: 1, kind: 'festivalier', x: 0, y: 0 }, 'bystanderLost'],
  [{ type: 'volumeChanged', volume: 2 }, 'volumeUp'],
];

describe('sfxOf', () => {
  it.each(soundingEvents)('gives %j a sound', (event, name) => {
    expect(resolve(event)).toBe(name);
  });

  it('stays silent on a skill of an unknown kind, an unknown class or an unknown player', () => {
    const strangers = [
      { id: 0, classId: 'classe-inconnue' },
      { id: 1, classId: 'classe-sans-son' },
    ];
    const unknown: SimEvent[] = [
      { type: 'skillUsed', playerId: 0 },
      { type: 'skillUsed', playerId: 1 },
      { type: 'skillUsed', playerId: 3 },
    ];

    expect(unknown.map((event) => sfxOf(event, trapEffectOf, lookups, strangers))).toEqual(
      unknown.map(() => null),
    );
    expect(sfxOf({ type: 'skillUsed', playerId: 0 }, trapEffectOf, {}, players)).toBeNull();
    expect(sfxOf({ type: 'skillUsed', playerId: 0 }, trapEffectOf, lookups)).toBeNull();
  });

  it('stays silent on rhythm and bookkeeping events', () => {
    const silent: SimEvent[] = [
      { type: 'beat', beat: 1 },
      { type: 'segment', segment: 'drop', tier: 0 },
      { type: 'enemySpawned', id: 1, kind: 'desagreable', x: 0, y: 0 },
      { type: 'trapFired', id: 6, kind: 'brumisateur', x: 0, y: 0 },
      weaponFired('monocycle'),
      weaponFired('inconnu'),
      weaponFired('eventails'),
      weaponHit('monocycle'),
      weaponHit('baton-de-feu'),
      weaponHit('inconnu'),
      { type: 'enemyShot', id: 1, kind: 'filmeur', x: 0, y: 0 },
      { type: 'speakerPlugged', speakerId: 'sub' },
      { type: 'futureEvent' } as unknown as SimEvent,
    ];

    expect(silent.map(resolve)).toEqual(silent.map(() => null));
  });

  it('stays silent on weapons when no lookup is given', () => {
    expect(sfxOf(weaponFired('baton-de-feu'), trapEffectOf)).toBeNull();
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

interface FakeParam {
  value: number;
  setValueAtTime(value: number): void;
  linearRampToValueAtTime(value: number): void;
  exponentialRampToValueAtTime(value: number): void;
}

// Records the loudest envelope of every voice that reaches the output, which is all the synth
// needs: oscillators and noise are normalised to 1, so the envelope gain is the voice's peak.
function recordingOutput(): { out: AudioNode; peaks: number[] } {
  const peaks: number[] = [];
  const param = (onRamp?: (value: number) => void): FakeParam => ({
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: (value) => onRamp?.(value),
    exponentialRampToValueAtTime: () => undefined,
  });
  const node = (extra: object = {}) => ({ connect: () => undefined, ...extra });
  const out: { context?: object } = {};
  const context = {
    sampleRate: 48_000,
    createBuffer: () => ({ getChannelData: () => new Float32Array(4) }),
    createOscillator: () =>
      node({
        context,
        frequency: param(),
        detune: param(),
        start: () => undefined,
        stop: () => undefined,
      }),
    createBufferSource: () => node({ start: () => undefined, stop: () => undefined }),
    createBiquadFilter: () => node({ frequency: param(), Q: param() }),
    createStereoPanner: () => node({ pan: param() }),
    createGain: () => {
      let peak = 0;
      const gain = param((value) => {
        peak = Math.max(peak, value);
      });
      return {
        gain,
        connect(target: unknown) {
          if (target === out) {
            peaks.push(peak);
          }
        },
      };
    },
  };
  out.context = context;
  return { out: out as AudioNode, peaks };
}

const everyEvent: readonly SimEvent[] = [
  ...soundingEvents.map(([event]) => event),
  weaponFired('baton-du-diable'),
  weaponFired('cerceaux'),
  weaponFired('diabolo'),
  weaponFired('frisbee'),
  weaponFired('assiettes'),
  weaponFired('totem'),
  weaponHit('eventails'),
  weaponFired('ruban'),
];

describe('createSfx under a crowd', () => {
  const SFX_BUS_GAIN = 0.45;
  const LIMITER_THRESHOLD = 0.5;

  it('starts a bounded number of voices when 300 of every event land in one frame', () => {
    const { out, peaks } = recordingOutput();
    const sfx = createSfx(out, trapEffectOf, lookups);
    const storm = everyEvent.flatMap((event) => Array.from({ length: 300 }, () => event));
    const allowed = Object.values(SFX_LIMITS).reduce((sum, limit) => sum + limit.perFrame, 0);

    sfx.beginFrame();
    sfx.play(storm, 1, players);

    expect(peaks.length).toBeGreaterThan(0);
    expect(peaks.length).toBeLessThanOrEqual(allowed * 4);
  });

  it.each(everyEvent.map((event) => [event.type, event] as const))(
    'keeps a single %s under the limiter threshold',
    (_type, event) => {
      const { out, peaks } = recordingOutput();
      const sfx = createSfx(out, trapEffectOf, lookups);

      sfx.play([event], 1, players);
      const loudest = peaks.reduce((sum, peak) => sum + peak, 0) * SFX_BUS_GAIN;

      expect(loudest).toBeLessThan(LIMITER_THRESHOLD);
    },
  );

  it.each(Object.keys(SFX_LIMITS) as SfxName[])('lets only %s per its limit through', (name) => {
    const limiter = createSfxLimiter(SFX_LIMITS);
    const limit = SFX_LIMITS[name];
    let played = 0;
    for (let frame = 0; frame < 10; frame += 1) {
      limiter.beginFrame();
      for (let event = 0; event < 300; event += 1) {
        played += limiter.tryAcquire(name, 1 + frame * 0.001) ? 1 : 0;
      }
    }

    expect(played).toBe(Math.min(limit.concurrent, limit.perFrame * 10));
  });
});

describe('the fans', () => {
  const TICK_SECONDS = 60 / 145 / 12;

  it('stay silent on every tick of a game where they touch nothing', () => {
    const { out, peaks } = recordingOutput();
    const sfx = createSfx(out, trapEffectOf, lookups);

    for (let tick = 0; tick < 600; tick += 1) {
      sfx.beginFrame();
      sfx.play([weaponFired('eventails')], 1 + tick * TICK_SECONDS, players);
    }

    expect(peaks).toEqual([]);
  });

  it('sound once for a touch, whatever the bad vibe', () => {
    const { out, peaks } = recordingOutput();
    const sfx = createSfx(out, trapEffectOf, lookups);

    sfx.beginFrame();
    sfx.play([weaponHit('eventails', 3)], 1, players);

    expect(peaks.length).toBeGreaterThan(0);
  });

  it('sound once when 40 bad vibes are touched in the same tick', () => {
    const one = recordingOutput();
    createSfx(one.out, trapEffectOf, lookups).play([weaponHit('eventails')], 1, players);
    const crowd = recordingOutput();
    const sfx = createSfx(crowd.out, trapEffectOf, lookups);
    const touches = Array.from({ length: 40 }, (_, id) => weaponHit('eventails', id));

    sfx.beginFrame();
    sfx.play(touches, 1, players);

    expect(crowd.peaks.length).toBe(one.peaks.length);
  });

  it('keep a bounded rate over a second of touches on every tick', () => {
    const { out, peaks } = recordingOutput();
    const sfx = createSfx(out, trapEffectOf, lookups);
    const one = recordingOutput();
    createSfx(one.out, trapEffectOf, lookups).play([weaponHit('eventails')], 1, players);
    const voices = one.peaks.length;
    const ticks = Math.round(1 / TICK_SECONDS);

    for (let tick = 0; tick < ticks; tick += 1) {
      sfx.beginFrame();
      sfx.play([weaponHit('eventails', tick)], 1 + tick * TICK_SECONDS, players);
    }

    const { seconds, concurrent } = SFX_LIMITS.weaponFans;
    expect(peaks.length).toBeGreaterThan(voices);
    expect(peaks.length).toBeLessThanOrEqual(Math.ceil(1 / seconds) * concurrent * voices);
    expect(peaks.length / voices).toBeLessThanOrEqual(8);
  });
});

describe('the sounds of the team and of a revive', () => {
  const teamSounds: readonly SfxName[] = [
    'skillCharge',
    'skillHeal',
    'taunted',
    'playerHealed',
    'playerDowned',
    'playerRevived',
    'playerReviving',
  ];
  const teamEvents = soundingEvents.filter(([, name]) => teamSounds.includes(name));

  it.each(teamEvents)('sounds %j once and not twice in the same frame', (event) => {
    const { out, peaks } = recordingOutput();
    const sfx = createSfx(out, trapEffectOf, lookups);
    sfx.play([event], 1, players);
    const once = peaks.length;
    peaks.length = 0;

    sfx.play([event, event, event], 1.001, players);

    expect(once).toBeGreaterThan(0);
    expect(peaks).toEqual([]);
  });

  it('ticks a revive once per beat, however many ticks it lasts', () => {
    const { out, peaks } = recordingOutput();
    const sfx = createSfx(out, trapEffectOf, lookups);
    const reviving: SimEvent = { type: 'playerReviving', playerId: 0, byPlayer: 1, progress: 0.5 };
    const beat = 60 / 145;
    let ticks = 0;

    for (let tick = 0; tick < 24; tick += 1) {
      sfx.beginFrame();
      const before = peaks.length;
      sfx.play([reviving], 1 + (tick * beat) / 12, players);
      ticks += peaks.length > before ? 1 : 0;
    }

    expect(ticks).toBe(2);
  });

  it('lets an unexpected error from a lookup through', () => {
    const { out } = recordingOutput();
    const sfx = createSfx(out, trapEffectOf, {
      skillKindOf: () => {
        throw new Error('broken content');
      },
    });

    expect(() => {
      sfx.play([{ type: 'skillUsed', playerId: 0 }], 1, players);
    }).toThrow('broken content');
  });
});

describe('the lobby cues', () => {
  const cues = ['seatTaken', 'seatFreed', 'launch'] as const;

  it.each(cues)('sounds %s once, within its limit', (cue) => {
    const { out, peaks } = recordingOutput();
    const sfx = createSfx(out, trapEffectOf);
    sfx.cue(cue, 1);
    const once = peaks.length;
    peaks.length = 0;

    for (let call = 0; call < 50; call += 1) {
      sfx.cue(cue, 1.001);
    }

    expect(once).toBeGreaterThan(0);
    expect(peaks).toEqual([]);
  });

  it.each(cues)('keeps %s under the limiter threshold', (cue) => {
    const { out, peaks } = recordingOutput();
    const sfx = createSfx(out, trapEffectOf);

    sfx.cue(cue, 1);

    expect(peaks.reduce((sum, peak) => sum + peak, 0) * 0.45).toBeLessThan(0.5);
  });
});
