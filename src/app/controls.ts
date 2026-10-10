import type { GameplayIntents, InputSnapshot } from '../input/intents';
import { heldSlot, selectTrap } from '../ui';
import { distanceSquared, length, normalize } from '../shared/vec';
import { IDLE_INPUT, type PlayerAction, type PlayerCommand } from '../sim/commands';
import type { EnemyState, PlayerState, Vec2 } from '../sim/state';

export type ScreenToWorld = (point: Vec2) => Vec2;
type Body = Pick<PlayerState, 'id' | 'x' | 'y' | 'radius' | 'aim' | 'hand'>;
export type Target = Pick<EnemyState, 'x' | 'y' | 'radius' | 'hp'>;

// What the game does by itself for the player, on the nearest bad vibe in reach. A touch screen
// always has both; elsewhere the player turns them on.
export interface Assist {
  readonly autoFire: boolean;
  readonly autoAim: boolean;
}

export const NO_ASSIST: Assist = { autoFire: false, autoAim: false };
const TOUCH_ASSIST: Assist = { autoFire: true, autoAim: true };

export interface CommandRequest {
  readonly snapshot: InputSnapshot;
  readonly player: Body;
  readonly toWorld: ScreenToWorld;
  readonly heldAim: Vec2;
  readonly trapId: string | undefined;
  readonly placeTrap: boolean;
  readonly upgradeId: string | null;
  readonly assist: Assist;
  // The bad vibe the assist aims or fires at.
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
  const { snapshot, player, toWorld, heldAim, trapId, assist, target } = request;
  const { gameplay } = snapshot;
  const toTarget =
    target === null || !assist.autoAim ? null : { x: target.x - player.x, y: target.y - player.y };
  const aim =
    toTarget !== null && length(toTarget) > 0
      ? normalize(toTarget)
      : aimOf(snapshot, player, toWorld, heldAim);
  const actions: PlayerAction[] = [];
  if (request.placeTrap) {
    const { x, y } = request.trapScreen === null ? player : toWorld(request.trapScreen);
    actions.push(
      trapId === undefined
        ? { type: 'takeTrap', x, y }
        : { type: 'placeTrap', trapId, x, y, dx: aim.x, dy: aim.y },
    );
  }
  if (request.upgradeId !== null) {
    actions.push({ type: 'chooseUpgrade', upgradeId: request.upgradeId });
  }
  return {
    playerId: player.id,
    input: {
      move: gameplay.move,
      aim,
      fire: gameplay.fire || (assist.autoFire && target !== null),
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
  private readonly handSize: number;

  // The first aim, before any input, should point away from the scene, where the bad vibes come
  // from and where a trap placed in front of the player fits.
  constructor(handSize: number, initialAim: Vec2) {
    this.handSize = handSize;
    this.heldAim = initialAim;
  }

  frame(snapshot: InputSnapshot): void {
    const { gameplay } = snapshot;
    this.trapIndex = selectTrap(this.trapIndex, this.handSize, gameplay, this.previousGameplay);
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

  // `reach`: how far the player's attack flies now, for the assist.
  command(
    player: Body,
    toWorld: ScreenToWorld,
    enemies: readonly Target[],
    reach: number,
    chosen: Assist = NO_ASSIST,
  ): PlayerCommand {
    if (this.snapshot === null) {
      return { playerId: player.id, input: IDLE_INPUT, actions: [] };
    }
    const assist = this.snapshot.device === 'touch' ? TOUCH_ASSIST : chosen;
    const command = buildCommand({
      snapshot: this.snapshot,
      player,
      toWorld,
      heldAim: this.heldAim,
      trapId: player.hand?.[heldSlot(this.trapIndex, player.hand.length)]?.trapId,
      placeTrap: this.placeTrap,
      upgradeId: this.upgradeId,
      assist,
      target: assist.autoFire || assist.autoAim ? autoTarget(player, enemies, reach) : null,
      trapScreen: this.trapScreen,
    });
    this.placeTrap = false;
    this.trapScreen = null;
    this.upgradeId = null;
    return command;
  }
}
