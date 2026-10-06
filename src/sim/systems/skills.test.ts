import { describe, expect, it } from 'vitest';
import type { PlayerInput } from '../commands';
import { EFFECTS_OPTIONS, commandFor, placeEnemy, stepAndRecord } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { EnemyState, PlayerState, SimState } from '../state';

function game(classId = 'raver'): { simulation: Simulation; state: SimState; player: PlayerState } {
  const simulation = createSimulation({
    ...EFFECTS_OPTIONS,
    players: [{ id: 0, classId }],
  });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, state: simulation.state, player };
}

function frozenEnemy(state: SimState, x: number, y: number, kind = 'curfew'): EnemyState {
  const enemy = placeEnemy(state, kind, x, y);
  enemy.stunTicks = 100_000;
  enemy.hp = 500;
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

describe('skill', () => {
  it('nova: hurts and pushes back the enemies around the caster, but not a boss', () => {
    const { simulation, state, player } = game();
    const near = frozenEnemy(state, player.x, player.y - 100, 'grump');
    const far = frozenEnemy(state, player.x, player.y - 120 - 12 - 1, 'grump');
    const boss = frozenEnemy(state, player.x, player.y + 100);

    press(simulation, { skill: true });

    expect({ hp: near.hp, y: near.y }).toEqual({ hp: 470, y: player.y - 120 });
    expect({ hp: far.hp, y: far.y }).toEqual({ hp: 500, y: player.y - 133 });
    expect({ hp: boss.hp, y: boss.y }).toEqual({ hp: 470, y: player.y + 100 });
    expect(state.events).toContainEqual({ type: 'skillUsed', playerId: 0 });
    expect(player.skillCooldown).toBe(240);
  });

  it('nova: hits harder with the skill power multiplier', () => {
    const { simulation, state, player } = game();
    player.modifiers.skillPowerMul = 1.5;
    const near = frozenEnemy(state, player.x, player.y - 100);

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
    const { simulation, player } = game('roadie');
    const startY = player.y;

    simulation.step([commandFor(0, { skill: true, move: { x: 0, y: -1 } })]);
    const afterDash = { y: player.y, invulnerableTicks: player.invulnerableTicks };
    stepAndRecord(simulation, 5);

    expect(afterDash).toEqual({ y: startY - 4 - 120, invulnerableTicks: 12 });
    expect(player.invulnerableTicks).toBe(7);
  });

  it('dash: follows the aim without move input and stays inside the arena', () => {
    const { simulation, player } = game('roadie');
    player.x = 50;

    simulation.step([commandFor(0, { skill: true, aim: { x: -1, y: 0 } })]);

    expect(player.x).toBe(player.radius);
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
