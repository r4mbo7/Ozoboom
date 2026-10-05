import { generateCode, hostPeerId, joinHash, normalizeCode } from '../net/code';
import { createGuestSource, createHostSource, type LockstepSource } from '../net/lockstep';
import { createPeerTransport, type PeerTransport } from '../net/peerjs';
import { createRoom, type RefusalReason, type Room, type StartMessage } from '../net/room';
import type { PeerId, Role, Seat } from '../net/types';
import type { PlayerId } from '../sim/state';
import type { LobbyModel, Notice, Ui } from '../ui';

// One online game: what the app needs to run it, whoever hosts.
export interface OnlineMatch {
  readonly role: Role;
  readonly start: StartMessage;
  readonly localPlayer: PlayerId;
  readonly source: LockstepSource;
}

export interface Interruption {
  readonly notice: Notice;
  readonly details: string;
  // The tick at which the peers diverged.
  readonly desyncTick?: number;
}

export interface OnlineEnv {
  readonly ui: Pick<Ui, 'showLobby' | 'updateLobby'>;
  readonly setId: string;
  readonly classIds: readonly string[];
  // The class picked on the title.
  classId(): string;
  version(): string;
  onMatch(match: OnlineMatch): void;
  // A game that cannot go on: the app shows the notice and stops stepping.
  onInterruption(interruption: Interruption): void;
  // A player who left a game that goes on without them.
  onGuestLeft(playerId: PlayerId): void;
}

export interface Online {
  readonly active: boolean;
  readonly role: Role | null;
  // Players of the current match, 0 outside one.
  readonly players: number;
  // Frames received from the host and not played yet.
  readonly pending: number;
  readonly roundTripMs: number | null;
  readonly connectMs: number | null;
  // The entry of the online lobby: create a room or join one.
  open(): void;
  createRoom(): void;
  joinRoom(code: string): void;
  setSeatName(name: string): void;
  setSeatClass(classId: string): void;
  launch(): void;
  // The end screen shows: a guest tells the host its game is over.
  matchEnded(): void;
  // Host only, from the end screen: the same players, a new set.
  relaunch(): void;
  // Closes everything, telling the other players.
  leave(): void;
}

const ROUND_TRIP_REFRESH_MS = 2000;
const MIN_PLAYERS_TO_LAUNCH = 2;

type Phase = 'idle' | 'lobby' | 'playing' | 'ended';

function refusalText(reason: RefusalReason): string {
  switch (reason) {
    case 'version':
      return 'Recharge la page';
    case 'full':
      return 'Salon plein';
    case 'started':
      return 'La partie a déjà commencé';
  }
}

function connectionText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('no room with the code')) {
    return 'Aucun salon ne porte ce code';
  }
  if (message.includes('already taken')) {
    return 'Ce code est déjà pris, réessaie';
  }
  if (message.includes('did not answer') || message.includes('no answer from')) {
    return 'Pas de réponse : réessaie, ou vérifie le code';
  }
  return `Connexion impossible (${message})`;
}

export function createOnline(env: OnlineEnv): Online {
  let transport: PeerTransport | null = null;
  let room: Room | null = null;
  let role: Role | null = null;
  let code: string | null = null;
  let source: LockstepSource | null = null;
  let phase: Phase = 'idle';
  let error: string | null = null;
  let interrupted = false;
  let busy = false;
  let generation = 0;
  let lobbyShown = false;
  let players = 0;
  let roundTripMs: number | null = null;
  let connectMs: number | null = null;
  let refresh: ReturnType<typeof setInterval> | undefined;
  const departed = new Set<PeerId>();

  function link(): string | null {
    return code === null
      ? null
      : `${window.location.origin}${window.location.pathname}${joinHash(code)}`;
  }

  function model(): LobbyModel {
    const seats = room?.seats ?? [];
    return {
      mode: 'online',
      role: role ?? 'host',
      code,
      link: link(),
      seats: seats.map((seat) => ({
        playerId: seat.playerId,
        name: seat.name,
        classId: seat.classId,
        device: null,
        remote: seat.peer !== transport?.id,
        host: seat.playerId === 0,
      })),
      canLaunch: role === 'host' && seats.length >= MIN_PLAYERS_TO_LAUNCH,
      error,
    };
  }

  function showLobby(): void {
    if (lobbyShown) {
      env.ui.updateLobby(model());
    } else {
      lobbyShown = true;
      env.ui.showLobby(model());
    }
  }

  function teardown(): void {
    generation += 1;
    busy = false;
    clearInterval(refresh);
    refresh = undefined;
    source?.close();
    source = null;
    room?.dispose();
    room = null;
    transport?.close();
    transport = null;
    role = null;
    code = null;
    phase = 'idle';
    interrupted = false;
    players = 0;
    roundTripMs = null;
    connectMs = null;
    departed.clear();
  }

  // Back to the entry of the lobby, with what went wrong.
  function failLobby(text: string): void {
    teardown();
    error = text;
    showLobby();
  }

  function interrupt(interruption: Interruption): void {
    if (interrupted || (phase !== 'playing' && phase !== 'ended')) {
      return;
    }
    interrupted = true;
    phase = 'ended';
    env.onInterruption(interruption);
  }

  function launched(
    match: StartMessage,
    activeSource: LockstepSource,
    localPlayer: PlayerId,
  ): void {
    source = activeSource;
    phase = 'playing';
    interrupted = false;
    players = match.players.length;
    if (role === null) {
      throw new Error('A match cannot start outside a room');
    }
    env.onMatch({ role, start: match, localPlayer, source: activeSource });
  }

  function hostSource(seats: readonly Seat[]): LockstepSource {
    if (transport === null) {
      throw new Error('No transport to host a match');
    }
    return createHostSource(transport, seats, [0], {
      onDesync(tick) {
        if (phase === 'playing') {
          interrupt({ notice: 'desync', details: `Tick ${String(tick)}`, desyncTick: tick });
        }
      },
      onPeerLeft(playerId) {
        if (phase === 'playing') {
          env.onGuestLeft(playerId);
        }
      },
    });
  }

  function guestSource(localPlayer: PlayerId): LockstepSource {
    if (transport === null || code === null) {
      throw new Error('No transport to join a match');
    }
    return createGuestSource(transport, hostPeerId(code), [localPlayer], {
      onDesync(tick) {
        if (phase === 'playing') {
          interrupt({ notice: 'desync', details: `Tick ${String(tick)}`, desyncTick: tick });
        }
      },
      onHostLeft() {
        interrupt({ notice: 'hostLeft', details: '' });
      },
      onFellBehind() {
        interrupt({ notice: 'connectionLost', details: 'Ton onglet a pris trop de retard.' });
      },
    });
  }

  function startRoundTripProbe(): void {
    clearInterval(refresh);
    const measure = (): void => {
      void transport?.roundTripMs().then((value) => {
        roundTripMs = value;
      });
    };
    refresh = setInterval(measure, ROUND_TRIP_REFRESH_MS);
  }

  function handleStart(start: StartMessage): void {
    if (room === null || transport === null) {
      return;
    }
    if (role === 'host') {
      launched(start, hostSource(room.seats), 0);
    } else {
      const localPlayer = room.localSeat?.playerId;
      if (localPlayer === undefined) {
        throw new Error('The host started a game without a seat for this player');
      }
      launched(start, guestSource(localPlayer), localPlayer);
    }
    startRoundTripProbe();
  }

  async function connect(as: Role, roomCode: string): Promise<void> {
    if (busy) {
      return;
    }
    teardown();
    busy = true;
    const mine = generation;
    error = null;
    const began = performance.now();
    try {
      const opened = await createPeerTransport({
        role: as,
        code: roomCode,
        onError(failure) {
          if (generation !== mine) {
            return;
          }
          if (phase === 'playing' || phase === 'ended') {
            // The broker only matters to those who have yet to join: a game goes on without it.
            if (failure.message.startsWith('PeerJS broker')) {
              console.warn(failure.message);
            } else {
              interrupt({ notice: 'connectionLost', details: failure.message });
            }
          } else {
            failLobby(connectionText(failure));
          }
        },
      });
      if (generation !== mine) {
        opened.close();
        return;
      }
      connectMs = Math.round(performance.now() - began);
      transport = opened;
      role = as;
      code = roomCode;
      phase = 'lobby';
      const joined = createRoom(opened, as, {
        version: env.version(),
        name: '',
        classId: env.classId(),
        classIds: env.classIds,
      });
      room = joined;
      joined.onChange(showLobby);
      joined.onStart(handleStart);
      joined.onRefused((reason) => {
        failLobby(refusalText(reason));
      });
      opened.onPeer((peer, change) => {
        if (change !== 'left') {
          return;
        }
        departed.add(peer);
        if (as === 'guest' && peer === hostPeerId(roomCode)) {
          if (phase === 'lobby') {
            failLobby('L’hôte a fermé le salon');
          } else {
            interrupt({ notice: 'hostLeft', details: '' });
          }
        }
      });
      showLobby();
    } catch (failure) {
      if (generation === mine) {
        failLobby(connectionText(failure));
      }
    } finally {
      if (generation === mine) {
        busy = false;
      }
    }
  }

  return {
    get active() {
      return transport !== null;
    },
    get role() {
      return role;
    },
    get players() {
      return players;
    },
    get pending() {
      return source?.pending ?? 0;
    },
    get roundTripMs() {
      return roundTripMs;
    },
    get connectMs() {
      return connectMs;
    },
    open() {
      teardown();
      error = null;
      lobbyShown = true;
      env.ui.showLobby(model());
    },
    createRoom() {
      void connect('host', generateCode());
    },
    joinRoom(typed) {
      if (!lobbyShown) {
        lobbyShown = true;
        env.ui.showLobby(model());
      }
      const roomCode = normalizeCode(typed);
      if (roomCode === null) {
        failLobby('Ce code n’est pas valide');
        return;
      }
      void connect('guest', roomCode);
    },
    setSeatName(name) {
      room?.setSeat({ name });
    },
    setSeatClass(classId) {
      room?.setSeat({ classId });
    },
    launch() {
      if (room === null || role !== 'host' || !model().canLaunch) {
        return;
      }
      room.start(env.setId, crypto.getRandomValues(new Uint32Array(1))[0] ?? 0);
    },
    matchEnded() {
      if (phase !== 'playing') {
        return;
      }
      phase = 'ended';
      // The host closes its source when it starts again or leaves, a guest's own game being over.
      if (role === 'guest') {
        source?.close();
      }
    },
    relaunch() {
      if (room === null || transport === null || role !== 'host') {
        return;
      }
      source?.close();
      const present = room.seats.filter(
        (seat) => seat.peer === transport?.id || !departed.has(seat.peer ?? ''),
      );
      const start: StartMessage = {
        type: 'start',
        seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
        setId: env.setId,
        players: present.map((seat) => ({
          id: seat.playerId,
          classId: seat.classId,
          name: seat.name,
        })),
      };
      for (const seat of present) {
        if (seat.peer !== null && seat.peer !== transport.id) {
          transport.send(seat.peer, start);
        }
      }
      launched(start, hostSource(present), 0);
    },
    leave() {
      teardown();
      lobbyShown = false;
      error = null;
    },
  };
}
