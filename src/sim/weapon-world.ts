import type { EnemyDefinition, GameContent } from '../data/types';
import { unitFromAngle } from '../shared/angle';
import { TICKS_PER_BAR } from '../shared/tempo';
import { setTempo } from './lineup';
import { IDLE_INPUT, type PlayerInput } from './commands';
import { type Simulation, createSimulation } from './index';
import type { PlayerId, PlayerState, SimState } from './state';
import { spawnEnemy } from './systems/spawning';

export interface WeaponWorld {
  readonly state: SimState;
  readonly ticksPerBar: number;
  step(): void;
}

const BAD_VIBES = 5;
const ENTRY = { x: 190, y: 110 };
const STRAY = 420;
const TOUCH = 34;
const GOLDEN_ANGLE = 2.399963;
// A weapon that leaves a trail needs a ride.
const LOOP_BARS = 2;
// The view of a card follows player 0, else the stage: a trap world has no player 0, and lifts its
// stage between the player and the trap above the head, so that both stay in view.
const TRAP_PLAYER = 1;
const TRAP_LIFT = 20;

export function createWeaponWorld(
  content: GameContent,
  setId: string,
  classId: string,
  weaponId: string,
): WeaponWorld {
  const { simulation, state, player, set, ticksPerBar } = bareStage(content, setId, classId, 0);
  player.weapons = [{ id: weaponId, level: 1, phase: 0 }];
  const rides = content.weapons?.find((weapon) => weapon.id === weaponId)?.effect.kind === 'trail';
  // One that keeps its distance or has a special would not show what the weapon does up close.
  const walksUp = (enemy: EnemyDefinition) =>
    enemy.behaviour !== 'boss' && enemy.ranged === undefined && enemy.special === undefined;
  const ofStage = (set?.tiers[0]?.spawns ?? []).map((rule) =>
    content.enemies.find((enemy) => enemy.id === rule.enemyId),
  );
  const definition = [...ofStage, ...content.enemies].find(
    (enemy) => enemy !== undefined && walksUp(enemy),
  );
  if (definition === undefined) {
    throw new Error(`a weapon world of set "${setId}" without a bad vibe`);
  }
  let entered = 0;
  const loopTicks = LOOP_BARS * ticksPerBar;

  return {
    state,
    ticksPerBar,
    step() {
      const input = rides
        ? {
            ...IDLE_INPUT,
            move: unitFromAngle(((state.tick % loopTicks) / loopTicks) * 2 * Math.PI),
          }
        : IDLE_INPUT;
      stepWhole(simulation, player, input);
      state.enemies = state.enemies.filter((enemy) => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const near = dx * dx + dy * dy;
        // Pops, so that none hides what the weapon does there.
        if (near < TOUCH * TOUCH) {
          enemy.hp = 0;
        }
        return !enemy.isBoss && near < STRAY * STRAY;
      });
      while (state.enemies.length < BAD_VIBES) {
        const toward = unitFromAngle(entered * GOLDEN_ANGLE);
        entered += 1;
        const enemy = spawnEnemy(
          state,
          definition,
          player.x + toward.x * ENTRY.x,
          player.y + toward.y * ENTRY.y,
          false,
        );
        enemy.target = player.id;
      }
    },
  };
}

// The player on the stage floor with a trap above the head, nothing else: for a card that gives
// one. Given several, the trap above the head turns to the next on each beat.
export function createTrapWorld(
  content: GameContent,
  setId: string,
  classId: string,
  traps: readonly string[],
): WeaponWorld {
  const [first] = traps;
  if (first === undefined) {
    throw new Error('a trap world without a trap');
  }
  const { simulation, state, player, ticksPerBar } = bareStage(
    content,
    setId,
    classId,
    TRAP_PLAYER,
  );
  const carry = (kind: string) => {
    player.carriedTrap = { id: state.nextEntityId, kind, intensity: 1 };
    state.nextEntityId += 1;
  };
  carry(first);
  let shown = 0;

  return {
    state,
    ticksPerBar,
    step() {
      stepWhole(simulation, player, IDLE_INPUT);
      state.core.y = player.y - TRAP_LIFT;
      state.enemies = [];
      if (traps.length > 1 && state.events.some((event) => event.type === 'beat')) {
        shown = (shown + 1) % traps.length;
        carry(traps[shown] ?? first);
      } else if (player.carriedTrap !== undefined) {
        player.carriedTrap.intensity = 1;
      }
    },
  };
}

// The set without its obstacles, speakers or traps, and its player alone.
function bareStage(content: GameContent, setId: string, classId: string, playerId: PlayerId) {
  // Nothing stands between the bad vibes and the player, and no aura or trap acts on them.
  const sets = content.sets.map((candidate) =>
    candidate.id === setId ? { ...candidate, obstacles: [], speakers: [] } : candidate,
  );
  const simulation = createSimulation({
    seed: 1,
    players: [{ id: playerId, classId }],
    setId,
    content: { ...content, sets },
  });
  const { state } = simulation;
  state.traps = [];
  const player = state.players[0];
  if (player === undefined) {
    throw new Error(`a card world of set "${setId}" without its player`);
  }
  const set = content.sets.find((candidate) => candidate.id === setId);
  const ticksPerBar = set === undefined ? TICKS_PER_BAR : setTempo(set).ticksPerBar;
  return { simulation, state, player, set, ticksPerBar };
}

// One step, the player and the stage kept whole, nothing picked up.
function stepWhole(simulation: Simulation, player: PlayerState, input: PlayerInput): void {
  const { state } = simulation;
  // The stage, never drawn here, stands under the player, so the bad vibes come at them.
  state.core.x = player.x;
  state.core.y = player.y;
  state.core.radius = player.radius;
  simulation.step([{ playerId: player.id, input, actions: [] }]);
  player.hp = player.maxHp;
  player.vibes = 0;
  state.core.hp = state.core.maxHp;
  state.pickups = [];
}
