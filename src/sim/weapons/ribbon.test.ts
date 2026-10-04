import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { resolveContent } from '../content';
import { hurtEnemy, markedDamageMul } from '../effects';
import { COMBAT_CONTENT, FIXTURE_LURE, actionsFor, commandFor } from '../fixtures';
import type { Simulation } from '../index';
import type { EnemyState } from '../state';
import { armedArena, stand, stepTo, thrownWeapon } from './thrown.test-support';

const BACKBEATS = [2, 6, 10, 14];
const MARKED_TICKS = 20;
const LURE_MUL = markedDamageMul(resolveContent(COMBAT_CONTENT));

function ribbonArena(markedTicks = MARKED_TICKS, length = 200) {
  const { simulation } = armedArena(
    thrownWeapon('ribbon', { kind: 'ribbon', length, markedTicks }, BACKBEATS),
  );
  simulation.state.core.watts = 1000;
  return { simulation };
}

function placeLure(simulation: Simulation, x: number, y: number): void {
  simulation.step([
    actionsFor(0, { type: 'placeTrap', trapId: FIXTURE_LURE.id, x, y, dx: 1, dy: 0 }),
  ]);
}

function moveTo(enemy: EnemyState, y: number): void {
  enemy.y = y;
  enemy.prevY = y;
}

function firedTicks(simulation: Simulation, until: number): number[] {
  const ticks: number[] = [];
  while (simulation.state.tick < until) {
    simulation.step([]);
    if (simulation.state.events.some((event) => event.type === 'weaponFired')) {
      ticks.push(simulation.state.tick);
    }
  }
  return ticks;
}

function damageTaken(simulation: Simulation, enemy: EnemyState): number {
  const before = enemy.hp;
  hurtEnemy(simulation.state, enemy, 10, LURE_MUL, 0);
  const dealt = before - enemy.hp;
  enemy.hp = before;
  return dealt;
}

describe('ribbon', () => {
  it('fires on the sixteenths 2, 6, 10 and 14 only', () => {
    const { simulation } = ribbonArena();

    expect(firedTicks(simulation, TICKS_PER_BAR)).toEqual([6, 18, 30, 42]);
  });

  it('marks the bad vibes along the aim, within its length, and no others', () => {
    const { simulation } = ribbonArena(MARKED_TICKS, 200);
    const ahead = stand(simulation, 550, 400);
    const tooFar = stand(simulation, 700, 400);
    const beside = stand(simulation, 500, 480);
    const behind = stand(simulation, 300, 400);

    stepTo(simulation, 6);

    expect([ahead, tooFar, beside, behind].map((enemy) => enemy.marked)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('follows the aim of the player', () => {
    const { simulation } = ribbonArena();
    const above = stand(simulation, 400, 300);
    const right = stand(simulation, 500, 400);

    while (simulation.state.tick < 6) {
      simulation.step([commandFor(0, { aim: { x: 0, y: -1 } })]);
    }

    expect([above.marked, right.marked]).toEqual([true, false]);
  });

  it('makes a marked bad vibe take the bonus damage for markedTicks, then no more', () => {
    const { simulation } = ribbonArena(MARKED_TICKS);
    const enemy = stand(simulation, 500, 400);
    stepTo(simulation, 6);
    moveTo(enemy, 300);
    const atFirst = damageTaken(simulation, enemy);
    stepTo(simulation, 6 + MARKED_TICKS - 1);
    const atLast = damageTaken(simulation, enemy);
    stepTo(simulation, 6 + MARKED_TICKS);

    expect([atFirst, atLast, damageTaken(simulation, enemy)]).toEqual([
      10 * LURE_MUL,
      10 * LURE_MUL,
      10,
    ]);
  });

  it('keeps a lure mark once its own mark has lapsed', () => {
    const { simulation } = ribbonArena(3);
    const enemy = stand(simulation, 500, 400);
    placeLure(simulation, 500, 300);

    stepTo(simulation, 6);
    const whileBoth = enemy.marked;
    stepTo(simulation, 9);
    const afterRibbon = enemy.marked;
    stepTo(simulation, 17);

    expect([whileBoth, afterRibbon, enemy.marked]).toEqual([true, true, true]);
  });

  it('keeps its own mark when the lure is gone', () => {
    const { simulation } = ribbonArena(MARKED_TICKS);
    const enemy = stand(simulation, 500, 400);
    placeLure(simulation, 500, 300);
    stepTo(simulation, 6);
    moveTo(enemy, 330);
    simulation.state.traps.length = 0;

    stepTo(simulation, 6 + MARKED_TICKS - 1);

    expect(enemy.marked).toBe(true);
  });

  it('lets a lure mark lapse once the lure no longer reaches the bad vibe', () => {
    const { simulation } = ribbonArena();
    const enemy = stand(simulation, 500, 450);
    placeLure(simulation, 500, 400);
    simulation.step([]);
    const marked = enemy.marked;
    moveTo(enemy, 900);

    stepTo(simulation, 5);

    expect([marked, enemy.marked]).toEqual([true, false]);
  });

  it('crosses the whole arena on the drop when its data says so', () => {
    const { simulation } = armedArena(
      thrownWeapon(
        'rainbow',
        { kind: 'ribbon', length: 100, markedTicks: 20, dropCrossesArena: true },
        BACKBEATS,
      ),
    );
    const far = stand(simulation, 900, 400);

    stepTo(simulation, 6);
    const buildup = far.marked;
    simulation.state.set.segment = 'drop';
    stepTo(simulation, 18);

    expect([buildup, far.marked]).toEqual([false, true]);
  });
});
