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

// The beats of the bar a card choice looped that the game plays again once it is answered: picked
// with two beats left in that bar, the game goes on two beats before its end, with the music.
export const REPLAY_BEATS = [0, 1, 2, 3] as const;
export type ReplayBeats = (typeof REPLAY_BEATS)[number];

export type PlayerAction =
  // Lifts the trap in front of the player, or puts the carried one down in front, facing the aim.
  | { type: 'moveTrap' }
  // `replayBeats` counts only on the pick that ends the choice; absent means none.
  | { type: 'chooseUpgrade'; upgradeId: string; replayBeats?: ReplayBeats }
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
