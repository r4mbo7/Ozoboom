import { BEATS_PER_BAR, type Tempo } from '../shared/tempo';
import { normalize } from '../shared/vec';
import type { EntityId, PlayerId, SimState, Vec2 } from '../sim/state';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { mixColor } from './palette';
import type { KeyTrap } from './types';
import { byId } from './util';

// The answer and the second step fade in and out over this many beats.
const FADE_BEATS = 0.5;
// The key and the ghost show once a player's key has pointed at the same trap this long.
const HELD_BEATS = 2 * BEATS_PER_BAR;

// A trap answering a player: `level` fades its answer in and out; `swap` crossfades its colour from
// `from` to `playerId` when another player takes it over.
export interface TrapAnswer {
  readonly playerId: PlayerId;
  readonly from: PlayerId;
  readonly swap: number;
  readonly level: number;
}

// The second step for a player: the key beside the trap and its ghost above the head.
export interface HeldAnswer {
  readonly trapId: EntityId;
  readonly key: string;
  readonly level: number;
}

// What the options hold: absent where nothing tells which trap a key would take, as in portraits.
type KeyTraps = readonly KeyTrap[] | undefined;

interface Aim {
  readonly trapId: EntityId;
  readonly since: number;
  key: string;
}

interface Owner {
  playerId: PlayerId;
  from: PlayerId;
  swap: number;
  level: number;
}

interface Held {
  readonly trapId: EntityId;
  key: string;
  level: number;
}

interface Clock {
  readonly now: number;
  readonly tempo: Pick<Tempo, 'ticksPerBeat'>;
}

// The traps that answer the player whose place key would take them, shared by the families that
// draw it (the halo, the wave, the key, the ghost). It follows the game's ticks, frame by frame:
// the first player to reach a trap keeps it while they stay, and each player's two bars count from
// when their key first pointed at that trap.
export class TrapAnswers {
  private now = Number.NEGATIVE_INFINITY;
  private readonly aims = new Map<PlayerId, Aim>();
  private readonly owners = new Map<EntityId, Owner>();
  private readonly helds = new Map<PlayerId, Held>();
  // The players who saw the key and the ghost once in this game: they do not see them again.
  private readonly taught = new Set<PlayerId>();
  private game: object | null = null;

  answerOf(trapId: EntityId, clock: Clock, keyTraps: KeyTraps): TrapAnswer | undefined {
    this.sync(clock, keyTraps);
    return this.owners.get(trapId);
  }

  heldOf(playerId: PlayerId, clock: Clock, keyTraps: KeyTraps): HeldAnswer | undefined {
    this.sync(clock, keyTraps);
    return this.helds.get(playerId);
  }

  // A new game teaches again; a festival keeps its state from one stage to the next.
  playing(game: object): void {
    if (game !== this.game) {
      this.game = game;
      this.taught.clear();
    }
  }

  // A new game or stage starts from nothing, but a player taught in this game stays taught.
  reset(): void {
    this.aims.clear();
    this.owners.clear();
    this.helds.clear();
    this.now = Number.NEGATIVE_INFINITY;
  }

  // Frames drawn while the tick stands still, on an offer, can step back within it: nothing moves.
  private sync(clock: Clock, keyTraps: KeyTraps): void {
    const { now } = clock;
    if (now <= this.now) {
      return;
    }
    const beat = clock.tempo.ticksPerBeat;
    const step = this.now === Number.NEGATIVE_INFINITY ? 0 : (now - this.now) / (FADE_BEATS * beat);
    this.now = now;
    this.aim(keyTraps);
    this.own(step);
    this.hold(step, now - HELD_BEATS * beat);
  }

  private aim(keyTraps: KeyTraps): void {
    for (const playerId of this.aims.keys()) {
      if (!keyTraps?.some((keyTrap) => keyTrap.playerId === playerId)) {
        this.aims.delete(playerId);
      }
    }
    for (const { playerId, trapId, since, key } of keyTraps ?? []) {
      const aim = this.aims.get(playerId);
      if (aim?.trapId === trapId && aim.since === since) {
        aim.key = key;
      } else {
        this.aims.set(playerId, { trapId, since, key });
      }
    }
  }

  // The first player whose key points at the trap, by the time it started to.
  private firstAt(trapId: EntityId): PlayerId | undefined {
    let first: { playerId: PlayerId; since: number } | undefined;
    for (const [playerId, aim] of this.aims) {
      if (aim.trapId === trapId && (first === undefined || aim.since < first.since)) {
        first = { playerId, since: aim.since };
      }
    }
    return first?.playerId;
  }

  private own(step: number): void {
    for (const aim of this.aims.values()) {
      if (!this.owners.has(aim.trapId)) {
        const playerId = this.firstAt(aim.trapId);
        if (playerId !== undefined) {
          this.owners.set(aim.trapId, { playerId, from: playerId, swap: 1, level: 0 });
        }
      }
    }
    for (const [trapId, owner] of this.owners) {
      const stays = this.aims.get(owner.playerId)?.trapId === trapId;
      const next = stays ? owner.playerId : this.firstAt(trapId);
      if (next === undefined) {
        owner.level = Math.max(0, owner.level - step);
        if (owner.level === 0) {
          this.owners.delete(trapId);
        }
        continue;
      }
      if (next !== owner.playerId) {
        owner.from = owner.playerId;
        owner.playerId = next;
        owner.swap = 0;
      }
      owner.level = Math.min(1, owner.level + step);
      owner.swap = Math.min(1, owner.swap + step);
    }
  }

  // The key is shown, once a game, to the player its trap answers: another player's trap keeps
  // the lesson for later.
  private hold(step: number, heldSince: number): void {
    for (const [playerId, aim] of this.aims) {
      if (
        aim.since <= heldSince &&
        this.owners.get(aim.trapId)?.playerId === playerId &&
        !this.helds.has(playerId) &&
        !this.taught.has(playerId)
      ) {
        this.helds.set(playerId, { trapId: aim.trapId, key: aim.key, level: 0 });
        this.taught.add(playerId);
      }
    }
    for (const [playerId, held] of this.helds) {
      const aim = this.aims.get(playerId);
      if (aim?.trapId === held.trapId) {
        held.key = aim.key;
        held.level = Math.min(1, held.level + step);
        continue;
      }
      held.level = Math.max(0, held.level - step);
      if (held.level === 0) {
        this.helds.delete(playerId);
      }
    }
  }
}

// How a trap answers, as the families draw it: the colour crossfaded from the previous player's to
// the current one's, the way to that player, and how far it has faded in.
export interface AnswerLook {
  readonly color: number;
  readonly toward: Vec2;
  readonly level: number;
}

export function answerLook(
  ctx: Pick<RenderContext, 'answers' | 'classTokens' | 'options'>,
  state: Pick<SimState, 'players'>,
  trap: Vec2 & { readonly id: EntityId },
  frame: Frame,
): AnswerLook | undefined {
  const answer = ctx.answers.answerOf(trap.id, frame, ctx.options.keyTraps);
  const player = answer && byId(state.players, answer.playerId);
  if (answer === undefined || player === undefined) {
    return undefined;
  }
  const colorOf = (id: PlayerId): number => {
    const classId = byId(state.players, id)?.classId;
    return frame.palette[
      (classId === undefined ? undefined : ctx.classTokens.get(classId)) ?? 'or'
    ];
  };
  return {
    color: mixColor(colorOf(answer.from), colorOf(answer.playerId), answer.swap),
    toward: normalize({ x: player.x - trap.x, y: player.y - trap.y }),
    level: answer.level,
  };
}
