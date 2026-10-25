import type { PlayerId, Vec2 } from './state';

export interface PlayerInput {
  move: Vec2;
  aim: Vec2;
  fire: boolean;
  // Ticks held, this one included, as the device counted them; absent, a charged attack counts.
  fireTicks?: number;
  skill: boolean;
}

// A bar long each, on the directional pad's up, down, left, right.
export const EMOTES = ['sunrise', 'fireworks', 'heart', 'arrow'] as const;
export type Emote = (typeof EMOTES)[number];

export type PlayerAction =
  // (dx, dy) is normalized by the sim; a zero vector faces the player's aim.
  | { type: 'placeTrap'; trapId: string; x: number; y: number; dx: number; dy: number }
  | { type: 'takeTrap'; x: number; y: number }
  | { type: 'chooseUpgrade'; upgradeId: string }
  | { type: 'dash' }
  | { type: 'emote'; emote: Emote }
  // Online, the host's word that this player's peer has left, on every frame from then on.
  | { type: 'leave' };

export interface PlayerCommand {
  playerId: PlayerId;
  input: PlayerInput;
  actions: readonly PlayerAction[];
}

export const IDLE_INPUT: Readonly<PlayerInput> = {
  move: { x: 0, y: 0 },
  aim: { x: 1, y: 0 },
  fire: false,
  skill: false,
};
