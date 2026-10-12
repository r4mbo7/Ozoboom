import { describe, expect, it } from 'vitest';
import { SPARK_GAP_TICKS, SPARKS_PER_TICK, SparkBudget, contactOf } from './hit-marks';

const HIT = { type: 'enemyHit', id: 7, damage: 4, x: 100, y: 50 } as const;

describe('contactOf', () => {
  it('lands on the edge of the bad vibe, on the side the hit came from', () => {
    const hit = { ...HIT, fromX: 40, fromY: 50 };

    const contact = contactOf(hit, 12);

    expect(contact?.x).toBeCloseTo(88);
    expect(contact?.y).toBeCloseTo(50);
    expect(contact?.angle).toBeCloseTo(Math.PI);
  });

  it('has no side for a hit that comes from nowhere, or from the bad vibe itself', () => {
    const fromItself = { ...HIT, fromX: 100, fromY: 50 };

    const contacts = [contactOf(HIT, 12), contactOf(fromItself, 12)];

    expect(contacts).toEqual([undefined, undefined]);
  });
});

describe('SparkBudget', () => {
  it('lets a bad vibe hit every tick spark again only once the gap has passed', () => {
    const budget = new SparkBudget();

    const lit = Array.from({ length: SPARK_GAP_TICKS + 1 }, (_, tick) => budget.tryStart(7, tick));

    expect(lit).toEqual([true, ...Array<boolean>(SPARK_GAP_TICKS - 1).fill(false), true]);
  });

  it('lights a handful of bad vibes at most in one step, and starts over on the next', () => {
    const budget = new SparkBudget();

    const sameStep = Array.from({ length: SPARKS_PER_TICK + 1 }, (_, id) => budget.tryStart(id, 3));
    const nextStep = budget.tryStart(SPARKS_PER_TICK, 4);

    expect(sameStep).toEqual([...Array<boolean>(SPARKS_PER_TICK).fill(true), false]);
    expect(nextStep).toBe(true);
  });

  it('forgets everything when cleared', () => {
    const budget = new SparkBudget();
    budget.tryStart(7, 100);

    budget.clear();

    expect(budget.tryStart(7, 0)).toBe(true);
  });
});
