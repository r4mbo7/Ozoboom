import type { GameContent } from '../data/types';
import type { DeviceId, InputSnapshot } from '../input/intents';
import type { CommandSource } from '../net/types';
import type { CameraFocus } from '../render/types';
import { length, normalize } from '../shared/vec';
import { IDLE_INPUT } from '../sim/commands';
import { setOf } from '../sim/lineup';
import type { PlayerSlot } from '../sim/initial-state';
import type { PlayerId, PlayerState } from '../sim/state';
import { statValue } from '../sim/stats';
import type { LocalPlayer } from '../ui';
import { type Assist, Controls, type ScreenToWorld } from './controls';
import { createSession, type Session } from './session';

// What the hub saw this frame. A local player reads the snapshot of their device, or the merged
// view when they have none (a solo game, or a guest online: the one screen is theirs alone).
export interface InputView {
  readonly devices: ReadonlyMap<DeviceId, InputSnapshot>;
  readonly merged: InputSnapshot;
}

export interface MatchOptions {
  readonly seed: number;
  readonly setId: string;
  readonly content: GameContent;
  readonly slots: readonly PlayerSlot[];
  // The players of this screen and what drives them. The others come from the source.
  readonly locals: ReadonlyMap<PlayerId, DeviceId | null>;
  readonly source: CommandSource;
  readonly focus: CameraFocus;
  // What the game does by itself for the players of this screen, read at every step.
  readonly assist?: () => Assist;
}

export interface MatchSeat {
  readonly playerId: PlayerId;
  readonly name: string | null;
  readonly classId: string;
  // `null`: the merged view, or a player played from afar.
  readonly device: DeviceId | null;
  readonly local: boolean;
}

export interface Match {
  readonly session: Session;
  readonly source: CommandSource;
  readonly focus: CameraFocus;
  readonly seats: readonly MatchSeat[];
  // The local players with the snapshot each one played this frame, as the interface wants them.
  readonly players: readonly LocalPlayer[];
  // Once per rendered frame, before its steps.
  frame(view: InputView): void;
  chooseUpgrade(playerId: PlayerId, upgradeId: string): void;
  // One tick: local commands through the source, then the sim. False when the source has nothing
  // yet and the sim must wait.
  step(toWorld: ScreenToWorld): boolean;
  close(): void;
}

const IDLE_GAMEPLAY = {
  ...IDLE_INPUT,
  placeTrap: false,
  nextTrap: false,
  previousTrap: false,
  selectTrap: null,
  pause: false,
} as const;

const NO_MENU = {
  up: false,
  down: false,
  left: false,
  right: false,
  confirm: false,
  back: false,
} as const;

export const IDLE_SNAPSHOT: InputSnapshot = {
  device: 'none',
  gameplay: IDLE_GAMEPLAY,
  menu: NO_MENU,
  pointerScreen: null,
  aimFromPointer: false,
};

// The press that pauses or resumes, and any press during the pause, acts on nothing else: the A
// that resumes must not place a trap. Movement is kept, as it always was.
export function withoutPresses(snapshot: InputSnapshot): InputSnapshot {
  return {
    ...snapshot,
    gameplay: {
      ...snapshot.gameplay,
      fire: false,
      skill: false,
      placeTrap: false,
      nextTrap: false,
      previousTrap: false,
      selectTrap: null,
      pause: false,
    },
    menu: NO_MENU,
  };
}

export function withoutPressesView(view: InputView): InputView {
  return {
    merged: withoutPresses(view.merged),
    devices: new Map(
      [...view.devices].map(([device, snapshot]) => [device, withoutPresses(snapshot)]),
    ),
  };
}

export function createMatch(options: MatchOptions): Match {
  const { content, slots, locals, source } = options;
  const session = createSession({
    seed: options.seed,
    players: slots,
    setId: options.setId,
    content,
  });
  const controls = new Map<PlayerId, Controls>();
  const { handSize } = setOf(content, options.setId);
  for (const playerId of locals.keys()) {
    controls.set(playerId, new Controls(handSize, outwardAim(session, playerId)));
  }
  const seats: MatchSeat[] = slots.map((slot) => ({
    playerId: slot.id,
    name: slot.name ?? null,
    classId: slot.classId,
    device: locals.get(slot.id) ?? null,
    local: locals.has(slot.id),
  }));
  let players: LocalPlayer[] = [];

  return {
    session,
    source,
    focus: options.focus,
    seats,
    get players() {
      return players;
    },
    frame(view) {
      players = [];
      for (const [playerId, device] of locals) {
        // A controller unplugged mid-game reads as idle: the player waits for it to come back.
        const snapshot =
          device === null ? view.merged : (view.devices.get(device) ?? IDLE_SNAPSHOT);
        controls.get(playerId)?.frame(snapshot);
        players.push({ playerId, snapshot });
      }
    },
    chooseUpgrade(playerId, upgradeId) {
      controls.get(playerId)?.chooseUpgrade(upgradeId);
    },
    step(toWorld) {
      const commands = source.next(
        [...controls].map(([playerId, own]) => {
          const player = session.state.players.find((candidate) => candidate.id === playerId);
          if (player === undefined) {
            throw new Error(`The game has no player ${String(playerId)}`);
          }
          return own.command(
            player,
            toWorld,
            session.state.enemies,
            reachOf(content, player),
            options.assist?.(),
          );
        }),
      );
      if (commands === null) {
        return false;
      }
      session.step(commands);
      source.stepped(session.state);
      return true;
    },
    close() {
      source.close();
    },
  };
}

// The first aim, before any input, points away from the scene, where the bad vibes come from and
// where a trap placed in front of the player fits.
function outwardAim({ state }: Session, playerId: PlayerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const outward =
    player === undefined
      ? null
      : normalize({ x: player.x - state.core.x, y: player.y - state.core.y });
  return outward !== null && length(outward) > 0 ? outward : IDLE_INPUT.aim;
}

// How far the attack of the player flies, with their upgrades, as the sim fires it.
function reachOf(content: GameContent, player: PlayerState): number {
  const attack = content.classes.find((definition) => definition.id === player.classId)?.attack;
  return attack === undefined
    ? 0
    : statValue(player, 'projectileSpeedMul', attack.projectileSpeed) * attack.rangeTicks;
}
