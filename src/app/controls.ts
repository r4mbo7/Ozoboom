import type { TrapDefinition } from '../data/types';
import type { GameplayIntents, InputSnapshot } from '../input/intents';
import { selectTrap } from '../ui';
import { angleOf } from '../shared/angle';
import { length, normalize } from '../shared/vec';
import { IDLE_INPUT, type PlayerAction, type PlayerCommand } from '../sim/commands';
import type { PlayerState, Vec2 } from '../sim/state';

// Gap between the edge of the player and the edge of a trap placed in front of them.
export const TRAP_GAP = 16;

export type ScreenToWorld = (point: Vec2) => Vec2;
type Body = Pick<PlayerState, 'id' | 'x' | 'y' | 'radius' | 'aim'>;

export interface CommandRequest {
  readonly snapshot: InputSnapshot;
  readonly player: Body;
  readonly toWorld: ScreenToWorld;
  readonly heldAim: Vec2;
  readonly trap: TrapDefinition | undefined;
  readonly placeTrap: boolean;
  readonly upgradeId: string | null;
}

export function aimOf(
  snapshot: InputSnapshot,
  player: Body,
  toWorld: ScreenToWorld,
  heldAim: Vec2,
): Vec2 {
  if (snapshot.aimFromPointer && snapshot.pointerScreen !== null) {
    const pointer = toWorld(snapshot.pointerScreen);
    const toPointer = { x: pointer.x - player.x, y: pointer.y - player.y };
    return length(toPointer) > 0 ? normalize(toPointer) : player.aim;
  }
  return heldAim;
}

export function trapSpot(
  snapshot: InputSnapshot,
  player: Body,
  toWorld: ScreenToWorld,
  aim: Vec2,
  trap: TrapDefinition,
): Vec2 {
  if (snapshot.aimFromPointer && snapshot.pointerScreen !== null) {
    return toWorld(snapshot.pointerScreen);
  }
  const distance = player.radius + TRAP_GAP + trap.radius;
  return { x: player.x + aim.x * distance, y: player.y + aim.y * distance };
}

export function buildCommand(request: CommandRequest): PlayerCommand {
  const { snapshot, player, toWorld, heldAim, trap } = request;
  const { gameplay } = snapshot;
  const aim = aimOf(snapshot, player, toWorld, heldAim);
  const actions: PlayerAction[] = [];
  if (request.placeTrap && trap !== undefined) {
    const spot = trapSpot(snapshot, player, toWorld, aim, trap);
    actions.push({ type: 'placeTrap', trapId: trap.id, x: spot.x, y: spot.y, angle: angleOf(aim) });
  }
  if (request.upgradeId !== null) {
    actions.push({ type: 'chooseUpgrade', upgradeId: request.upgradeId });
  }
  return {
    playerId: player.id,
    input: {
      move: gameplay.move,
      aim,
      fire: gameplay.fire,
      skill: gameplay.skill,
      ultimate: gameplay.ultimate,
    },
    actions,
  };
}

// Away from the pointer, the aim is held: the right stick sets it when it moves, and the keyboard,
// which has no aiming keys, aims where the player last moved. The input keeps the last stick
// direction in `gameplay.aim`, so a change there is the stick moving.
export function nextHeldAim(
  previous: Vec2,
  snapshot: InputSnapshot,
  previousGameplay: GameplayIntents | null,
): Vec2 {
  const { aim, move } = snapshot.gameplay;
  if (
    previousGameplay !== null &&
    (aim.x !== previousGameplay.aim.x || aim.y !== previousGameplay.aim.y)
  ) {
    return aim;
  }
  if (snapshot.device !== 'gamepad' && length(move) > 0) {
    return normalize(move);
  }
  return previous;
}

// Input is read once per frame; the sim steps 0 to n times per frame. Discrete intents of a frame
// wait for its first step, continuous ones apply to every step until the next frame.
export class Controls {
  private snapshot: InputSnapshot | null = null;
  private previousGameplay: GameplayIntents | null = null;
  private heldAim: Vec2;
  private placeTrap = false;
  private upgradeId: string | null = null;
  private trapIndex = 0;
  private readonly traps: readonly TrapDefinition[];

  // The first aim, before any input, should point away from the scene, where the bad vibes come
  // from and where a trap placed in front of the player fits.
  constructor(traps: readonly TrapDefinition[], initialAim: Vec2) {
    this.traps = traps;
    this.heldAim = initialAim;
  }

  frame(snapshot: InputSnapshot): void {
    const { gameplay } = snapshot;
    this.trapIndex = selectTrap(this.trapIndex, this.traps.length, gameplay, this.previousGameplay);
    this.heldAim = nextHeldAim(this.heldAim, snapshot, this.previousGameplay);
    this.previousGameplay = gameplay;
    this.placeTrap ||= gameplay.placeTrap;
    this.snapshot = snapshot;
  }

  chooseUpgrade(upgradeId: string): void {
    this.upgradeId = upgradeId;
  }

  command(player: Body, toWorld: ScreenToWorld): PlayerCommand {
    if (this.snapshot === null) {
      return { playerId: player.id, input: IDLE_INPUT, actions: [] };
    }
    const command = buildCommand({
      snapshot: this.snapshot,
      player,
      toWorld,
      heldAim: this.heldAim,
      trap: this.traps[this.trapIndex],
      placeTrap: this.placeTrap,
      upgradeId: this.upgradeId,
    });
    this.placeTrap = false;
    this.upgradeId = null;
    return command;
  }
}
