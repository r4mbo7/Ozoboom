import { describe, expect, it } from 'vitest';
import type { PlayerInput } from '../commands';
import { EFFECTS_OPTIONS, commandFor, placeEnemy, stepAndRecord } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { EnemyState, PlayerState, SimState } from '../state';

function game(
  classId = 'raver',
  setId = 'fixture-set',
): { simulation: Simulation; state: SimState; player: PlayerState } {
  const simulation = createSimulation({
    ...EFFECTS_OPTIONS,
    setId,
    players: [{ id: 0, classId }],
  });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, state: simulation.state, player };
}

function frozenBoss(state: SimState, x: number, y: number): EnemyState {
  const enemy = placeEnemy(state, 'curfew', x, y);
  enemy.stunTicks = 100_000;
  return enemy;
}

function press(simulation: Simulation, input: Partial<PlayerInput>, ticks = 1): number[] {
  const used: number[] = [];
  for (let i = 0; i < ticks; i++) {
    simulation.step([commandFor(0, input)]);
    if (simulation.state.events.some((event) => event.type === 'skillUsed')) {
      used.push(simulation.state.tick);
    }
  }
  return used;
}

function reachDrop(simulation: Simulation): void {
  stepAndRecord(simulation, 96 - simulation.state.tick);
}

describe('skill', () => {
  it('nova: hurts and pushes back the enemies around the caster', () => {
    const { simulation, state, player } = game();
    const near = frozenBoss(state, player.x, player.y - 100);
    const far = frozenBoss(state, player.x, player.y - 120 - 40 - 1);

    press(simulation, { skill: true });

    expect({ hp: near.hp, y: near.y }).toEqual({ hp: 470, y: player.y - 120 });
    expect({ hp: far.hp, y: far.y }).toEqual({ hp: 500, y: player.y - 161 });
    expect(state.events).toContainEqual({ type: 'skillUsed', playerId: 0 });
    expect(player.skillCooldown).toBe(240);
  });

  it('nova: hits harder with the skill power multiplier', () => {
    const { simulation, state, player } = game();
    player.modifiers.skillPowerMul = 1.5;
    const near = frozenBoss(state, player.x, player.y - 100);

    press(simulation, { skill: true });

    expect(near.hp).toBe(500 - 45);
  });

  it('comes back after its cooldown, shortened by the cooldown multiplier', () => {
    const plain = game();
    const quick = game();
    quick.player.modifiers.skillCooldownMul = 0.5;

    const plainUses = press(plain.simulation, { skill: true }, 300);
    const quickUses = press(quick.simulation, { skill: true }, 300);

    expect(plainUses).toEqual([1, 241]);
    expect(quickUses).toEqual([1, 121, 241]);
  });

  it('is not used without the input nor by a downed player', () => {
    const idle = game();
    const downed = game();
    downed.player.downed = true;

    const idleUses = press(idle.simulation, {}, 10);
    const downedUses = press(downed.simulation, { skill: true }, 10);

    expect([idleUses, downedUses]).toEqual([[], []]);
  });

  it('dash: moves the caster along the move input and makes them invulnerable', () => {
    const { simulation, player } = game('roadie', 'fast-drop');
    reachDrop(simulation);
    const startY = player.y;

    simulation.step([commandFor(0, { ultimate: true, move: { x: 0, y: -1 } })]);
    const afterDash = { y: player.y, invulnerableTicks: player.invulnerableTicks };
    stepAndRecord(simulation, 5);

    expect(afterDash).toEqual({ y: startY - 4 - 120, invulnerableTicks: 12 });
    expect(player.invulnerableTicks).toBe(7);
  });

  it('dash: follows the aim without move input and stays inside the arena', () => {
    const { simulation, player } = game('roadie', 'fast-drop');
    reachDrop(simulation);
    player.x = 50;

    simulation.step([commandFor(0, { ultimate: true, aim: { x: -1, y: 0 } })]);

    expect(player.x).toBe(player.radius);
  });

  it('barrier: raises a barrier around the caster for its duration', () => {
    const { simulation, state, player } = game('roadie');

    press(simulation, { skill: true });

    expect(state.barriers).toMatchObject([
      { playerId: 0, x: player.x, y: player.y, radius: 100, hp: 60, ticksLeft: 95 },
    ]);
  });

  it('healPulse: heals the players and repairs the core around the caster', () => {
    const simulation = createSimulation({
      ...EFFECTS_OPTIONS,
      players: [
        { id: 0, classId: 'carer' },
        { id: 1, classId: 'raver' },
        { id: 2, classId: 'raver' },
      ],
    });
    const { state } = simulation;
    const [carer, near, far] = state.players;
    if (carer === undefined || near === undefined || far === undefined) {
      throw new Error('expected three players');
    }
    carer.hp = 50;
    near.hp = 90;
    far.hp = 50;
    far.x = carer.x;
    far.y = carer.y - 150 - 14 - 1;
    near.x = carer.x;
    near.y = carer.y + 100;
    state.core.hp = 900;

    simulation.step([commandFor(0, { skill: true })]);

    expect(state.players.map((player) => player.hp)).toEqual([80, 100, 50]);
    expect(state.core.hp).toBe(950);
    expect(state.events).toContainEqual({ type: 'coreRepaired', amount: 50 });
  });

  it('healPulse: repairs the core up to its max and not from afar', () => {
    const close = game('carer');
    close.state.core.hp = 990;
    const afar = game('carer');
    afar.state.core.hp = 900;
    afar.player.x = 100;

    press(close.simulation, { skill: true });
    press(afar.simulation, { skill: true });

    expect(close.state.core.hp).toBe(1000);
    expect(close.state.events).toContainEqual({ type: 'coreRepaired', amount: 10 });
    expect(afar.state.core.hp).toBe(900);
    expect(afar.state.events.filter((event) => event.type === 'coreRepaired')).toEqual([]);
  });
});

describe('ultimate', () => {
  it('is ready only from the drop, once per drop, and expires when the drop ends', () => {
    const { simulation, state, player } = game('raver', 'fast-drop');
    const used: number[] = [];
    const ready = new Map<number, boolean>();

    for (let tick = 1; tick < 240; tick++) {
      state.enemies.length = 0;
      simulation.step([commandFor(0, { ultimate: tick >= 191 })]);
      if (state.events.some((event) => event.type === 'ultimateUsed')) {
        used.push(state.tick);
      }
      ready.set(state.tick, player.ultimateReady);
    }

    expect([95, 96, 143, 144, 191, 192].map((tick) => ready.get(tick))).toEqual([
      false,
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(used).toEqual([192]);
  });

  it('is ignored before the drop', () => {
    const { simulation, state } = game('raver', 'fast-drop');

    simulation.step([commandFor(0, { ultimate: true })]);

    expect(state.events.filter((event) => event.type === 'ultimateUsed')).toEqual([]);
    expect(state.laserShows).toEqual([]);
  });

  it('laserShow: starts a laser show on the caster and is used up', () => {
    const { simulation, state, player } = game('raver', 'fast-drop');
    reachDrop(simulation);

    simulation.step([commandFor(0, { ultimate: true })]);
    simulation.step([commandFor(0, { ultimate: true })]);

    expect(state.laserShows).toMatchObject([
      { playerId: 0, damagePerTick: 2, radius: 300, ticksLeft: 94 },
    ]);
    expect(player.ultimateReady).toBe(false);
    expect(player.skillCooldown).toBe(0);
  });
});
