import { generateCode, hostPeerId, normalizeCode } from '../net/code';
import {
  type LockstepHooks,
  type LockstepSource,
  createGuestSource,
  createHostSource,
} from '../net/lockstep';
import { createPeerTransport, type PeerTransport } from '../net/peerjs';
import { createRoom, sendToGuests, startMessage, type Room, type StartMessage } from '../net/room';
import type { PeerId, Role, Seat } from '../net/types';
import { t } from '../shared/i18n';
import type { PlayerId } from '../sim/state';
import type { LobbyModel, Notice, Ui } from '../ui';
import { type LobbyDefaults, canLaunch, lobbyModel } from './online-lobby';
import { connectionText, hostSilentText, refusalText } from './online-text';
import { createHostWatch, createRoundTripProbe } from './online-watch';

export interface OnlineMatch {
  readonly role: Role;
  readonly start: StartMessage;
  readonly localPlayer: PlayerId;
  readonly source: LockstepSource;
}

export interface Interruption {
  readonly notice: Notice;
  readonly details: string;
  readonly desyncTick?: number;
}

export interface OnlineEnv extends LobbyDefaults {
  readonly ui: Pick<Ui, 'showLobby' | 'updateLobby'>;
  readonly classIds: readonly string[];
  classId(): string;
  trackId(): string;
  version(): string;
  onMatch(match: OnlineMatch): void;
  onInterruption(interruption: Interruption): void;
  onGuestLeft(playerId: PlayerId): void;
}

export interface Online {
  readonly active: boolean;
  readonly role: Role | null;
  // 0 outside a match.
  readonly players: number;
  readonly pending: number;
  readonly roundTripMs: number | null;
  readonly connectMs: number | null;
  open(): void;
  createRoom(): void;
  joinRoom(code: string): void;
  setSeatName(name: string): void;
  setSeatClass(classId: string): void;
  // Host only.
  setStage(setId: string): void;
  // Host only.
  setNight(endless: boolean, festival: boolean): void;
  launch(): void;
  matchEnded(): void;
  // Host only, from the end screen.
  relaunch(): void;
  leave(): void;
}

// The host sends a frame every tick: a guest that hears nothing for this long has lost it.
const HOST_SILENCE_MS = 8000;

type Phase = 'idle' | 'lobby' | 'playing' | 'ended';

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

export function presentSeats(
  seats: readonly Seat[],
  localPeer: PeerId,
  departed: ReadonlySet<PeerId>,
): Seat[] {
  return seats.filter((seat) => seat.peer === localPeer || !departed.has(seat.peer ?? ''));
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
  let connectMs: number | null = null;
  const roundTrip = createRoundTripProbe(() => transport?.roundTripMs());
  const hostWatch = createHostWatch({
    now: () => performance.now(),
    timeoutMs: HOST_SILENCE_MS,
    watching: () => phase === 'playing',
    silent: hostWentSilent,
  });
  const departed = new Set<PeerId>();
  const lockstepHooks: LockstepHooks = {
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
    onHostLeft() {
      interrupt({ notice: 'hostLeft', details: '' });
    },
    onFellBehind() {
      interrupt({ notice: 'connectionLost', details: t('Ton onglet a pris trop de retard.') });
    },
  };

  function model(): LobbyModel {
    return lobbyModel({ room, role, code, localPeer: transport?.id, error }, env, window.location);
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
    hostWatch.stop();
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
    roundTrip.stop();
    connectMs = null;
    departed.clear();
  }

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

  function hostWentSilent(): void {
    source?.close();
    interrupt({ notice: 'connectionLost', details: hostSilentText(HOST_SILENCE_MS / 1000) });
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
    return createHostSource(transport, seats, [0], lockstepHooks);
  }

  function guestSource(localPlayer: PlayerId): LockstepSource {
    if (transport === null || code === null) {
      throw new Error('No transport to join a match');
    }
    return createGuestSource(transport, hostPeerId(code), [localPlayer], lockstepHooks);
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
    roundTrip.start();
    if (role === 'guest') {
      hostWatch.start();
    }
  }

  function transportFailed(failure: Error): void {
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
  }

  function peerLeft(peer: PeerId, as: Role, roomCode: string): void {
    departed.add(peer);
    if (as === 'guest' && peer === hostPeerId(roomCode)) {
      if (phase === 'lobby') {
        failLobby(t('L’hôte a fermé le salon'));
      } else {
        interrupt({ notice: 'hostLeft', details: '' });
      }
    }
  }

  function enterRoom(opened: PeerTransport, as: Role, roomCode: string): void {
    transport = opened;
    role = as;
    code = roomCode;
    phase = 'lobby';
    const joined = createRoom(opened, as, {
      version: env.version(),
      name: '',
      classId: env.classId(),
      classIds: env.classIds,
      setId: env.stageId(),
      endless: env.endless(),
      festival: env.festival(),
    });
    room = joined;
    joined.onChange(showLobby);
    joined.onStart(handleStart);
    joined.onRefused((reason) => {
      failLobby(refusalText(reason));
    });
    opened.onMessage(() => {
      hostWatch.heard();
    });
    opened.onPeer((peer, change) => {
      if (change === 'left') {
        peerLeft(peer, as, roomCode);
      }
    });
    showLobby();
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
          if (generation === mine) {
            transportFailed(failure);
          }
        },
      });
      if (generation !== mine) {
        opened.close();
        return;
      }
      connectMs = Math.round(performance.now() - began);
      enterRoom(opened, as, roomCode);
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

  function relaunch(): void {
    if (room === null || transport === null || role !== 'host') {
      return;
    }
    source?.close();
    const present = presentSeats(room.seats, transport.id, departed);
    const start = startMessage(present, {
      seed: randomSeed(),
      setId: room.setId ?? env.stageId(),
      trackId: env.trackId(),
      endless: room.endless,
      festival: room.festival,
    });
    sendToGuests(transport, present, start);
    launched(start, hostSource(present), 0);
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
      return roundTrip.ms;
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
        failLobby(t('Ce code n’est pas valide'));
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
    setStage(setId) {
      room?.setStage(setId);
    },
    setNight(endless, festival) {
      room?.setEndless(endless);
      room?.setFestival(festival);
    },
    launch() {
      if (room === null || !canLaunch(role, room.seats)) {
        return;
      }
      room.start(room.setId ?? env.stageId(), randomSeed(), env.trackId());
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
    relaunch,
    leave() {
      teardown();
      lobbyShown = false;
      error = null;
    },
  };
}
