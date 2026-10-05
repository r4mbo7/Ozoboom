import {
  IDLE_INPUT,
  type PlayerAction,
  type PlayerCommand,
  type PlayerInput,
} from '../sim/commands';
import { hashState } from '../sim/replay';
import type { PlayerId, SimState } from '../sim/state';
import { TICKS_PER_BAR } from '../shared/tempo';
import type { CommandSource, PeerId, Seat, Transport } from './types';

export const GUEST_BUFFER_TICKS = 2;
export const GUEST_CATCH_UP_TICKS = 6;
// A tab paused for longer than this loses its place: the guest stops with a desync.
export const GUEST_QUEUE_CAPACITY = 1024;
const HOST_COMMAND_WINDOW = 64;
const HASH_RING_SIZE = 4;

export interface LockstepHooks {
  onDesync(tick: number): void;
  onHostLeft(): void;
  onPeerLeft(playerId: PlayerId): void;
}

export interface LockstepSource extends CommandSource {
  // Entries kept right now. Bounded by constants, whatever the length of the game.
  readonly retained: number;
}

interface HashEntry {
  tick: number;
  hash: string;
}

interface Pending {
  tick: number;
  input: PlayerInput;
  actions: PlayerAction[];
}

interface Guest {
  playerId: PlayerId;
  peer: PeerId | null;
  gone: boolean;
  lastInput: PlayerInput;
  ring: (Pending | undefined)[];
}

export function createHostSource(
  transport: Transport,
  seats: readonly Seat[],
  localPlayers: readonly PlayerId[],
  hooks: Pick<LockstepHooks, 'onDesync' | 'onPeerLeft'>,
): LockstepSource {
  const guests: Guest[] = seats
    .filter((seat) => !localPlayers.includes(seat.playerId))
    .map((seat) => ({
      playerId: seat.playerId,
      peer: seat.peer,
      gone: seat.peer === null,
      lastInput: IDLE_INPUT,
      ring: new Array<Pending | undefined>(HOST_COMMAND_WINDOW).fill(undefined),
    }));
  const hashes = new Array<HashEntry | undefined>(HASH_RING_SIZE).fill(undefined);
  let tick = 0;
  let desynced = false;
  let closed = false;

  function desync(at: number): void {
    if (desynced) {
      return;
    }
    desynced = true;
    transport.broadcast({ type: 'desync', tick: at });
    hooks.onDesync(at);
  }

  function leave(guest: Guest): void {
    if (guest.gone) {
      return;
    }
    guest.gone = true;
    guest.ring.fill(undefined);
    hooks.onPeerLeft(guest.playerId);
  }

  function receiveCommand(from: PeerId, at: number, command: PlayerCommand): void {
    const guest = guests.find((g) => g.playerId === command.playerId && g.peer === from);
    if (guest === undefined || guest.gone || at >= tick + HOST_COMMAND_WINDOW) {
      return;
    }
    const target = Math.max(at, tick);
    const index = target % HOST_COMMAND_WINDOW;
    const slot = guest.ring[index];
    if (slot?.tick === target) {
      slot.input = command.input;
      slot.actions.push(...command.actions);
    } else {
      guest.ring[index] = { tick: target, input: command.input, actions: [...command.actions] };
    }
  }

  function receiveHash(at: number, hash: string): void {
    const own = hashes[(at / TICKS_PER_BAR) % HASH_RING_SIZE];
    if (own?.tick === at && own.hash !== hash) {
      desync(at);
    }
  }

  const stopMessages = transport.onMessage((from, message) => {
    if (closed) {
      return;
    }
    const fromGuests = guests.filter((g) => g.peer === from);
    if (fromGuests.length === 0) {
      return;
    }
    switch (message.type) {
      case 'command':
        receiveCommand(from, message.tick, message.command);
        break;
      case 'hash':
        receiveHash(message.tick, message.hash);
        break;
      case 'desync':
        desync(message.tick);
        break;
      case 'bye':
        fromGuests.forEach(leave);
        break;
      default:
        break;
    }
  });
  const stopPeers = transport.onPeer((peer, change) => {
    if (change === 'left' && !closed) {
      guests.filter((g) => g.peer === peer).forEach(leave);
    }
  });

  function guestCommand(guest: Guest): PlayerCommand {
    const index = tick % HOST_COMMAND_WINDOW;
    const slot = guest.ring[index];
    guest.ring[index] = undefined;
    if (guest.gone) {
      return { playerId: guest.playerId, input: IDLE_INPUT, actions: [] };
    }
    if (slot?.tick === tick) {
      guest.lastInput = slot.input;
      return { playerId: guest.playerId, input: slot.input, actions: slot.actions };
    }
    return { playerId: guest.playerId, input: guest.lastInput, actions: [] };
  }

  return {
    next(local) {
      if (desynced || closed) {
        return null;
      }
      const commands = [
        ...local.filter((command) => localPlayers.includes(command.playerId)),
        ...guests.map(guestCommand),
      ];
      transport.broadcast({ type: 'frame', tick, commands });
      tick += 1;
      return commands;
    },
    stepped(state: SimState) {
      if (state.tick > 0 && state.tick % TICKS_PER_BAR === 0) {
        hashes[(state.tick / TICKS_PER_BAR) % HASH_RING_SIZE] = {
          tick: state.tick,
          hash: hashState(state),
        };
      }
    },
    pending: 0,
    get retained() {
      return (
        guests.reduce((sum, g) => sum + g.ring.filter((slot) => slot !== undefined).length, 0) +
        hashes.filter((entry) => entry !== undefined).length
      );
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      transport.broadcast({ type: 'bye' });
      stopMessages();
      stopPeers();
    },
  };
}

export function createGuestSource(
  transport: Transport,
  localPlayers: readonly PlayerId[],
  hooks: Pick<LockstepHooks, 'onDesync' | 'onHostLeft'>,
): LockstepSource {
  const queue = new Array<readonly PlayerCommand[] | undefined>(GUEST_QUEUE_CAPACITY).fill(
    undefined,
  );
  let head = 0;
  let size = 0;
  let received = 0;
  let hostId: PeerId | null = null;
  let stopped = false;
  let closed = false;

  function halt(): void {
    stopped = true;
    queue.fill(undefined);
    size = 0;
  }

  function desync(at: number, notifyHost: boolean): void {
    if (stopped) {
      return;
    }
    halt();
    if (notifyHost) {
      transport.broadcast({ type: 'desync', tick: at });
    }
    hooks.onDesync(at);
  }

  function hostLeft(): void {
    if (stopped) {
      return;
    }
    halt();
    hooks.onHostLeft();
  }

  const stopMessages = transport.onMessage((from, message) => {
    if (closed || stopped) {
      return;
    }
    switch (message.type) {
      case 'frame':
        hostId ??= from;
        if (from !== hostId || message.tick < received) {
          return;
        }
        if (message.tick > received || size === GUEST_QUEUE_CAPACITY) {
          desync(message.tick, true);
          return;
        }
        queue[(head + size) % GUEST_QUEUE_CAPACITY] = message.commands;
        size += 1;
        received += 1;
        break;
      case 'desync':
        if (from === hostId) {
          desync(message.tick, false);
        }
        break;
      case 'bye':
        if (from === hostId) {
          hostLeft();
        }
        break;
      default:
        break;
    }
  });
  const stopPeers = transport.onPeer((peer, change) => {
    if (change === 'left' && !closed && peer === hostId) {
      hostLeft();
    }
  });

  return {
    next(local) {
      if (stopped || closed) {
        return null;
      }
      const tick = received + GUEST_BUFFER_TICKS;
      for (const command of local) {
        if (localPlayers.includes(command.playerId)) {
          transport.broadcast({ type: 'command', tick, command });
        }
      }
      const frame = queue[head];
      if (frame === undefined) {
        return null;
      }
      queue[head] = undefined;
      head = (head + 1) % GUEST_QUEUE_CAPACITY;
      size -= 1;
      return frame;
    },
    stepped(state: SimState) {
      if (!stopped && !closed && state.tick > 0 && state.tick % TICKS_PER_BAR === 0) {
        transport.broadcast({ type: 'hash', tick: state.tick, hash: hashState(state) });
      }
    },
    get pending() {
      return size;
    },
    get retained() {
      return size;
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      transport.broadcast({ type: 'bye' });
      stopMessages();
      stopPeers();
    },
  };
}
