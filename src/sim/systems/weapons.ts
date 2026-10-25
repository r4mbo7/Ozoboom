import type { WeaponEffect, WeaponRhythm } from '../../data/types';
import { MAIN_TEMPO, type Tempo } from '../../shared/tempo';
import { normalize } from '../../shared/vec';
import { blackedOut } from '../blackout';
import { compound } from '../effects';
import type { EnemyState, PlayerState, WeaponSlot } from '../state';
import { statValue } from '../stats';
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

const INITIAL_REACH = 128;

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

export function firesOnTick(
  rhythm: WeaponRhythm,
  tick: number,
  tempo: Tempo = MAIN_TEMPO,
): boolean {
  if (rhythm === 'continuous') {
    return true;
  }
  return stepOn(rhythm, tick, tempo) !== undefined;
}

// A sixteenth is not a whole number of ticks on every stage.
function sixteenthTick(step: number, tempo: Tempo): number {
  return Math.floor((step * tempo.ticksPerBeat) / 4);
}

function ticksIntoPeriod(
  rhythm: Exclude<WeaponRhythm, 'continuous'>,
  tick: number,
  tempo: Tempo,
): number {
  const period = rhythm.everyBars * tempo.ticksPerBar;
  return (((tick - tempo.originTick) % period) + period) % period;
}

function stepOn(
  rhythm: Exclude<WeaponRhythm, 'continuous'>,
  tick: number,
  tempo: Tempo,
): number | undefined {
  const inPeriod = ticksIntoPeriod(rhythm, tick, tempo);
  for (const step of rhythm.steps) {
    if (sixteenthTick(step, tempo) === inPeriod) {
      return step;
    }
  }
  return undefined;
}

// A gathered whole shot slips in on the next free sixteenth of the rhythm, so it stays on the grid.
function gatherGhost(
  slot: WeaponSlot,
  rhythm: WeaponRhythm,
  rate: number,
  tick: number,
  tempo: Tempo,
): void {
  if (rhythm === 'continuous' || rate <= 1) {
    return;
  }
  const share = Math.min(1, (slot.ghostShare ?? 0) + rate - 1);
  const pending = slot.ghostTick !== undefined && slot.ghostTick > tick;
  const ghostTick = share >= 1 && !pending ? nextFreeTick(rhythm, tick, tempo) : undefined;
  if (ghostTick === undefined) {
    slot.ghostShare = share;
    return;
  }
  slot.ghostShare = share - 1;
  slot.ghostTick = ghostTick;
}

function nextFreeTick(
  rhythm: Exclude<WeaponRhythm, 'continuous'>,
  tick: number,
  tempo: Tempo,
): number | undefined {
  const sixteenths = 16 * rhythm.everyBars;
  const start = tick - ticksIntoPeriod(rhythm, tick, tempo);
  const now = stepOn(rhythm, tick, tempo) ?? 0;
  for (let step = now + 1; step < now + sixteenths; step++) {
    if (!rhythm.steps.includes(step % sixteenths)) {
      return start + sixteenthTick(step, tempo);
    }
  }
  return undefined;
}

export function weapons(ctx: StepContext): void {
  const { state, content } = ctx;
  const silent = blackedOut(state);
  for (const player of state.players) {
    if (player.downed) {
      continue;
    }
    const rate = statValue(player, 'weaponRateMul', 1);
    for (const slot of player.weapons ?? []) {
      const definition = content.weapons.get(slot.id);
      if (definition === undefined) {
        continue;
      }
      const ghost = slot.ghostTick === state.tick;
      if (ghost) {
        delete slot.ghostTick;
      }
      const due = ghost || firesOnTick(definition.rhythm, state.tick, ctx.tempo);
      if (!due || silent) {
        continue;
      }
      if (!ghost) {
        gatherGhost(slot, definition.rhythm, rate, state.tick, ctx.tempo);
      }
      const target = closestEnemy(ctx, player);
      const aim = normalize(player.aim);
      const shot = {
        power: compound(definition.levelMul, slot.level - 1),
        target,
        direction: target === null ? aim : directionTo(player, target, aim),
      };
      if (!WEAPONS[definition.effect.kind].fire(ctx, player, slot, definition, shot)) {
        continue;
      }
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
