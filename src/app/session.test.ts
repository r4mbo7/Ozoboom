import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { IDLE_INPUT } from '../sim/commands';
import { createSession } from './session';

const idle = [{ playerId: 0, input: IDLE_INPUT, actions: [] }] as const;

function newSession() {
  return createSession({
    seed: 7,
    players: [{ id: 0, classId: 'mage' }],
    setId: 'soiree-v0',
    content: CONTENT,
  });
}

describe('createSession', () => {
  it('shows the events of every step of the frame, while the sim keeps those of its last step', () => {
    const session = newSession();
    session.endFrame();

    for (let step = 0; step < 12; step++) {
      session.step(idle);
    }

    expect(session.state.events).toEqual([{ type: 'beat', beat: 1 }]);
    expect(session.frame.events).toEqual([{ type: 'beat', beat: 1 }]);
    session.step(idle);
    expect(session.state.events).toEqual([]);
    expect(session.frame.events).toEqual([{ type: 'beat', beat: 1 }]);
  });

  it('gathers the events of several steps in one frame and forgets them at the end of the frame', () => {
    const session = newSession();
    session.endFrame();
    for (let step = 0; step < 11; step++) {
      session.step(idle);
    }
    session.endFrame();

    for (let step = 0; step < 13; step++) {
      session.step(idle);
    }

    expect(session.frame.events.filter((event) => event.type === 'beat')).toEqual([
      { type: 'beat', beat: 1 },
      { type: 'beat', beat: 2 },
    ]);
    session.endFrame();
    expect(session.frame.events).toEqual([]);
  });

  it('shows the events of tick 0 in the first frame', () => {
    const session = newSession();

    expect(session.frame.events).toEqual(session.state.events);
    expect(session.frame.events).toContainEqual({ type: 'beat', beat: 0 });
  });

  it('reads everything else live from the sim state', () => {
    const session = newSession();

    session.step(idle);

    expect(session.frame.tick).toBe(1);
    expect(session.frame.players).toBe(session.state.players);
    expect(session.frame).toBe(session.frame);
  });
});
