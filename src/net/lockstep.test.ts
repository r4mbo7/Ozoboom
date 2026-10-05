import { describe, expect, it, vi } from 'vitest';
import { nextFloat, seedRng } from '../shared/prng';
import { TICKS_PER_BAR } from '../shared/tempo';
import { IDLE_INPUT, type PlayerAction, type PlayerCommand } from '../sim/commands';
import { commandFor, FIXTURE_OPTIONS } from '../sim/fixtures';
import { createSimulation, type Simulation } from '../sim';
import { hashState } from '../sim/replay';
import type { PlayerId, SimState } from '../sim/state';
import {
  createGuestSource,
  createHostSource,
  GUEST_BUFFER_TICKS,
  GUEST_QUEUE_CAPACITY,
  type LockstepSource,
} from './lockstep';
import { createMemoryTransports, type MemoryTransport } from './memory';
import type { Seat } from './types';

const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];

function playerOf(index: number): PlayerId {
  const id = PLAYER_IDS[index];
  if (id === undefined) throw new Error('no such player');
  return id;
}

function seatsFor(transports: readonly MemoryTransport[]): Seat[] {
  return transports.map((transport, index) => ({
    playerId: playerOf(index),
    peer: index === 0 ? null : transport.id,
    name: `P${String(index)}`,
    classId: 'raver',
  }));
}

function network(count: number): { host: MemoryTransport; guests: MemoryTransport[] } {
  const [host, ...guests] = createMemoryTransports(count);
  if (host === undefined) throw new Error('missing transport');
  return { host, guests };
}

function fakeState(tick: number): SimState {
  return { tick } as SimState;
}

function placeTrap(x: number): PlayerAction {
  return { type: 'placeTrap', trapId: 'subwoofer', x, y: 0, dx: 1, dy: 0 };
}

describe('host and guests in lockstep', () => {
  it('reach the same fingerprint on delayed and uneven deliveries', () => {
    const ticks = 10 * TICKS_PER_BAR;
    const { host, guests } = network(4);
    const transports = [host, ...guests];
    const desyncs = vi.fn();
    const players = transports.map((_, id) => ({ id: playerOf(id), classId: 'raver' }));
    const options = { ...FIXTURE_OPTIONS, players };
    const sims: Simulation[] = transports.map(() => createSimulation(options));
    const sources: LockstepSource[] = [
      createHostSource(host, seatsFor(transports), [0], {
        onDesync: desyncs,
        onPeerLeft: vi.fn(),
      }),
      ...guests.map((guest, index) =>
        createGuestSource(guest, [playerOf(index + 1)], { onDesync: desyncs, onHostLeft: vi.fn() }),
      ),
    ];
    const rng = seedRng(99);
    const randomCommand = (playerId: PlayerId): PlayerCommand => ({
      ...commandFor(playerId, {
        move: { x: nextFloat(rng) - 0.5, y: nextFloat(rng) - 0.5 },
        fire: nextFloat(rng) < 0.5,
        skill: nextFloat(rng) < 0.1,
      }),
      actions: nextFloat(rng) < 0.1 ? [placeTrap(nextFloat(rng) * 100)] : [],
    });

    for (let round = 0; round < ticks * 10; round++) {
      guests.forEach((guest) => {
        if (nextFloat(rng) < 0.5) guest.hold();
        else guest.release();
      });
      host.flush();
      transports.forEach((_, index) => {
        const sim = sims[index];
        const source = sources[index];
        if (sim === undefined || source === undefined || sim.state.tick >= ticks) return;
        if (index === 0 && nextFloat(rng) < 0.3) return;
        const frame = source.next([randomCommand(playerOf(index))]);
        if (frame !== null) {
          sim.step(frame);
          source.stepped(sim.state);
        }
      });
      if (sims.every((sim) => sim.state.tick >= ticks)) break;
    }
    guests.forEach((guest) => {
      guest.release();
    });
    host.flush();

    expect(sims.map((sim) => sim.state.tick)).toEqual([ticks, ticks, ticks, ticks]);
    expect(desyncs).not.toHaveBeenCalled();
    expect(new Set(sims.map((sim) => hashState(sim.state))).size).toBe(1);
  });
});

describe('createHostSource', () => {
  function hostWithGuest(): {
    host: MemoryTransport;
    guest: MemoryTransport;
    source: LockstepSource;
    onPeerLeft: ReturnType<typeof vi.fn>;
    onDesync: ReturnType<typeof vi.fn>;
  } {
    const { host, guests } = network(2);
    const guest = guests[0];
    if (guest === undefined) throw new Error('missing guest');
    const onPeerLeft = vi.fn();
    const onDesync = vi.fn();
    const source = createHostSource(host, seatsFor([host, guest]), [0], { onDesync, onPeerLeft });
    return { host, guest, source, onPeerLeft, onDesync };
  }

  it('builds the frame of a tick from its own command and the guest command of that tick', () => {
    const { host, guest, source } = hostWithGuest();
    const move = { ...IDLE_INPUT, move: { x: 1, y: 0 } };

    guest.send(host.id, { type: 'command', tick: 0, command: commandFor(1, move) });
    host.flush();
    const frame = source.next([commandFor(0)]);

    expect(frame).toEqual([commandFor(0), { playerId: 1, input: move, actions: [] }]);
    expect(source.pending).toBe(0);
  });

  it('delivers an action sent late with the next frame, never lost', () => {
    const { host, guest, source } = hostWithGuest();
    for (let i = 0; i < 5; i++) source.next([]);

    guest.send(host.id, {
      type: 'command',
      tick: 1,
      command: { playerId: 1, input: IDLE_INPUT, actions: [placeTrap(7)] },
    });
    host.flush();
    const frame = source.next([]);

    expect(frame?.[0]?.actions).toEqual([placeTrap(7)]);
  });

  it('keeps the last input and every action when two commands share a tick', () => {
    const { host, guest, source } = hostWithGuest();
    const first = { ...IDLE_INPUT, fire: true };
    const second = { ...IDLE_INPUT, skill: true };

    guest.send(host.id, {
      type: 'command',
      tick: 0,
      command: { playerId: 1, input: first, actions: [placeTrap(1)] },
    });
    guest.send(host.id, {
      type: 'command',
      tick: 0,
      command: { playerId: 1, input: second, actions: [placeTrap(2)] },
    });
    host.flush();

    expect(source.next([])).toEqual([
      { playerId: 1, input: second, actions: [placeTrap(1), placeTrap(2)] },
    ]);
  });

  it('repeats the previous input of a silent guest, without actions', () => {
    const { host, guest, source } = hostWithGuest();
    const input = { ...IDLE_INPUT, move: { x: 0, y: 1 } };
    guest.send(host.id, {
      type: 'command',
      tick: 0,
      command: { playerId: 1, input, actions: [placeTrap(1)] },
    });
    host.flush();
    source.next([]);

    const frame = source.next([]);

    expect(frame).toEqual([{ playerId: 1, input, actions: [] }]);
  });

  it('plays a guest who left as idle and says so once', () => {
    const { host, guest, source, onPeerLeft } = hostWithGuest();
    guest.send(host.id, { type: 'command', tick: 0, command: commandFor(1, { fire: true }) });
    host.flush();
    source.next([]);

    guest.close();
    host.flush();

    expect(source.next([])).toEqual([{ playerId: 1, input: IDLE_INPUT, actions: [] }]);
    expect(source.next([])).toEqual([{ playerId: 1, input: IDLE_INPUT, actions: [] }]);
    expect(onPeerLeft).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('ignores commands for a player the sender does not own', () => {
    const { host, guest, source } = hostWithGuest();

    guest.send(host.id, { type: 'command', tick: 0, command: commandFor(0, { fire: true }) });
    host.flush();

    expect(source.next([commandFor(0)])).toEqual([commandFor(0), commandFor(1)]);
  });

  it('declares a desync on a forged fingerprint, once, and stops', () => {
    const { host, guest, source, onDesync } = hostWithGuest();
    const heard: number[] = [];
    guest.onMessage((_, message) => {
      if (message.type === 'desync') heard.push(message.tick);
    });
    source.stepped(fakeState(TICKS_PER_BAR));

    guest.send(host.id, { type: 'hash', tick: TICKS_PER_BAR, hash: 'forged' });
    guest.send(host.id, { type: 'hash', tick: TICKS_PER_BAR, hash: 'forged again' });
    host.flush();

    expect(onDesync).toHaveBeenCalledExactlyOnceWith(TICKS_PER_BAR);
    expect(heard).toEqual([TICKS_PER_BAR]);
    expect(source.next([])).toBeNull();
  });

  it('accepts a matching fingerprint', () => {
    const { host, guest, source, onDesync } = hostWithGuest();
    const state = fakeState(TICKS_PER_BAR);
    source.stepped(state);

    guest.send(host.id, { type: 'hash', tick: TICKS_PER_BAR, hash: hashState(state) });
    host.flush();

    expect(onDesync).not.toHaveBeenCalled();
  });
});

describe('createGuestSource', () => {
  function guestWithHost(): {
    host: MemoryTransport;
    source: LockstepSource;
    onDesync: ReturnType<typeof vi.fn>;
    onHostLeft: ReturnType<typeof vi.fn>;
    sent: { tick: number; command: PlayerCommand }[];
  } {
    const { host, guests } = network(2);
    const guest = guests[0];
    if (guest === undefined) throw new Error('missing guest');
    const onDesync = vi.fn();
    const onHostLeft = vi.fn();
    const sent: { tick: number; command: PlayerCommand }[] = [];
    host.onMessage((_, message) => {
      if (message.type === 'command') sent.push(message);
    });
    const source = createGuestSource(guest, [1], { onDesync, onHostLeft });
    return { host, source, onDesync, onHostLeft, sent };
  }

  it('waits when no frame is there and plays frames in order', () => {
    const { host, source } = guestWithHost();
    expect(source.next([])).toBeNull();

    host.broadcast({ type: 'frame', tick: 0, commands: [commandFor(0)] });
    host.broadcast({ type: 'frame', tick: 1, commands: [commandFor(1)] });
    host.flush();

    expect(source.next([])).toEqual([commandFor(0)]);
    expect(source.next([])).toEqual([commandFor(1)]);
    expect(source.next([])).toBeNull();
  });

  it('counts the received frames not yet played as pending', () => {
    const { host, source } = guestWithHost();

    for (let tick = 0; tick < 3; tick++) host.broadcast({ type: 'frame', tick, commands: [] });
    host.flush();
    expect(source.pending).toBe(3);
    source.next([]);

    expect(source.pending).toBe(2);
  });

  it('sends its command for the next expected frame plus the buffer', () => {
    const { host, source, sent } = guestWithHost();
    source.next([commandFor(1)]);
    host.broadcast({ type: 'frame', tick: 0, commands: [] });
    host.flush();
    source.next([commandFor(1)]);
    host.flush();

    expect(sent.map((entry) => entry.tick)).toEqual([GUEST_BUFFER_TICKS, 1 + GUEST_BUFFER_TICKS]);
  });

  it('sends a fingerprint at each bar only', () => {
    const { host, source } = guestWithHost();
    const hashes: number[] = [];
    host.onMessage((_, message) => {
      if (message.type === 'hash') hashes.push(message.tick);
    });

    source.stepped(fakeState(TICKS_PER_BAR - 1));
    source.stepped(fakeState(TICKS_PER_BAR));
    host.flush();

    expect(hashes).toEqual([TICKS_PER_BAR]);
  });

  it('stops on the desync of the host', () => {
    const { host, source, onDesync } = guestWithHost();
    host.broadcast({ type: 'frame', tick: 0, commands: [] });
    host.broadcast({ type: 'desync', tick: 48 });
    host.flush();

    expect(onDesync).toHaveBeenCalledExactlyOnceWith(48);
    expect(source.next([])).toBeNull();
  });

  it('reports the host leaving, by disconnection or by bye', () => {
    const left = guestWithHost();
    left.host.broadcast({ type: 'frame', tick: 0, commands: [] });
    left.host.flush();
    left.host.close();
    left.host.flush();
    const said = guestWithHost();
    said.host.broadcast({ type: 'frame', tick: 0, commands: [] });
    said.host.broadcast({ type: 'bye' });
    said.host.flush();

    expect(left.onHostLeft).toHaveBeenCalledOnce();
    expect(said.onHostLeft).toHaveBeenCalledOnce();
  });

  it('stops with a desync when it falls too far behind', () => {
    const { host, source, onDesync } = guestWithHost();

    for (let tick = 0; tick <= GUEST_QUEUE_CAPACITY; tick++) {
      host.broadcast({ type: 'frame', tick, commands: [] });
    }
    host.flush();

    expect(onDesync).toHaveBeenCalledExactlyOnceWith(GUEST_QUEUE_CAPACITY);
    expect(source.pending).toBe(0);
  });
});

describe('memory', () => {
  it('does not grow over 10 000 ticks', () => {
    const { host, guests } = network(3);
    const [a, b] = guests;
    if (a === undefined || b === undefined) throw new Error('missing guest');
    const hostSource = createHostSource(host, seatsFor([host, a, b]), [0], {
      onDesync: vi.fn(),
      onPeerLeft: vi.fn(),
    });
    const hooks = { onDesync: vi.fn(), onHostLeft: vi.fn() };
    const first = createGuestSource(a, [1], hooks);
    const second = createGuestSource(b, [2], hooks);
    let peak = 0;

    for (let tick = 0; tick < 10_000; tick++) {
      host.flush();
      hostSource.next([commandFor(0)]);
      hostSource.stepped(fakeState(tick + 1));
      for (const [source, id] of [
        [first, 1],
        [second, 2],
      ] as const) {
        if (source.next([commandFor(id, { fire: true })]) !== null) {
          source.stepped(fakeState(tick + 1));
        }
      }
      peak = Math.max(peak, hostSource.retained, first.retained, second.retained);
    }

    expect(peak).toBeLessThan(80);
    expect(hooks.onDesync).not.toHaveBeenCalled();
  });
});
