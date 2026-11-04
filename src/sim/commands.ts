import type { PlayerId, Vec2 } from './state';

export interface PlayerInput {
  move: Vec2;
  aim: Vec2;
  fire: boolean;
  skill: boolean;
}

// A bar long each, on the directional pad's up, down, left, right.
export const EMOTES = ['sunrise', 'fireworks', 'heart', 'arrow'] as const;
export type Emote = (typeof EMOTES)[number];

export type PlayerAction =
  // Lifts the trap in front of the player, or puts the carried one down in front, facing the aim.
  | { type: 'moveTrap' }
  | { type: 'chooseUpgrade'; upgradeId: string }
  // Spends a reroll of the reserve on other cards for the offer shown.
  | { type: 'rerollOffer' }
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
