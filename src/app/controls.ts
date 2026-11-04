import type { GameplayIntents, InputSnapshot } from '../input/intents';
import { distanceSquared, length, normalize } from '../shared/vec';
import { IDLE_INPUT, type Emote, type PlayerAction, type PlayerCommand } from '../sim/commands';
import type { EnemyState, PlayerState, Vec2 } from '../sim/state';

export type ScreenToWorld = (point: Vec2) => Vec2;
type Body = Pick<PlayerState, 'id' | 'x' | 'y' | 'radius' | 'aim'>;
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
  readonly moveTrap: boolean;
  readonly dash: boolean;
  readonly emote: Emote | null;
  readonly upgradeId: string | null;
  // Asked on the offer screen: other cards for the offer shown.
  readonly reroll?: boolean;
  readonly assist: Assist;
  readonly target: Vec2 | null;
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
  const { snapshot, player, toWorld, heldAim, assist, target } = request;
  const { gameplay } = snapshot;
  const toTarget =
    target === null || !assist.autoAim ? null : { x: target.x - player.x, y: target.y - player.y };
  const aim =
    toTarget !== null && length(toTarget) > 0
      ? normalize(toTarget)
      : aimOf(snapshot, player, toWorld, heldAim);
  const actions: PlayerAction[] = [];
  if (request.moveTrap) {
    actions.push({ type: 'moveTrap' });
  }
  if (request.dash) {
    actions.push({ type: 'dash' });
  }
  if (request.emote !== null) {
    actions.push({ type: 'emote', emote: request.emote });
  }
  if (request.reroll === true) {
    actions.push({ type: 'rerollOffer' });
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
  private moveTrap = false;
  private dash = false;
  private emote: Emote | null = null;
  private upgradeId: string | null = null;
  private reroll = false;

  constructor(initialAim: Vec2) {
    this.heldAim = initialAim;
  }

  frame(snapshot: InputSnapshot): void {
    const { gameplay } = snapshot;
    this.heldAim = nextHeldAim(this.heldAim, snapshot, this.previousGameplay);
    this.previousGameplay = gameplay;
    this.moveTrap ||= gameplay.placeTrap;
    this.dash ||= gameplay.dash;
    this.emote = gameplay.emote ?? this.emote;
    this.snapshot = snapshot;
  }

  chooseUpgrade(upgradeId: string): void {
    this.upgradeId = upgradeId;
  }

  rerollOffer(): void {
    this.reroll = true;
  }

  command(
    player: Body,
    toWorld: ScreenToWorld,
    enemies: readonly Target[],
    attackReach: number,
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
      moveTrap: this.moveTrap,
      dash: this.dash,
      emote: this.emote,
      upgradeId: this.upgradeId,
      reroll: this.reroll,
      assist,
      target:
        assist.autoFire || assist.autoAim ? nearestInReach(player, enemies, attackReach) : null,
    });
    this.moveTrap = false;
    this.dash = false;
    this.emote = null;
    this.upgradeId = null;
    this.reroll = false;
    return command;
  }
}
