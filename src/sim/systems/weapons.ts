import type { WeaponEffect, WeaponRhythm } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { normalize } from '../../shared/vec';
import { compound } from '../effects';
import type { EnemyState, PlayerState } from '../state';
import { boomerang } from '../weapons/boomerang';
import { hoop } from '../weapons/hoop';
import { lob } from '../weapons/lob';
import { orbit } from '../weapons/orbit';
import { plate } from '../weapons/plate';
import { ribbon } from '../weapons/ribbon';
import { spark } from '../weapons/spark';
import { sweep } from '../weapons/sweep';
import { totem } from '../weapons/totem';
import { directionTo } from '../weapons/shoot';
import { trail } from '../weapons/trail';
import type { WeaponModule } from '../weapons/types';
import type { StepContext } from './types';

const TICKS_PER_SIXTEENTH = 3;
const INITIAL_REACH = 128;

// One module per effect kind; an issue replaces its own module and touches this registry only on
// its line (docs/plans/v0.1.md). All inert until then.
export const WEAPONS: Readonly<Record<WeaponEffect['kind'], WeaponModule>> = {
  sweep,
  spark,
  hoop,
  lob,
  boomerang,
  plate,
  totem,
  orbit,
  trail,
  ribbon,
};

export function firesOnTick(rhythm: WeaponRhythm, tick: number): boolean {
  if (rhythm === 'continuous') {
    return true;
  }
  const inPeriod = tick % (rhythm.everyBars * TICKS_PER_BAR);
  return (
    inPeriod % TICKS_PER_SIXTEENTH === 0 && rhythm.steps.includes(inPeriod / TICKS_PER_SIXTEENTH)
  );
}

export function weapons(ctx: StepContext): void {
  const { state, content } = ctx;
  for (const player of state.players) {
    if (player.downed) {
      continue;
    }
    for (const slot of player.weapons ?? []) {
      const definition = content.weapons.get(slot.id);
      if (definition === undefined || !firesOnTick(definition.rhythm, state.tick)) {
        continue;
      }
      const target = closestEnemy(ctx, player);
      const aim = normalize(player.aim);
      const shot = {
        power: compound(definition.levelMul, slot.level - 1),
        target,
        direction: target === null ? aim : directionTo(player, target, aim),
      };
      WEAPONS[definition.effect.kind].fire(ctx, player, slot, definition, shot);
      state.events.push({
        type: 'weaponFired',
        playerId: player.id,
        weaponId: slot.id,
        x: player.x,
        y: player.y,
        dx: shot.direction.x,
        dy: shot.direction.y,
      });
    }
  }
}

// The grid is rebuilt here, not read from an earlier system: deaths compact the enemy list.
function closestEnemy(
  { state, enemyGrid, set }: StepContext,
  player: PlayerState,
): EnemyState | null {
  if (state.enemies.length === 0) {
    return null;
  }
  enemyGrid.rebuild(state.enemies);
  const farthest = Math.sqrt(
    set.arena.width * set.arena.width + set.arena.height * set.arena.height,
  );
  for (let reach = INITIAL_REACH; ; reach *= 2) {
    const found = enemyGrid.query(player.x, player.y, reach);
    let closest: EnemyState | null = null;
    let closestDistance = Infinity;
    for (let i = 0; i < found; i++) {
      const enemy = state.enemies[enemyGrid.result(i)];
      if (enemy === undefined) {
        continue;
      }
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < closestDistance) {
        closest = enemy;
        closestDistance = distanceSquared;
      }
    }
    if (closest !== null && closestDistance <= reach * reach) {
      return closest;
    }
    if (reach > farthest) {
      return closest;
    }
  }
}
