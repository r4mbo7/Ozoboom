import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../shared/tempo';
import {
  COMBAT_OPTIONS,
  commandFor,
  eventsOf,
  peaceful,
  placeEnemy,
  stepAndRecord,
  type TimedEvent,
} from './fixtures';
import { createSimulation, type Simulation } from './index';
import type { PlayerState } from './state';

function arena(): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation(COMBAT_OPTIONS);
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, player };
}

function park(player: PlayerState, x: number, y: number): void {
  player.x = x;
  player.y = y;
  player.prevX = x;
  player.prevY = y;
}

describe('combat', () => {
  it('kills an enemy shot at in ceil(maxHp / damage) hits, and its drops reach the player', () => {
    const { simulation, player } = arena();
    const { state } = simulation;
    park(player, 400, 450);
    const bouncer = placeEnemy(state, 'doorman', 600, 450);
    const recorded: TimedEvent[] = [];

    while (state.enemies.length > 0 && state.tick < 400) {
      simulation.step([commandFor(0, { aim: { x: 1, y: 0 }, fire: true })]);
      recorded.push(...eventsOf(state));
    }
    const dropped = state.pickups.map((pickup) => pickup.kind);
    while (state.pickups.length > 0 && state.tick < 800) {
      simulation.step([commandFor(0, { move: { x: 1, y: 0 } })]);
      recorded.push(...eventsOf(state));
    }

    const hits = recorded.filter(({ event }) => event.type === 'enemyHit');
    expect(hits).toHaveLength(Math.ceil(140 / 10));
    expect(recorded.filter(({ event }) => event.type === 'enemyDied')).toMatchObject([
      { tick: hits.at(-1)?.tick, event: { id: bouncer.id, byPlayer: 0 } },
    ]);
    expect(dropped).toEqual(['vibes']);
    expect(state.pickups).toEqual([]);
    expect(player.vibes).toBe(5);
    expect(state.stats).toMatchObject({ kills: 1, damageDealt: 140, vibesCollected: 5 });
    expect(recorded.filter(({ event }) => event.type === 'pickupCollected')).toHaveLength(1);
  });

  it('lets an unchallenged enemy reach the core, hurt it on its cooldown, and lose the game', () => {
    const { simulation, player } = arena();
    const { state } = simulation;
    park(player, 100, 800);
    placeEnemy(state, 'grump', state.core.x, 100);
    state.core.hp = 15;

    const recorded = stepAndRecord(simulation, 300);

    const arrival = (350 - 48 - 12) / 2.5;
    expect(
      recorded.filter(({ event }) => event.type === 'coreHit').map(({ tick }) => tick),
    ).toEqual([arrival, arrival + 24, arrival + 48]);
    expect(state.core.hp).toBe(0);
    expect(state.status).toBe('lost');
    expect(recorded.filter(({ event }) => event.type === 'gameLost')).toEqual([
      { tick: arrival + 48, event: { type: 'gameLost' } },
    ]);
  });

  it('ends the drop on the next bar once its boss is shot down', () => {
    const { simulation, player } = arena();
    const { state } = simulation;
    const dropTick = TICKS_PER_PHRASE + 2 * TICKS_PER_BAR;
    stepAndRecord(peaceful(simulation), dropTick - 1);
    simulation.step([]);
    const boss = state.enemies.find((enemy) => enemy.isBoss);
    if (boss === undefined) {
      throw new Error('expected the boss on the drop');
    }
    boss.hp = 10;
    // Far enough that the boss's vibes stay out of reach: a level up would pause the set.
    park(player, boss.x < state.core.x ? boss.x + 100 : boss.x - 100, boss.y);

    simulation.step([commandFor(0, { aim: { x: boss.x - player.x, y: 0 }, fire: true })]);
    const recorded = [...eventsOf(state), ...stepAndRecord(simulation, TICKS_PER_BAR)];

    expect(recorded.filter(({ event }) => event.type === 'enemyDied')).toMatchObject([
      { event: { id: boss.id, kind: 'curfew', byPlayer: 0 } },
    ]);
    expect(recorded.filter(({ event }) => event.type === 'segment')).toEqual([
      { tick: dropTick + TICKS_PER_BAR, event: { type: 'segment', segment: 'buildup', tier: 1 } },
    ]);
  });
});
