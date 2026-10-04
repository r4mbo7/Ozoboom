import { describe, expect, it, vi } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { FACES, NEUTRAL_FACE, drowsyZ, picker, smile, type Pose } from './faces';
import type { Ctx } from './paint';

function recordingContext(): { ctx: Ctx; calls: string[] } {
  const calls: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(
    {},
    {
      get: (_target, name: string) =>
        name.startsWith('create') ? () => gradient : () => void calls.push(name),
      set: () => true,
    },
  ) as Ctx;
  return { ctx, calls };
}

const POSES: readonly Pose[] = [
  { t: 0, asleep: false, down: false },
  { t: 0.99, asleep: false, down: false },
  { t: 0, asleep: true, down: false },
  { t: 0, asleep: false, down: true },
];

describe('bad vibe faces', () => {
  it('draws a face for every bad vibe of the content, and only for them', () => {
    const ids = ENEMIES.map((enemy) => enemy.id).sort();

    expect(Object.keys(FACES).sort()).toEqual(ids);
  });

  it('draws the big masks for the bosses and only for them', () => {
    for (const enemy of ENEMIES) {
      expect(FACES[enemy.id]?.boss, enemy.id).toBe(enemy.behaviour === 'boss');
    }
  });

  it('paints every pose of every face, the neutral one, the smile and the z', () => {
    const drawings = [
      ...[...Object.values(FACES), NEUTRAL_FACE].flatMap((face) =>
        POSES.map((pose) => (ctx: Ctx) => {
          face.draw(ctx, pose);
        }),
      ),
      smile,
      drowsyZ,
    ];

    for (const draw of drawings) {
      const { ctx, calls } = recordingContext();
      draw(ctx);
      expect(calls).toContain('stroke');
    }
  });

  it('animates the faces that have frames to animate', () => {
    for (const [id, face] of Object.entries(FACES)) {
      expect(face.frames, id).toBeGreaterThanOrEqual(1);
      expect(face.loopBeats, id).toBeGreaterThan(0);
    }
    expect(FACES.zombie?.frames).toBeGreaterThan(1);
    expect(FACES.fatigue?.drowsy).toBe(true);
  });
});

describe('picker', () => {
  it('returns the known item without a warning', () => {
    const warn = vi.fn();

    const found = picker(new Map([['random', 1]]), 0, warn)('random');

    expect(found).toBe(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back on an unknown sort and warns once instead of throwing', () => {
    const warn = vi.fn();
    const pick = picker(new Map([['random', 1]]), 0, warn);

    const results = [pick('inconnu'), pick('inconnu'), pick('autre')];

    expect(results).toEqual([0, 0, 0]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]?.[0]).toContain('inconnu');
  });
});
