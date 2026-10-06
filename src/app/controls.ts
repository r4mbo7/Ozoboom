import type { TrapDefinition } from '../data/types';
import type { GameplayIntents, InputSnapshot } from '../input/intents';
import { selectTrap } from '../ui';
import { distanceSquared, length, normalize } from '../shared/vec';
import { IDLE_INPUT, type PlayerAction, type PlayerCommand } from '../sim/commands';
import type { EnemyState, PlayerState, Vec2 } from '../sim/state';

export type ScreenToWorld = (point: Vec2) => Vec2;
type Body = Pick<PlayerState, 'id' | 'x' | 'y' | 'radius' | 'aim'>;
export type Target = Pick<EnemyState, 'x' | 'y' | 'radius' | 'hp'>;

export interface CommandRequest {
  readonly snapshot: InputSnapshot;
  readonly player: Body;
  readonly toWorld: ScreenToWorld;
  readonly heldAim: Vec2;
  readonly trap: TrapDefinition | undefined;
  readonly placeTrap: boolean;
  readonly upgradeId: string | null;
  // On a touch screen, the bad vibe the player aims and fires at by themselves.
  readonly target: Vec2 | null;
  // Where on the screen a finger dropped the trap; null places it under the player.
  readonly trapScreen: Vec2 | null;
}

// The bad vibe nearest to the player among those their attack reaches.
export function autoTarget(player: Vec2, enemies: readonly Target[], reach: number): Target | null {
  let best: Target | null = null;
  let bestDistance = Infinity;
  for (const enemy of enemies) {
    const distance = distanceSquared(enemy, player);
    const inReach = (reach + enemy.radius) ** 2;
    if (enemy.hp > 0 && distance <= inReach && distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
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

export function buildCommand(request: CommandRequest): PlayerCommand {
  const { snapshot, player, toWorld, heldAim, trap, target } = request;
  const { gameplay } = snapshot;
  const toTarget = target === null ? null : { x: target.x - player.x, y: target.y - player.y };
  const aim =
    toTarget !== null && length(toTarget) > 0
      ? normalize(toTarget)
      : aimOf(snapshot, player, toWorld, heldAim);
  const actions: PlayerAction[] = [];
  if (request.placeTrap && trap !== undefined) {
    const spot = request.trapScreen === null ? player : toWorld(request.trapScreen);
    actions.push({
      type: 'placeTrap',
      trapId: trap.id,
      x: spot.x,
      y: spot.y,
      dx: aim.x,
      dy: aim.y,
    });
  }
  if (request.upgradeId !== null) {
    actions.push({ type: 'chooseUpgrade', upgradeId: request.upgradeId });
  }
  return {
    playerId: player.id,
    input: {
      move: gameplay.move,
      aim,
      fire: gameplay.fire || target !== null,
      skill: gameplay.skill,
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
  private trapScreen: Vec2 | null = null;
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
    if (gameplay.placeTrap && !this.placeTrap) {
      this.placeTrap = true;
      this.trapScreen = snapshot.device === 'touch' ? snapshot.pointerScreen : null;
    }
    this.snapshot = snapshot;
  }

  chooseUpgrade(upgradeId: string): void {
    this.upgradeId = upgradeId;
  }

  // `reach`: how far the player's attack flies now, for the automatic aim of a touch screen.
  command(
    player: Body,
    toWorld: ScreenToWorld,
    enemies: readonly Target[],
    reach: number,
  ): PlayerCommand {
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
      target: this.snapshot.device === 'touch' ? autoTarget(player, enemies, reach) : null,
      trapScreen: this.trapScreen,
    });
    this.placeTrap = false;
    this.trapScreen = null;
    this.upgradeId = null;
    return command;
  }
}
