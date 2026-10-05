import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { IDLE_INPUT } from '../sim/commands';
import { BENCH_ENEMIES, benchScene } from './dev';
import { createSession } from './session';

function benchSession() {
  const session = createSession({
    seed: 7,
    players: [{ id: 0, classId: 'mage' }],
    setId: 'soiree-v0',
    content: CONTENT,
  });
  benchScene(session.state, CONTENT, 7, BENCH_ENEMIES);
  return session;
}

describe('benchScene', () => {
  it('puts the crowd on the lake shore with three weapons and a plugged speaker', () => {
    const { state } = benchSession();

    expect(state.enemies).toHaveLength(BENCH_ENEMIES);
    expect(Math.max(...state.enemies.map((enemy) => enemy.x))).toBeLessThan(state.arena.width / 2);
    expect(state.players[0]?.weapons).toHaveLength(3);
    expect(state.speakers?.filter((speaker) => speaker.plugged)).toHaveLength(1);
    expect(state.volume).toBe(1);
  });

  it('keeps every bad vibe and the scene alive through a bar of play', () => {
    const session = benchSession();

    for (let tick = 0; tick < 96; tick++) {
      session.step([{ playerId: 0, input: IDLE_INPUT, actions: [] }]);
    }

    expect(session.state.status).toBe('running');
    expect(session.state.enemies.length).toBeGreaterThanOrEqual(BENCH_ENEMIES);
  });
});
