import type { GameContent, WeaponDefinition } from '../../data/types';
import { COMBAT_CONTENT, COMBAT_OPTIONS, placeEnemy } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { EnemyState, PlayerState } from '../state';

export function thrownWeapon(
  id: string,
  effect: WeaponDefinition['effect'],
  steps: readonly number[] = [8],
): WeaponDefinition {
  return {
    id,
    name: id,
    description: id,
    rhythm: { everyBars: 1, steps },
    effect,
    maxLevel: 3,
    levelMul: 2,
  };
}

// Armed players at (400, 400) on an empty field; the weapon first fires on tick 24.
export function armedArena(
  definition: WeaponDefinition,
  playerCount = 1,
): { simulation: Simulation; players: PlayerState[] } {
  const content: GameContent = { ...COMBAT_CONTENT, weapons: [definition] };
  const simulation = createSimulation({
    ...COMBAT_OPTIONS,
    content,
    players: ([0, 1, 2, 3] as const).slice(0, playerCount).map((id) => ({ id, classId: 'raver' })),
  });
  const { players } = simulation.state;
  for (const player of players) {
    player.x = 400;
    player.y = 400;
    player.prevX = 400;
    player.prevY = 400;
  }
  const [first] = players;
  if (first === undefined) {
    throw new Error('expected a player');
  }
  first.weapons = [{ id: definition.id, level: 1, phase: 0 }];
  return { simulation, players };
}

export function stand(simulation: Simulation, x: number, y: number): EnemyState {
  const enemy = placeEnemy(simulation.state, 'grump', x, y);
  enemy.speed = 0;
  enemy.hp = 1000;
  enemy.maxHp = 1000;
  return enemy;
}

export function stepTo(simulation: Simulation, tick: number): void {
  while (simulation.state.tick < tick) {
    simulation.step([]);
  }
}
