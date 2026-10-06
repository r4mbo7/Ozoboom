import { describe, expect, it } from 'vitest';
import type { ClassDefinition, GameContent } from '../../data/types';
import { EFFECTS_CONTENT, EFFECTS_OPTIONS, commandFor, placeEnemy } from '../fixtures';
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
};

const CONTENT: GameContent = {
  ...EFFECTS_CONTENT,
  classes: [...EFFECTS_CONTENT.classes, BRUISER],
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
    placeEnemy(state, 'grump', player.x, player.y + 100);

    simulation.step([commandFor(0, { skill: true, aim: { x: 0, y: 1 } })]);

    expect(state.events.some((event) => event.type === 'taunted')).toBe(false);
  });
});

describe('the care heal', () => {
  it('leaves a downed ally on the floor', () => {
    const { simulation, players } = game(['carer', 'raver']);
    const [carer, friend] = players;
    if (carer === undefined || friend === undefined) {
      throw new Error('expected two players');
    }
    friend.x = carer.x + 100;
    friend.y = carer.y;
    friend.downed = true;
    friend.hp = 0;

    simulation.step([commandFor(0, { skill: true })]);

    expect(friend.downed).toBe(true);
  });
});

describe('heal events', () => {
  it('reports the amount actually healed, not the amount offered', () => {
    const { simulation, state, players } = game(['carer', 'raver']);
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
