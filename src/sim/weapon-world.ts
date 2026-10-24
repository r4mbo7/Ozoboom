import type { EnemyDefinition, GameContent } from '../data/types';
import { unitFromAngle } from '../shared/angle';
import { TICKS_PER_BAR } from '../shared/tempo';
import { setTempo } from './lineup';
import { IDLE_INPUT } from './commands';
import { createSimulation } from './index';
import type { SimState } from './state';
import { spawnEnemy } from './systems/spawning';

// A small world where one player shows a circus weapon to a few bad vibes, by the rules of the
// game: the scene on the card of the weapon. It never ends, and nobody levels up in it.
export interface WeaponWorld {
  readonly state: SimState;
  // A bar of its stage, whose tempo it plays at.
  readonly ticksPerBar: number;
  step(): void;
}

const BAD_VIBES = 5;
// Where a bad vibe comes in, on an ellipse the shape of a card, and how far it may stray before it
// leaves the scene.
const ENTRY = { x: 190, y: 110 };
const STRAY = 420;
const TOUCH = 34;
const GOLDEN_ANGLE = 2.399963;
// A weapon that leaves a trail needs a ride: the player rides a slow loop, once every two bars.
const LOOP_BARS = 2;

export function createWeaponWorld(
  content: GameContent,
  setId: string,
  classId: string,
  weaponId: string,
): WeaponWorld {
  // The stage of the card, its tempo and its bad vibes, without obstacles nor speakers: nothing stands
  // between the bad vibes and the player, and no aura acts on them.
  const sets = content.sets.map((candidate) =>
    candidate.id === setId ? { ...candidate, obstacles: [], speakers: [] } : candidate,
  );
  const simulation = createSimulation({
    seed: 1,
    players: [{ id: 0, classId }],
    setId,
    content: { ...content, sets },
  });
  const { state } = simulation;
  const player = state.players[0];
  if (player === undefined) {
    throw new Error('a weapon world without its player');
  }
  player.weapons = [{ id: weaponId, level: 1, phase: 0 }];
  const rides = content.weapons?.find((weapon) => weapon.id === weaponId)?.effect.kind === 'trail';
  const set = content.sets.find((candidate) => candidate.id === setId);
  // A bad vibe of the stage that walks up to the player: one that keeps its distance to throw, or
  // does something of its own, would not show what the weapon does to those that come close.
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
  const ticksPerBar = set === undefined ? TICKS_PER_BAR : setTempo(set).ticksPerBar;
  const loopTicks = LOOP_BARS * ticksPerBar;

  return {
    state,
    ticksPerBar,
    step() {
      // The stage, never drawn here, stands under the player: the bad vibes it calls come at them.
      state.core.x = player.x;
      state.core.y = player.y;
      state.core.radius = player.radius;
      const input = rides
        ? {
            ...IDLE_INPUT,
            move: unitFromAngle(((state.tick % loopTicks) / loopTicks) * 2 * Math.PI),
          }
        : IDLE_INPUT;
      simulation.step([{ playerId: player.id, input, actions: [] }]);
      player.hp = player.maxHp;
      player.vibes = 0;
      state.core.hp = state.core.maxHp;
      state.pickups = [];
      state.enemies = state.enemies.filter((enemy) => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const near = dx * dx + dy * dy;
        // A bad vibe that reaches the player pops, so that none hides what the weapon does there.
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
