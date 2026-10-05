import { trimPlayerName } from '../shared/player-name';
import type { PlayerSlot } from '../sim/initial-state';
import type { PlayerId } from '../sim/state';
import type { NetMessage, PeerId, Role, Seat, Transport } from './types';

const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];
export const MAX_SEATS = PLAYER_IDS.length;

export type RefusalReason = 'version' | 'full' | 'started';
export type StartMessage = Extract<NetMessage, { type: 'start' }>;

export interface RoomProfile {
  version: string;
  name: string;
  classId: string;
  // Known classes: an unknown one becomes the first of the list.
  classIds: readonly string[];
}

export interface Room {
  readonly role: Role;
  readonly seats: readonly Seat[];
  // The seat of this peer, once the host has given it one.
  readonly localSeat: Seat | null;
  // Changes this peer's own name and/or class and tells the room.
  setSeat(change: { name?: string; classId?: string }): void;
  // Host only: freezes the room, sends the start to the guests and fires onStart here too.
  start(setId: string, seed: number): StartMessage;
  onChange(listener: (seats: readonly Seat[]) => void): () => void;
  // Guest only: the host's version is given so the player can be told what to update to.
  onRefused(listener: (reason: RefusalReason, hostVersion: string) => void): () => void;
  onStart(listener: (start: StartMessage) => void): () => void;
  dispose(): void;
}

function cleanName(name: string, playerId: PlayerId): string {
  return trimPlayerName(name) || `Joueur ${String(playerId + 1)}`;
}

export function createRoom(transport: Transport, role: Role, profile: RoomProfile): Room {
  const knownClass = (classId: string): string =>
    profile.classIds.includes(classId) ? classId : (profile.classIds[0] ?? classId);
  const changeListeners = new Set<(seats: readonly Seat[]) => void>();
  const refusedListeners = new Set<(reason: RefusalReason, hostVersion: string) => void>();
  const startListeners = new Set<(start: StartMessage) => void>();

  let seats: Seat[] =
    role === 'host'
      ? [
          {
            playerId: 0,
            peer: transport.id,
            name: cleanName(profile.name, 0),
            classId: knownClass(profile.classId),
          },
        ]
      : [];
  let started = false;

  const notify = (): void => {
    for (const listener of [...changeListeners]) {
      listener(seats);
    }
  };

  const publish = (): void => {
    const message: NetMessage = { type: 'lobby', seats };
    for (const seat of seats) {
      if (seat.peer !== null && seat.peer !== transport.id) {
        transport.send(seat.peer, message);
      }
    }
    notify();
  };

  const firstFreePlayerId = (): PlayerId => {
    for (const id of PLAYER_IDS) {
      if (!seats.some((seat) => seat.playerId === id)) {
        return id;
      }
    }
    throw new RangeError('no free seat: the caller must check the room is not full');
  };

  const refuse = (peer: PeerId, reason: RefusalReason): void => {
    transport.send(peer, { type: 'refused', reason, version: profile.version });
    transport.disconnect(peer);
  };

  const updateSeat = (peer: PeerId, change: { name?: string; classId?: string }): void => {
    seats = seats.map((seat) =>
      seat.peer === peer
        ? {
            ...seat,
            name: change.name === undefined ? seat.name : cleanName(change.name, seat.playerId),
            classId: change.classId === undefined ? seat.classId : knownClass(change.classId),
          }
        : seat,
    );
  };

  const release = (peer: PeerId): void => {
    if (started || !seats.some((seat) => seat.peer === peer)) {
      return;
    }
    seats = seats.filter((seat) => seat.peer !== peer);
    publish();
  };

  const handleAsHost = (from: PeerId, message: NetMessage): void => {
    const seated = seats.some((seat) => seat.peer === from);
    switch (message.type) {
      case 'hello':
        if (seated) {
          return;
        }
        if (message.version !== profile.version) {
          refuse(from, 'version');
        } else if (started) {
          refuse(from, 'started');
        } else if (seats.length >= MAX_SEATS) {
          refuse(from, 'full');
        } else {
          const playerId = firstFreePlayerId();
          seats = [
            ...seats,
            {
              playerId,
              peer: from,
              name: cleanName(message.name, playerId),
              classId: knownClass(message.classId),
            },
          ].sort((a, b) => a.playerId - b.playerId);
          publish();
        }
        return;
      case 'seat':
        if (seated && !started) {
          updateSeat(from, message);
          publish();
        }
        return;
      case 'bye':
        release(from);
        return;
      default:
        return;
    }
  };

  const handleAsGuest = (message: NetMessage): void => {
    switch (message.type) {
      case 'lobby':
        seats = [...message.seats];
        notify();
        return;
      case 'refused':
        for (const listener of [...refusedListeners]) {
          listener(message.reason, message.version);
        }
        return;
      case 'start':
        started = true;
        for (const listener of [...startListeners]) {
          listener(message);
        }
        return;
      default:
        return;
    }
  };

  const stopMessages = transport.onMessage((from, message) => {
    if (role === 'host') {
      handleAsHost(from, message);
    } else {
      handleAsGuest(message);
    }
  });

  const stopPeers = transport.onPeer((peer, change) => {
    if (role === 'host' && change === 'left') {
      release(peer);
    }
  });

  if (role === 'guest') {
    transport.broadcast({
      type: 'hello',
      version: profile.version,
      name: profile.name,
      classId: profile.classId,
    });
  }

  return {
    role,
    get seats() {
      return seats;
    },
    get localSeat() {
      return seats.find((seat) => seat.peer === transport.id) ?? null;
    },
    setSeat(change) {
      if (started) {
        return;
      }
      if (role === 'host') {
        updateSeat(transport.id, change);
        publish();
      } else {
        const message: NetMessage = { type: 'seat' };
        if (change.name !== undefined) message.name = change.name;
        if (change.classId !== undefined) message.classId = change.classId;
        transport.broadcast(message);
      }
    },
    start(setId, seed) {
      if (role !== 'host') {
        throw new Error('only the host starts the game');
      }
      if (started) {
        throw new Error('the game has already started');
      }
      started = true;
      const players: PlayerSlot[] = seats.map((seat) => ({
        id: seat.playerId,
        classId: seat.classId,
        name: seat.name,
      }));
      const message: StartMessage = { type: 'start', seed, setId, players };
      for (const seat of seats) {
        if (seat.peer !== null && seat.peer !== transport.id) {
          transport.send(seat.peer, message);
        }
      }
      for (const listener of [...startListeners]) {
        listener(message);
      }
      return message;
    },
    onChange(listener) {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },
    onRefused(listener) {
      refusedListeners.add(listener);
      return () => refusedListeners.delete(listener);
    },
    onStart(listener) {
      startListeners.add(listener);
      return () => startListeners.delete(listener);
    },
    dispose() {
      stopMessages();
      stopPeers();
      changeListeners.clear();
      refusedListeners.clear();
      startListeners.clear();
    },
  };
}
