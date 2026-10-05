import { describe, expect, it } from 'vitest';
import { createMemoryTransports, type MemoryTransport } from './memory';
import { createRoom, type RefusalReason, type Room, type StartMessage } from './room';
import type { Seat } from './types';

const V1 = 'v1';
const CLASS_IDS = ['mage', 'ranger', 'tank', 'a', 'b', 'c'];

function network(count: number): MemoryTransport[] {
  return createMemoryTransports(count);
}

function join(
  transport: MemoryTransport,
  profile: { version?: string; name: string; classId: string },
) {
  const room = createRoom(transport, 'guest', { version: V1, classIds: CLASS_IDS, ...profile });
  const refusals: [RefusalReason, string][] = [];
  const starts: StartMessage[] = [];
  const changes: (readonly Seat[])[] = [];
  room.onRefused((reason, version) => refusals.push([reason, version]));
  room.onStart((start) => starts.push(start));
  room.onChange((seats) => changes.push(seats));
  return { room, refusals, starts, changes };
}

function host(transport: MemoryTransport): Room {
  return createRoom(transport, 'host', {
    version: V1,
    classIds: CLASS_IDS,
    name: 'Hôte',
    classId: 'mage',
  });
}

describe('createRoom as host', () => {
  it('seats the host at place 0', () => {
    const [h] = network(1) as [MemoryTransport];

    const room = host(h);

    expect(room.seats).toEqual([{ playerId: 0, peer: 'peer-0', name: 'Hôte', classId: 'mage' }]);
    expect(room.localSeat?.playerId).toBe(0);
  });

  it('seats guests and shares names and classes with everyone', () => {
    const [h, g1, g2] = network(3) as [MemoryTransport, MemoryTransport, MemoryTransport];
    const room = host(h);
    const first = join(g1, { name: 'Ana', classId: 'ranger' });
    const second = join(g2, { name: 'Bob', classId: 'tank' });

    h.flush();

    const expected = [
      { playerId: 0, peer: 'peer-0', name: 'Hôte', classId: 'mage' },
      { playerId: 1, peer: 'peer-1', name: 'Ana', classId: 'ranger' },
      { playerId: 2, peer: 'peer-2', name: 'Bob', classId: 'tank' },
    ];
    expect(room.seats).toEqual(expected);
    expect(first.room.seats).toEqual(expected);
    expect(second.room.seats).toEqual(expected);
    expect(first.room.localSeat?.playerId).toBe(1);
    expect(second.room.localSeat?.playerId).toBe(2);
    expect(first.changes.length).toBeGreaterThan(0);
  });

  it('refuses a different version with the host version and disconnects the peer', () => {
    const [h, g] = network(2) as [MemoryTransport, MemoryTransport];
    const room = host(h);
    const guest = join(g, { version: 'v0', name: 'Ana', classId: 'ranger' });
    const left: string[] = [];
    g.onPeer((peer, change) => left.push(`${peer}:${change}`));

    h.flush();

    expect(guest.refusals).toEqual([['version', V1]]);
    expect(room.seats).toHaveLength(1);
    expect(left).toEqual(['peer-0:left']);
  });

  it('refuses a fifth player', () => {
    const transports = network(5) as [MemoryTransport, ...MemoryTransport[]];
    const room = host(transports[0]);
    const guests = transports
      .slice(1)
      .map((t, i) => join(t, { name: `G${String(i)}`, classId: 'a' }));

    transports[0].flush();

    expect(room.seats).toHaveLength(4);
    expect(guests.slice(0, 3).every((g) => g.refusals.length === 0)).toBe(true);
    expect(guests[3]?.refusals).toEqual([['full', V1]]);
  });

  it('refuses a player who arrives after the start', () => {
    const [h, g1, g2] = network(3) as [MemoryTransport, MemoryTransport, MemoryTransport];
    const room = host(h);
    join(g1, { name: 'Ana', classId: 'ranger' });
    h.flush();
    room.start('set-1', 42);
    const late = join(g2, { name: 'Bob', classId: 'tank' });

    h.flush();

    expect(late.refusals).toEqual([['started', V1]]);
    expect(room.seats).toHaveLength(2);
  });

  it('frees the seat of a guest who leaves and gives it to the next one', () => {
    const [h, g1, g2, g3] = network(4) as [
      MemoryTransport,
      MemoryTransport,
      MemoryTransport,
      MemoryTransport,
    ];
    const room = host(h);
    join(g1, { name: 'Ana', classId: 'a' });
    const second = join(g2, { name: 'Bob', classId: 'b' });
    h.flush();

    g1.close();
    h.flush();

    expect(room.seats.map((seat) => seat.name)).toEqual(['Hôte', 'Bob']);
    expect(second.room.seats).toHaveLength(2);

    join(g3, { name: 'Cléo', classId: 'c' });
    h.flush();
    expect(room.seats.map((seat) => [seat.playerId, seat.name])).toEqual([
      [0, 'Hôte'],
      [1, 'Cléo'],
      [2, 'Bob'],
    ]);
  });

  it('applies a guest seat change and the host own change', () => {
    const [h, g] = network(2) as [MemoryTransport, MemoryTransport];
    const room = host(h);
    const guest = join(g, { name: 'Ana', classId: 'a' });
    h.flush();

    guest.room.setSeat({ classId: 'b' });
    room.setSeat({ name: 'Chef' });
    h.flush();

    const expected = [
      { playerId: 0, peer: 'peer-0', name: 'Chef', classId: 'mage' },
      { playerId: 1, peer: 'peer-1', name: 'Ana', classId: 'b' },
    ];
    expect(room.seats).toEqual(expected);
    expect(guest.room.seats).toEqual(expected);
  });

  it('clips long names', () => {
    const [h, g] = network(2) as [MemoryTransport, MemoryTransport];
    const room = host(h);
    join(g, { name: `  ${'x'.repeat(100)}`, classId: 'a' });

    h.flush();

    expect(room.seats[1]?.name).toHaveLength(12);
  });

  it('names a blank player after the seat', () => {
    const [h, g] = network(2) as [MemoryTransport, MemoryTransport];
    const room = host(h);
    join(g, { name: '   ', classId: 'a' });

    h.flush();

    expect(room.seats[1]?.name).toBe('Joueur 2');
  });

  it('gives an unknown class the first known one, at entry and on change', () => {
    const [h, g1, g2] = network(3) as [MemoryTransport, MemoryTransport, MemoryTransport];
    const room = host(h);
    join(g1, { name: 'Ana', classId: 'inconnue' });
    const second = join(g2, { name: 'Bob', classId: 'tank' });
    h.flush();

    second.room.setSeat({ classId: 'nope' });
    h.flush();

    expect(room.seats.map((seat) => seat.classId)).toEqual(['mage', 'mage', 'mage']);
  });

  it('starts with the seated players and tells the guests', () => {
    const [h, g] = network(2) as [MemoryTransport, MemoryTransport];
    const room = host(h);
    const guest = join(g, { name: 'Ana', classId: 'ranger' });
    h.flush();
    const hostStarts: StartMessage[] = [];
    room.onStart((start) => hostStarts.push(start));

    room.start('set-1', 7);
    h.flush();

    const expected: StartMessage = {
      type: 'start',
      seed: 7,
      setId: 'set-1',
      players: [
        { id: 0, classId: 'mage', name: 'Hôte' },
        { id: 1, classId: 'ranger', name: 'Ana' },
      ],
    };
    expect(hostStarts).toEqual([expected]);
    expect(guest.starts).toEqual([expected]);
  });

  it('keeps the seats once started when a guest leaves', () => {
    const [h, g] = network(2) as [MemoryTransport, MemoryTransport];
    const room = host(h);
    join(g, { name: 'Ana', classId: 'a' });
    h.flush();
    room.start('set-1', 7);

    g.close();
    h.flush();

    expect(room.seats).toHaveLength(2);
  });

  it('cannot be started by a guest or twice', () => {
    const [h, g] = network(2) as [MemoryTransport, MemoryTransport];
    const room = host(h);
    const guest = join(g, { name: 'Ana', classId: 'a' });

    expect(() => guest.room.start('set-1', 1)).toThrow();
    room.start('set-1', 1);
    expect(() => room.start('set-1', 1)).toThrow();
  });
});
