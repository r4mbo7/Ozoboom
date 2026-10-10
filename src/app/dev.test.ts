import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { IDLE_INPUT } from '../sim/commands';
import { BENCH_ENEMIES, benchScene, benchSlots, readDevOptions } from './dev';
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

describe('the bench at four players', () => {
  it('reads the number of players from the URL, one by default and four at most', () => {
    expect(readDevOptions('?dev=bench', CONTENT).players).toBe(1);
    expect(readDevOptions('?dev=bench&players=4', CONTENT).players).toBe(4);
    expect(readDevOptions('?dev=bench&players=9', CONTENT).players).toBe(4);
    expect(readDevOptions('?dev=bench&players=x', CONTENT).players).toBe(1);
    expect(readDevOptions('?dev=fast&players=4', CONTENT).players).toBe(1);
  });

  it('seats one of each class then the first again, three weapons each', () => {
    const slots = benchSlots(CONTENT, 4);
    const session = createSession({
      seed: 7,
      players: slots,
      setId: 'soiree-v0',
      content: CONTENT,
    });
    benchScene(session.state, CONTENT, 7, BENCH_ENEMIES);

    expect(slots.map((slot) => slot.classId)).toEqual(['mage', 'tank', 'healer', 'mage']);
    expect(session.state.players.map((player) => player.weapons?.length)).toEqual([3, 3, 3, 3]);
    expect(new Set(session.state.players.map((player) => player.y)).size).toBe(4);
  });
});

describe('the stages of a dev mode', () => {
  const first = CONTENT.sets[0];
  const two = { ...CONTENT, sets: first === undefined ? [] : [first, { ...first, id: 'other' }] };

  it('plays on the first stage only, unless the URL keeps them all', () => {
    expect(readDevOptions('?dev=fast', two).content.sets).toHaveLength(1);
    expect(readDevOptions('?dev=bench', two).content.sets).toHaveLength(1);
    expect(readDevOptions('?dev=fast&stages', two).content.sets).toHaveLength(2);
    expect(readDevOptions('', two).content.sets).toHaveLength(2);
  });
});
