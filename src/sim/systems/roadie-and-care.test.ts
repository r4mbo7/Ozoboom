import { describe, expect, it } from 'vitest';
import { distanceSquared } from '../../shared/vec';
import type { ClassDefinition, GameContent } from '../../data/types';
import {
  EFFECTS_CONTENT,
  EFFECTS_OPTIONS,
  FIXTURE_CARER,
  commandFor,
  placeEnemy,
} from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { PlayerState, SimState } from '../state';

const [raver] = EFFECTS_CONTENT.classes;
if (raver === undefined) {
  throw new Error('expected the raver class');
}

const BRUISER: ClassDefinition = {
  ...raver,
  id: 'bruiser',
  attack: { ...raver.attack, damage: 1, knockback: 25, rangeTicks: 20 },
  skill: {
    id: 'bruiser-charge',
    name: 'Charge',
    description: 'Une charge qui attire.',
    cooldownTicks: 100,
    effect: { kind: 'dash', distance: 100, invulnerableTicks: 5, tauntRadius: 120 },
  },
  ultimate: {
    id: 'bruiser-case',
    name: 'Flight case',
    description: 'Une barrière.',
    cooldownTicks: 0,
    effect: { kind: 'barrier', hp: 30, radius: 80, durationTicks: 200 },
  },
};

const MEDIC: ClassDefinition = {
  ...FIXTURE_CARER,
  id: 'medic',
  ultimate: {
    id: 'medic-recall',
    name: 'Rappel',
    description: 'Relève et soigne.',
    cooldownTicks: 0,
    effect: { kind: 'healPulse', amount: 40, radius: 200, coreRepair: 0, revive: true },
  },
};

const CONTENT: GameContent = {
  ...EFFECTS_CONTENT,
  classes: [...EFFECTS_CONTENT.classes, BRUISER, MEDIC],
};

const SLOTS = [0, 1, 2, 3] as const;

function game(classIds: string[]): {
  simulation: Simulation;
  state: SimState;
  players: PlayerState[];
} {
  const simulation = createSimulation({
    ...EFFECTS_OPTIONS,
    content: CONTENT,
    setId: 'fast-drop',
    players: classIds.map((classId, index) => ({ id: SLOTS[index] ?? 0, classId })),
  });
  return { simulation, state: simulation.state, players: simulation.state.players };
}

function first(players: PlayerState[]): PlayerState {
  const [player] = players;
  if (player === undefined) {
    throw new Error('expected a player');
  }
  return player;
}

function reachDrop(simulation: Simulation): void {
  while (simulation.state.set.segment !== 'drop') {
    simulation.step([]);
  }
}

describe('the roadie hit', () => {
  it('pushes the bad vibe it hits away from the shot', () => {
    const { simulation, state, players } = game(['bruiser']);
    const player = first(players);
    const target = placeEnemy(state, 'grump', player.x + 30, player.y);
    target.stunTicks = 100_000;

    simulation.step([commandFor(0, { fire: true, aim: { x: 1, y: 0 } })]);
    simulation.step([]);

    expect(target.x).toBeGreaterThan(player.x + 30 + 20);
    expect(target.y).toBeCloseTo(player.y, 6);
  });

  it('leaves the bad vibe in place when the attack has no knockback', () => {
    const { simulation, state, players } = game(['raver']);
    const player = first(players);
    const target = placeEnemy(state, 'grump', player.x + 30, player.y);
    target.stunTicks = 100_000;

    simulation.step([commandFor(0, { fire: true, aim: { x: 1, y: 0 } })]);
    simulation.step([]);

    expect(target.x).toBe(player.x + 30);
  });
});

describe('the roadie charge', () => {
  it('draws the bad vibes around its arrival and says how many', () => {
    const { simulation, state, players } = game(['bruiser']);
    const player = first(players);
    const arrivalY = player.y + 100;
    const caught = placeEnemy(state, 'grump', player.x, arrivalY + 100);
    const outside = placeEnemy(state, 'grump', player.x, arrivalY + 120 + caught.radius + 1);
    const dead = placeEnemy(state, 'grump', player.x, arrivalY + 50);
    dead.hp = 0;

    simulation.step([commandFor(0, { skill: true, aim: { x: 0, y: 1 } })]);

    expect(state.events).toContainEqual({
      type: 'taunted',
      playerId: 0,
      x: player.x,
      y: arrivalY,
      radius: 120,
      count: 1,
    });
    expect(caught.target).toBe(0);
    expect(outside.target).toBe('core');
  });

  it('draws nobody and still says so when the charge lands on an empty floor', () => {
    const { simulation, state } = game(['bruiser']);

    simulation.step([commandFor(0, { skill: true, aim: { x: 0, y: 1 } })]);

    expect(state.events).toContainEqual(expect.objectContaining({ type: 'taunted', count: 0 }));
  });

  it('sends the bad vibes to the roadie instead of the other player', () => {
    const { simulation, state, players } = game(['bruiser', 'raver']);
    const [roadie, other] = players;
    if (roadie === undefined || other === undefined) {
      throw new Error('expected two players');
    }
    other.x = roadie.x + 60;
    other.y = roadie.y + 100;
    const enemy = placeEnemy(state, 'grump', other.x + 20, other.y);
    enemy.target = other.id;

    simulation.step([commandFor(0, { skill: true, aim: { x: 0, y: 1 } })]);

    expect(enemy.target).toBe(roadie.id);
  });

  it('does not taunt when the dash has no taunt radius', () => {
    const { simulation, state, players } = game(['roadie']);
    const player = first(players);
    reachDrop(simulation);
    placeEnemy(state, 'grump', player.x, player.y + 100);

    simulation.step([commandFor(0, { ultimate: true, aim: { x: 0, y: 1 } })]);

    expect(state.events.some((event) => event.type === 'taunted')).toBe(false);
  });
});

describe('the flight case', () => {
  function raised(): { simulation: Simulation; state: SimState; player: PlayerState } {
    const started = game(['bruiser']);
    reachDrop(started.simulation);
    started.simulation.step([commandFor(0, { ultimate: true })]);
    return { simulation: started.simulation, state: started.state, player: first(started.players) };
  }

  it('stops a bad vibe that walks at the roadie', () => {
    const { simulation, state, player } = raised();
    const enemy = placeEnemy(state, 'grump', player.x, player.y - 300);
    enemy.target = 0;

    for (let i = 0; i < 100; i++) {
      simulation.step([]);
    }

    const gap = Math.sqrt(distanceSquared(enemy, player));
    expect(gap).toBeGreaterThanOrEqual(80 + enemy.radius - 1e-6);
  });

  it('breaks after hp worth of blows and says so once', () => {
    const { simulation, state, player } = raised();
    const barrier = state.barriers?.[0];
    if (barrier === undefined) {
      throw new Error('expected a barrier');
    }
    const grump = placeEnemy(state, 'grump', player.x, player.y - 90);
    grump.target = 0;
    grump.damage = 10;
    const broken: unknown[] = [];

    for (let i = 0; i < 150 && state.barriers?.length === 1; i++) {
      simulation.step([]);
      broken.push(...state.events.filter((event) => event.type === 'barrierBroken'));
    }

    expect(state.barriers).toEqual([]);
    expect(broken).toEqual([{ type: 'barrierBroken', id: barrier.id, x: barrier.x, y: barrier.y }]);
    expect(barrier.hp).toBeLessThanOrEqual(0);
  });

  it('does not say it broke when it only runs out of time', () => {
    const { simulation, state } = raised();
    const events: unknown[] = [];

    for (let i = 0; i < 210; i++) {
      simulation.step([]);
      events.push(...state.events.filter((event) => event.type === 'barrierBroken'));
    }

    expect(state.barriers).toEqual([]);
    expect(events).toEqual([]);
  });
});

describe('the care recall', () => {
  function team(): {
    simulation: Simulation;
    state: SimState;
    friend: PlayerState;
    hurt: PlayerState;
  } {
    const started = game(['medic', 'raver', 'raver']);
    const [carer, friend, hurt] = started.players;
    if (carer === undefined || friend === undefined || hurt === undefined) {
      throw new Error('expected three players');
    }
    friend.x = carer.x + 100;
    friend.y = carer.y;
    hurt.x = carer.x - 100;
    hurt.y = carer.y;
    return { simulation: started.simulation, state: started.state, friend, hurt };
  }

  it('lifts a downed ally to half health and heals the others', () => {
    const { simulation, state, friend, hurt } = team();
    friend.downed = true;
    friend.hp = 0;
    hurt.hp = 30;
    reachDrop(simulation);

    simulation.step([commandFor(0, { ultimate: true })]);

    expect(friend.downed).toBe(false);
    expect(friend.hp).toBe(friend.maxHp / 2);
    expect(hurt.hp).toBe(70);
    expect(state.events).toContainEqual({ type: 'playerRevived', playerId: 1 });
    expect(state.events).toContainEqual({ type: 'playerHealed', playerId: 2, amount: 40 });
  });

  it('leaves a downed ally out of reach on the floor', () => {
    const { simulation, friend } = team();
    friend.downed = true;
    friend.hp = 0;
    friend.x += 400;
    reachDrop(simulation);

    simulation.step([commandFor(0, { ultimate: true })]);

    expect(friend.downed).toBe(true);
  });

  it('does not revive with a heal pulse that has no revive', () => {
    const { simulation, friend } = team();
    friend.downed = true;
    friend.hp = 0;

    simulation.step([commandFor(0, { skill: true })]);

    expect(friend.downed).toBe(true);
  });
});

describe('heal events', () => {
  it('reports the amount actually healed, not the amount offered', () => {
    const { simulation, state, players } = game(['medic', 'raver']);
    const [carer, friend] = players;
    if (carer === undefined || friend === undefined) {
      throw new Error('expected two players');
    }
    friend.x = carer.x + 50;
    friend.y = carer.y;
    friend.hp = friend.maxHp - 12;
    carer.hp = carer.maxHp;

    simulation.step([commandFor(0, { skill: true })]);

    expect(state.events.filter((event) => event.type === 'playerHealed')).toEqual([
      { type: 'playerHealed', playerId: 1, amount: 12 },
    ]);
  });
});
