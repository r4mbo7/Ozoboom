import { describe, expect, it } from 'vitest';
import { IDLE_INPUT, type PlayerCommand } from '../sim/commands';
import { createLocalSource } from './local';
import { createMemoryTransports } from './memory';
import type { PlayerId } from '../sim/state';
import type { NetMessage, PeerId } from './types';

function command(playerId: PlayerId): PlayerCommand {
  return { playerId, input: IDLE_INPUT, actions: [] };
}

function record(transport: { onMessage: (l: (from: PeerId, m: NetMessage) => void) => unknown }) {
  const received: [PeerId, NetMessage][] = [];
  transport.onMessage((from, message) => received.push([from, message]));
  return received;
}

type Memory = ReturnType<typeof createMemoryTransports>[number];

function two(): [Memory, Memory] {
  const [a, b] = createMemoryTransports(2);
  if (a === undefined || b === undefined) throw new Error('missing transport');
  return [a, b];
}

function three(): [Memory, Memory, Memory] {
  const [a, b, c] = createMemoryTransports(3);
  if (a === undefined || b === undefined || c === undefined) throw new Error('missing transport');
  return [a, b, c];
}

describe('createLocalSource', () => {
  it('returns the local commands as received', () => {
    const source = createLocalSource();
    const local = [command(0), command(1)];

    expect(source.next(local)).toBe(local);
    expect(source.pending).toBe(0);
    expect(() => {
      source.stepped({} as never);
      source.close();
    }).not.toThrow();
  });
});

describe('createMemoryTransports', () => {
  it('gives each transport a distinct id', () => {
    const transports = createMemoryTransports(3);

    expect(new Set(transports.map((t) => t.id)).size).toBe(3);
  });

  it('delivers nothing before flush, then in send order', () => {
    const [a, b] = two();
    const received = record(b);

    a.send(b.id, { type: 'hash', tick: 1, hash: 'x' });
    a.send(b.id, { type: 'hash', tick: 2, hash: 'y' });
    expect(received).toEqual([]);
    a.flush();

    expect(received.map(([from, m]) => [from, m.type === 'hash' ? m.tick : 0])).toEqual([
      [a.id, 1],
      [a.id, 2],
    ]);
  });

  it('broadcasts to every other peer and not to the sender', () => {
    const [a, b, c] = three();
    const atA = record(a);
    const atB = record(b);
    const atC = record(c);

    a.broadcast({ type: 'bye' });
    a.flush();

    expect([atA.length, atB.length, atC.length]).toEqual([0, 1, 1]);
  });

  it('copies messages so later mutation does not leak', () => {
    const [a, b] = two();
    const received = record(b);
    const message: NetMessage = { type: 'frame', tick: 0, commands: [command(0)] };

    a.send(b.id, message);
    message.tick = 9;
    a.flush();

    expect(received[0]?.[1]).toMatchObject({ tick: 0 });
  });

  it('delays a held peer without reordering, then catches up on release', () => {
    const [a, b, c] = three();
    const atB = record(b);
    const atC = record(c);
    c.hold();

    a.broadcast({ type: 'hash', tick: 1, hash: 'x' });
    a.broadcast({ type: 'hash', tick: 2, hash: 'y' });
    a.flush();
    expect([atB.length, atC.length]).toEqual([2, 0]);
    c.release();
    a.flush();

    expect(atC.map(([, m]) => (m.type === 'hash' ? m.tick : 0))).toEqual([1, 2]);
  });

  it('signals left to the others when a transport closes, and stops delivering to it', () => {
    const [a, b] = two();
    const changes: [PeerId, string][] = [];
    const atB = record(b);
    a.onPeer((peer, change) => changes.push([peer, change]));

    b.close();
    a.send(b.id, { type: 'bye' });
    a.flush();

    expect(changes).toEqual([[b.id, 'left']]);
    expect(atB).toEqual([]);
  });

  it('stops notifying a listener once unsubscribed', () => {
    const [a, b] = two();
    const received: NetMessage[] = [];
    const off = b.onMessage((_from, message) => received.push(message));

    off();
    a.send(b.id, { type: 'bye' });
    a.flush();

    expect(received).toEqual([]);
  });
});
