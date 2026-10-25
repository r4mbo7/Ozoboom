import { joinHash } from '../net/code';
import type { Room } from '../net/room';
import type { PeerId, Role, Seat } from '../net/types';
import type { LobbyModel, StageCard } from '../ui';

const ITCH_ORIGIN = 'https://html-classic.itch.zone';
const DEMO_SITE = 'https://r4mbo7.github.io/Ozoboom/';
const MIN_PLAYERS_TO_LAUNCH = 2;

// itch.io serves the demo at an address that changes with every upload: a shared link points to the demo's own site.
export function shareBase(origin: string, pathname: string): string {
  return origin === ITCH_ORIGIN ? DEMO_SITE : `${origin}${pathname}`;
}

export interface OnlineLobby {
  readonly room: Pick<Room, 'seats' | 'setId' | 'endless' | 'festival'> | null;
  readonly role: Role | null;
  readonly code: string | null;
  readonly localPeer: PeerId | undefined;
  readonly error: string | null;
}

export interface LobbyDefaults {
  readonly stages: readonly StageCard[];
  // What the host proposes when it opens a room: as in the last game.
  stageId(): string;
  endless(): boolean;
  festival(): boolean;
}

export function canLaunch(role: Role | null, seats: readonly Seat[]): boolean {
  return role === 'host' && seats.length >= MIN_PLAYERS_TO_LAUNCH;
}

export function lobbyModel(
  lobby: OnlineLobby,
  defaults: LobbyDefaults,
  page: Pick<Location, 'origin' | 'pathname'>,
): LobbyModel {
  const { room, role, code } = lobby;
  const seats = room?.seats ?? [];
  return {
    mode: 'online',
    role: role ?? 'host',
    code,
    link: code === null ? null : `${shareBase(page.origin, page.pathname)}${joinHash(code)}`,
    seats: seats.map((seat) => ({
      playerId: seat.playerId,
      name: seat.name,
      classId: seat.classId,
      device: null,
      remote: seat.peer !== lobby.localPeer,
      host: seat.playerId === 0,
    })),
    canLaunch: canLaunch(role, seats),
    error: lobby.error,
    stages: defaults.stages,
    stageId: room?.setId ?? defaults.stageId(),
    endless: room?.endless ?? defaults.endless(),
    festival: room?.festival ?? defaults.festival(),
  };
}
