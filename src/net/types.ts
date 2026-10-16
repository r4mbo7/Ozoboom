import type { PlayerCommand } from '../sim/commands';
import type { PlayerSlot } from '../sim/initial-state';
import type { PlayerId, SimState } from '../sim/state';

export type PeerId = string;
export type Role = 'host' | 'guest';

export interface Seat {
  playerId: PlayerId;
  peer: PeerId | null;
  // Empty when the player typed none: each screen names it in its own language.
  name: string;
  classId: string;
}

export type NetMessage =
  | { type: 'hello'; version: string; name: string; classId: string }
  | { type: 'refused'; reason: 'version' | 'full' | 'started'; version: string }
  | { type: 'lobby'; seats: readonly Seat[]; setId?: string; endless?: boolean }
  | { type: 'seat'; name?: string; classId?: string }
  | {
      type: 'start';
      seed: number;
      setId: string;
      // The music every peer plays: the simulation never sees it.
      trackId: string;
      players: readonly PlayerSlot[];
      // The last boss down, the set goes on. Absent means it ends.
      endless?: boolean;
    }
  | { type: 'command'; tick: number; command: PlayerCommand }
  | { type: 'frame'; tick: number; commands: readonly PlayerCommand[] }
  | { type: 'hash'; tick: number; hash: string }
  | { type: 'desync'; tick: number }
  | { type: 'bye' };

export interface Transport {
  readonly id: PeerId;
  send(to: PeerId, message: NetMessage): void;
  broadcast(message: NetMessage): void;
  // Drops one peer's connection; both sides see 'left'.
  disconnect(peer: PeerId): void;
  onMessage(listener: (from: PeerId, message: NetMessage) => void): () => void;
  onPeer(listener: (peer: PeerId, change: 'joined' | 'left') => void): () => void;
  close(): void;
}

export interface CommandSource {
  next(local: readonly PlayerCommand[]): readonly PlayerCommand[] | null;
  stepped(state: SimState): void;
  readonly pending: number;
  close(): void;
}
