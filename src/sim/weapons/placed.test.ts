import { describe, expect, it } from 'vitest';
import type { GameContent, WeaponDefinition } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import {
  BYSTANDER_QUIET_OPTIONS,
  FIXTURE_BYSTANDER,
  FIXTURE_CONTENT,
  FIXTURE_OPTIONS,
  commandFor,
  placeEnemy,
} from '../fixtures';
import { createSimulation, type Simulation, type SimulationOptions } from '../index';
import { hashState } from '../replay';
import type { BystanderState, EnemyState } from '../state';

const ON_BAR = { everyBars: 1, steps: [0] };

const PLATE: WeaponDefinition = {
  id: 'plate',
  name: 'plate',
  description: 'plate',
  rhythm: ON_BAR,
  effect: {
    kind: 'plate',
    slowFactor: 0.6,
    healPerBar: 4,
    radius: 70,
    durationBars: 4,
    maxPlaced: 3,
  },
  maxLevel: 5,
  levelMul: 1.5,
};

const TOTEM: WeaponDefinition = {
  id: 'totem',
  name: 'totem',
  description: 'totem',
  rhythm: ON_BAR,
  effect: { kind: 'totem', damage: 7, knockback: 40, radius: 120, durationBars: 4 },
  maxLevel: 5,
  levelMul: 1.5,
};

const UNICYCLE: WeaponDefinition = {
  id: 'unicycle',
  name: 'unicycle',
  description: 'unicycle',
  rhythm: 'continuous',
  effect: { kind: 'trail', speedMul: 1.2, slowFactor: 0.7, healPerBar: 3, lengthTicks: 24 },
  maxLevel: 5,
  levelMul: 1.5,
};

const WEAPONS = [PLATE, TOTEM, UNICYCLE];

function armed(weaponId: string, options: SimulationOptions = BYSTANDER_QUIET_OPTIONS) {
  const content: GameContent = { ...options.content, weapons: WEAPONS };
  const simulation = createSimulation({ ...options, content });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  player.weapons = [{ id: weaponId, level: 1, phase: 0 }];
  return { simulation, player };
}

function stepTo(simulation: Simulation, tick: number, move = { x: 0, y: 0 }): void {
  while (simulation.state.tick < tick) {
    simulation.step([commandFor(0, { move })]);
  }
}

function tough(enemy: EnemyState): EnemyState {
  enemy.hp = 1000;
  enemy.maxHp = 1000;
  return enemy;
}

function travelled(enemy: EnemyState): number {
  return Math.sqrt(
    (enemy.x - enemy.prevX) * (enemy.x - enemy.prevX) +
      (enemy.y - enemy.prevY) * (enemy.y - enemy.prevY),
  );
}

describe('plate', () => {
  it('drops the first of four plates when the fourth is laid', () => {
    const { simulation } = armed('plate');

    stepTo(simulation, TICKS_PER_BAR * 3, { x: 1, y: 0 });
    const first = simulation.state.placed?.[0];
    stepTo(simulation, TICKS_PER_BAR * 4, { x: 1, y: 0 });

    expect(simulation.state.placed).toHaveLength(3);
    expect(simulation.state.placed?.some((placed) => placed.id === first?.id)).toBe(false);
  });

  it('lays each plate under the player and lets it go after its duration', () => {
    const { simulation, player } = armed('plate');

    stepTo(simulation, TICKS_PER_BAR);
    const [placed] = simulation.state.placed ?? [];
    const position = [player.x, player.y, 70];
    player.weapons = [];
    stepTo(simulation, TICKS_PER_BAR * 5 - 2);
    const stillThere = simulation.state.placed?.length;
    stepTo(simulation, TICKS_PER_BAR * 5 - 1);

    expect([placed?.x, placed?.y, placed?.radius]).toEqual(position);
    expect(stillThere).toBe(1);
    expect(simulation.state.placed).toEqual([]);
    expect(simulation.state.events.map((event) => event.type)).toContain('placedRemoved');
  });

  it('slows a bad vibe standing in it', () => {
    const { simulation, player } = armed('plate');
    stepTo(simulation, TICKS_PER_BAR);
    const inside = tough(placeEnemy(simulation.state, 'grump', player.x + 60, player.y));
    const outside = tough(placeEnemy(simulation.state, 'grump', player.x, player.y + 400));

    simulation.step([]);

    expect(travelled(inside)).toBeCloseTo(2.5 * 0.6);
    expect(travelled(outside)).toBeCloseTo(2.5);
  });

  it('heals a player each bar, never above the maximum', () => {
    const { simulation, player } = armed('plate');
    player.hp = player.maxHp - 6;

    stepTo(simulation, TICKS_PER_BAR);
    const afterOne = player.hp;
    stepTo(simulation, TICKS_PER_BAR + 1);
    const between = player.hp;
    stepTo(simulation, TICKS_PER_BAR * 2);

    expect(afterOne).toBe(player.maxHp - 2);
    expect(between).toBe(afterOne);
    expect(player.hp).toBe(player.maxHp);
  });

  it('counts a Festivalier in distress inside it as helped', () => {
    const { simulation, player } = armed('plate');
    stepTo(simulation, TICKS_PER_BAR - 1);
    const x = player.x + 50;
    const bystander: BystanderState = {
      id: simulation.state.nextEntityId,
      kind: FIXTURE_BYSTANDER.id,
      x,
      y: player.y,
      prevX: x,
      prevY: player.y,
      radius: FIXTURE_BYSTANDER.radius,
      targetX: x,
      targetY: player.y,
      helpTicks: 0,
      ticksLeft: FIXTURE_BYSTANDER.lifetimeBars * TICKS_PER_BAR,
    };
    simulation.state.nextEntityId += 1;
    simulation.state.bystanders = [bystander];

    stepTo(simulation, TICKS_PER_BAR + FIXTURE_BYSTANDER.helpTicks - 2);
    const waiting = simulation.state.bystanders.length;
    simulation.step([]);

    expect(waiting).toBe(1);
    expect(simulation.state.events.map((event) => event.type)).toContain('bystanderHelped');
  });
});

describe('totem', () => {
  function planted() {
    const { simulation, player } = armed('totem');
    player.aim = { x: 1, y: 0 };
    stepTo(simulation, TICKS_PER_BAR);
    const [totem] = simulation.state.placed ?? [];
    if (totem === undefined) {
      throw new Error('expected a totem');
    }
    return { simulation, player, totem };
  }

  it('plants one in front of the player and replaces it on the next shot', () => {
    const { simulation, player, totem } = planted();

    stepTo(simulation, TICKS_PER_BAR * 2);

    expect(totem.x).toBe(player.x + player.radius + 40);
    expect(simulation.state.placed).toHaveLength(1);
    expect(simulation.state.placed?.[0]?.id).not.toBe(totem.id);
  });

  it('draws a bad vibe in range to its foot', () => {
    const { simulation, totem } = planted();
    const enemy = tough(placeEnemy(simulation.state, 'grump', totem.x + 100, totem.y));

    stepTo(simulation, TICKS_PER_BAR + 40);

    expect(enemy.x - totem.x).toBeCloseTo(14 + enemy.radius);
    expect(enemy.y).toBeCloseTo(totem.y);
  });

  it('pushes it back and hurts it on the bar', () => {
    const { simulation, totem } = planted();
    const enemy = tough(placeEnemy(simulation.state, 'grump', totem.x + 100, totem.y));

    stepTo(simulation, TICKS_PER_BAR * 2);

    expect(enemy.hp).toBe(1000 - 7);
    expect(enemy.x - totem.x).toBeCloseTo(14 + enemy.radius + 40);
  });

  it('leaves a bad vibe out of range alone', () => {
    const { simulation, totem } = planted();
    const enemy = tough(placeEnemy(simulation.state, 'grump', totem.x, totem.y + 500));

    stepTo(simulation, TICKS_PER_BAR * 2 - 1);

    expect(enemy.hp).toBe(1000);
  });
});

describe('trail', () => {
  it('speeds the player up through a modifier, once', () => {
    const { simulation, player } = armed('unicycle');
    const base = player.speed;

    stepTo(simulation, 10, { x: 1, y: 0 });

    expect(player.modifiers.speedMul).toBeCloseTo(1.2);
    expect(player.speed).toBeCloseTo(base * 1.2);
    expect(player.x - player.prevX).toBeCloseTo(base * 1.2);
  });

  it('slows a bad vibe that crosses it', () => {
    const { simulation, player } = armed('unicycle');
    stepTo(simulation, 24, { x: 1, y: 0 });
    const across = tough(placeEnemy(simulation.state, 'grump', player.x - 60, player.y + 10));
    const apart = tough(placeEnemy(simulation.state, 'grump', player.x - 60, player.y + 300));

    simulation.step([]);

    expect(travelled(across)).toBeCloseTo(2.5 * 0.7);
    expect(travelled(apart)).toBeCloseTo(2.5);
  });

  it('forgets the places the player left more than its length ago', () => {
    const { simulation, player } = armed('unicycle');
    stepTo(simulation, 60, { x: -1, y: 0 });
    const old = tough(placeEnemy(simulation.state, 'grump', player.x + 200, player.y + 10));

    simulation.step([commandFor(0, { move: { x: -1, y: 0 } })]);

    expect(travelled(old)).toBeCloseTo(2.5);
  });

  it('heals an ally on the trail each bar', () => {
    const { simulation, player } = armed('unicycle');
    player.hp = player.maxHp - 10;

    stepTo(simulation, TICKS_PER_BAR);

    expect(player.hp).toBe(player.maxHp - 7);
  });

  it('reads its newest places first, even when the ring starts filling mid-cycle', () => {
    const { simulation, player } = armed('unicycle');
    player.weapons = [];
    stepTo(simulation, 13);
    player.weapons = [{ id: 'unicycle', level: 1, phase: 0 }];
    stepTo(simulation, 23, { x: 1, y: 0 });
    const across = tough(placeEnemy(simulation.state, 'grump', player.x - 30, player.y + 10));
    const corner = tough(placeEnemy(simulation.state, 'grump', 14, 14));

    simulation.step([]);

    expect(travelled(across)).toBeCloseTo(2.5 * 0.7);
    expect(travelled(corner)).toBeCloseTo(2.5);
  });

  it('keeps its trail in a ring that never grows', () => {
    const { simulation, player } = armed('unicycle');

    stepTo(simulation, 200, { x: 1, y: 0 });

    expect(player.weapons?.[0]?.trail).toHaveLength(48);
  });
});

describe('replay', () => {
  const options: SimulationOptions = {
    ...FIXTURE_OPTIONS,
    content: { ...FIXTURE_CONTENT, weapons: WEAPONS },
  };
  const MOVES = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ];

  function play(): string {
    const simulation = createSimulation(options);
    const [player] = simulation.state.players;
    if (player === undefined) {
      throw new Error('expected one player');
    }
    player.weapons = WEAPONS.map(({ id }) => ({ id, level: 2, phase: 0 }));
    for (let tick = 0; tick < 8 * TICKS_PER_BAR; tick++) {
      const move = MOVES[Math.floor(tick / 30) % MOVES.length] ?? { x: 0, y: 0 };
      simulation.step([commandFor(0, { move, aim: move })]);
    }
    return hashState(simulation.state);
  }

  it('fixes the fingerprint of a scripted game with the three weapons', () => {
    expect(play()).toBe('603cab26');
  });

  it('plays the same game twice', () => {
    expect(play()).toBe(play());
  });
});
