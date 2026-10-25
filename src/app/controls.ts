import type { GameplayIntents, InputSnapshot } from '../input/intents';
import { heldSlot, selectTrap } from '../ui';
import { distanceSquared, length, normalize } from '../shared/vec';
import {
  IDLE_INPUT,
  type Emote,
  type PlayerAction,
  type PlayerCommand,
  type PlayerInput,
} from '../sim/commands';
import type { EnemyState, PlayerState, Vec2 } from '../sim/state';

export type ScreenToWorld = (point: Vec2) => Vec2;
type Body = Pick<PlayerState, 'id' | 'x' | 'y' | 'radius' | 'aim' | 'hand'>;
export type Target = Pick<EnemyState, 'x' | 'y' | 'radius' | 'hp'>;

export interface Assist {
  readonly autoFire: boolean;
  readonly autoAim: boolean;
}

const NO_ASSIST: Assist = { autoFire: false, autoAim: false };
const TOUCH_ASSIST: Assist = { autoFire: true, autoAim: true };

export interface CommandRequest {
  readonly snapshot: InputSnapshot;
  readonly player: Body;
  readonly toWorld: ScreenToWorld;
  readonly heldAim: Vec2;
  readonly trapId: string | undefined;
  readonly placeTrap: boolean;
  readonly dash: boolean;
  readonly emote: Emote | null;
  readonly upgradeId: string | null;
  readonly assist: Assist;
  readonly target: Vec2 | null;
  // null places the trap under the player.
  readonly trapScreen: Vec2 | null;
}

function nearestInReach(player: Vec2, enemies: readonly Target[], reach: number): Target | null {
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

function aimOf(snapshot: InputSnapshot, player: Body, toWorld: ScreenToWorld, heldAim: Vec2): Vec2 {
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
  if (request.dash) {
    actions.push({ type: 'dash' });
  }
  if (request.emote !== null) {
    actions.push({ type: 'emote', emote: request.emote });
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

// The keyboard has no aiming keys: it aims where the player last moved. A change of `gameplay.aim` is the stick.
function nextHeldAim(
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

// The sim steps 0 to n times a frame: discrete intents wait for the first step, continuous ones apply to each.
export class Controls {
  private snapshot: InputSnapshot | null = null;
  private previousGameplay: GameplayIntents | null = null;
  private heldAim: Vec2;
  private placeTrap = false;
  private dash = false;
  private emote: Emote | null = null;
  private trapScreen: Vec2 | null = null;
  private upgradeId: string | null = null;
  private trapIndex = 0;
  private fireTicks = 0;
  private readonly handSize: number;

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
    this.dash ||= gameplay.dash;
    this.emote = gameplay.emote ?? this.emote;
    this.snapshot = snapshot;
  }

  chooseUpgrade(upgradeId: string): void {
    this.upgradeId = upgradeId;
  }

  command(
    player: Body,
    toWorld: ScreenToWorld,
    enemies: readonly Target[],
    attackReach: number,
    chosen: Assist = NO_ASSIST,
    chargeTicks = 0,
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
      trapId: player.hand?.[heldSlot(this.trapIndex, player.hand.length)],
      placeTrap: this.placeTrap,
      dash: this.dash,
      emote: this.emote,
      upgradeId: this.upgradeId,
      assist,
      target:
        assist.autoFire || assist.autoAim ? nearestInReach(player, enemies, attackReach) : null,
      trapScreen: this.trapScreen,
    });
    this.placeTrap = false;
    this.dash = false;
    this.emote = null;
    this.trapScreen = null;
    this.upgradeId = null;
    if (chargeTicks === 0) {
      return command;
    }
    return {
      ...command,
      input: this.charge(command.input, this.snapshot.gameplay.fire, chargeTicks),
    };
  }

  // A fire no hand holds, that of the assist, lets go at half charge.
  private charge(input: PlayerInput, pressed: boolean, chargeTicks: number): PlayerInput {
    const letGo = !pressed && this.fireTicks >= Math.ceil(chargeTicks / 2);
    this.fireTicks = input.fire && !letGo ? this.fireTicks + 1 : 0;
    return this.fireTicks === 0
      ? { ...input, fire: false }
      : { ...input, fireTicks: this.fireTicks };
  }
}
