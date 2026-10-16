import type { PlayerId, Vec2 } from './state';

export interface PlayerInput {
  move: Vec2;
  aim: Vec2;
  fire: boolean;
  // With `fire`: the ticks it has been held, this one included, as the player's device counted
  // them. A charged attack reads it; absent, the attack counts the ticks itself.
  fireTicks?: number;
  skill: boolean;
}

export type PlayerAction =
  // The trap faces (dx, dy), normalized by the sim; a zero vector faces the aim of the player.
  | { type: 'placeTrap'; trapId: string; x: number; y: number; dx: number; dy: number }
  // Takes back the trap placed at (x, y), as a placement there does when it finds one.
  | { type: 'takeTrap'; x: number; y: number }
  | { type: 'chooseUpgrade'; upgradeId: string }
  | { type: 'dash' };

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
