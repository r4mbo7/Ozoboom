import type { PlayerId, Vec2 } from './state';

export interface PlayerInput {
  move: Vec2;
  aim: Vec2;
  fire: boolean;
  skill: boolean;
}

export type PlayerAction =
  // The trap faces (dx, dy), normalized by the sim; a zero vector faces the aim of the player.
  | { type: 'placeTrap'; trapId: string; x: number; y: number; dx: number; dy: number }
  | { type: 'chooseUpgrade'; upgradeId: string };

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
