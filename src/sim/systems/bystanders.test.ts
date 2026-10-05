import { describe, expect, it } from 'vitest';
import type { GameContent, SetDefinition } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import {
  BYSTANDER_CONTENT,
  BYSTANDER_OPTIONS,
  BYSTANDER_QUIET_OPTIONS,
  FIXTURE_BYSTANDER,
  FIXTURE_MIST,
  FIXTURE_SET,
  commandFor,
  placeEnemy,
  stepAndRecord,
} from '../fixtures';
import type { PlayerCommand } from '../commands';
import { createSimulation, type SimulationOptions } from '../index';
import { hashState, runScript } from '../replay';
import type { BystanderState, SimState } from '../state';

function placeBystander(
  state: SimState,
  x: number,
  y: number,
  targetX: number,
  targetY: number,
): BystanderState {
  const bystander: BystanderState = {
    id: state.nextEntityId,
    kind: FIXTURE_BYSTANDER.id,
    x,
    y,
    prevX: x,
    prevY: y,
    radius: FIXTURE_BYSTANDER.radius,
    targetX,
    targetY,
    helpTicks: 0,
    ticksLeft: FIXTURE_BYSTANDER.lifetimeBars * TICKS_PER_BAR,
  };
  state.nextEntityId += 1;
  (state.bystanders ??= []).push(bystander);
  return bystander;
}

describe('bystanders', () => {
  it('spawns at the rhythm set by the tier, on the edge of the arena', () => {
    const simulation = createSimulation(BYSTANDER_OPTIONS);
    const { width, height } = simulation.state.arena;
    const radius = FIXTURE_BYSTANDER.radius;

    const recorded = stepAndRecord(simulation, 5 * TICKS_PER_BAR);

    const spawned = recorded.flatMap(({ tick, event }) =>
      event.type === 'bystanderSpawned' ? [{ tick, event }] : [],
    );
    expect(spawned.map(({ tick }) => tick)).toEqual([2, 4].map((bar) => bar * TICKS_PER_BAR));
    for (const { event } of spawned) {
      const onEdge =
        event.x === radius ||
        event.y === radius ||
        event.x === width - radius ||
        event.y === height - radius;
      expect(onEdge).toBe(true);
    }
    expect(simulation.state.bystanders).toHaveLength(2);
  });

  it('walks toward its wander target at its own speed, then stops there', () => {
    const simulation = createSimulation(BYSTANDER_QUIET_OPTIONS);
    const bystander = placeBystander(simulation.state, 100, 100, 150, 100);

    simulation.step([]);
    expect(bystander).toMatchObject({ x: 102, y: 100 });

    stepAndRecord(simulation, 24);
    expect(bystander).toMatchObject({ x: 150, y: 100 });

    simulation.step([]);
    expect(bystander).toMatchObject({ x: 150, y: 100 });
  });

  it('is helped by a standing, non-downed player at its contact, after helpTicks ticks', () => {
    const simulation = createSimulation(BYSTANDER_QUIET_OPTIONS);
    const { state } = simulation;
    const player = state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    const bystander = placeBystander(state, player.x, player.y, player.x, player.y);

    stepAndRecord(simulation, FIXTURE_BYSTANDER.helpTicks - 1);
    expect(state.bystanders).toContain(bystander);
    expect(player.vibes).toBe(0);

    simulation.step([]);

    expect(state.bystanders).toEqual([]);
    expect(player.vibes).toBe(FIXTURE_BYSTANDER.vibesReward);
    expect(state.events).toContainEqual({
      type: 'bystanderHelped',
      id: bystander.id,
      kind: bystander.kind,
      x: bystander.x,
      y: bystander.y,
    });
  });

  it('starts its help over when the contact breaks', () => {
    const simulation = createSimulation(BYSTANDER_QUIET_OPTIONS);
    const { state } = simulation;
    const player = state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    const bystander = placeBystander(state, player.x, player.y, player.x, player.y);
    const { y } = player;

    stepAndRecord(simulation, FIXTURE_BYSTANDER.helpTicks - 1);
    player.y = y + 300;
    player.prevY = player.y;
    simulation.step([]);
    player.y = y;
    player.prevY = y;
    stepAndRecord(simulation, FIXTURE_BYSTANDER.helpTicks - 1);

    expect(state.bystanders).toContain(bystander);
    simulation.step([]);
    expect(state.bystanders).toEqual([]);
  });

  it('does not count a downed player as helping', () => {
    const simulation = createSimulation(BYSTANDER_QUIET_OPTIONS);
    const { state } = simulation;
    const player = state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    player.downed = true;
    placeBystander(state, player.x, player.y, player.x, player.y);

    simulation.step([]);

    expect(state.bystanders?.[0]?.helpTicks).toBe(0);
  });

  it('counts a mist trap zone touching it as a contact, with no player nearby', () => {
    const simulation = createSimulation(BYSTANDER_QUIET_OPTIONS);
    const { state } = simulation;
    const trapX = 1000;
    const trapY = 500;
    state.traps.push({
      id: state.nextEntityId,
      kind: FIXTURE_MIST.id,
      ownerId: 0,
      level: 1,
      x: trapX,
      y: trapY,
      prevX: trapX,
      prevY: trapY,
      direction: { x: 1, y: 0 },
      hp: FIXTURE_MIST.hp,
      cooldown: 0,
    });
    state.nextEntityId += 1;
    const bystander = placeBystander(state, trapX, trapY, trapX, trapY);

    stepAndRecord(simulation, FIXTURE_BYSTANDER.helpTicks);

    expect(state.bystanders).toEqual([]);
    expect(state.players[0]?.vibes).toBe(FIXTURE_BYSTANDER.vibesReward);
    expect(state.events).toContainEqual({
      type: 'bystanderHelped',
      id: bystander.id,
      kind: bystander.kind,
      x: trapX,
      y: trapY,
    });
  });

  it('counts a healPulse cast that touches it as one contact', () => {
    const simulation = createSimulation({
      ...BYSTANDER_QUIET_OPTIONS,
      players: [{ id: 0, classId: 'carer' }],
    });
    const { state } = simulation;
    const player = state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    const bystander = placeBystander(state, player.x + 50, player.y, player.x + 50, player.y);

    simulation.step([commandFor(0, { skill: true })]);

    expect(state.events).toContainEqual({ type: 'skillUsed', playerId: 0 });
    expect(bystander.helpTicks).toBe(1);
  });

  it('is made to leave by a bad vibe that touches it, costing each player vibesPenalty, never below 0', () => {
    const simulation = createSimulation(BYSTANDER_QUIET_OPTIONS);
    const { state } = simulation;
    const player = state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    player.vibes = 1;
    const bystander = placeBystander(state, 1000, 500, 1000, 500);
    placeEnemy(state, 'grump', 1000, 500);

    simulation.step([]);

    expect(state.bystanders).toEqual([]);
    expect(player.vibes).toBe(0);
    expect(state.events).toContainEqual({
      type: 'bystanderLost',
      id: bystander.id,
      kind: bystander.kind,
      x: 1000,
      y: 500,
    });
  });

  it('disappears after lifetimeBars with no penalty', () => {
    const simulation = createSimulation(BYSTANDER_QUIET_OPTIONS);
    const { state } = simulation;
    const player = state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    player.vibes = 5;
    const bystander = placeBystander(state, 1000, 500, 1000, 500);
    const totalLifetime = FIXTURE_BYSTANDER.lifetimeBars * TICKS_PER_BAR;

    stepAndRecord(simulation, totalLifetime - 1);
    expect(state.bystanders).toContain(bystander);

    simulation.step([]);

    expect(state.bystanders).toEqual([]);
    expect(player.vibes).toBe(5);
    expect(state.events).toContainEqual({
      type: 'bystanderLost',
      id: bystander.id,
      kind: bystander.kind,
      x: 1000,
      y: 500,
    });
  });
});

const SCRIPTED_SET: SetDefinition = {
  ...FIXTURE_SET,
  id: 'bystander-script-set',
  tiers: FIXTURE_SET.tiers.map((tier) => ({
    ...tier,
    bystanderSpawns: [{ bystanderId: FIXTURE_BYSTANDER.id, everyBars: 2, count: 1, fromPhrase: 0 }],
  })),
};

const SCRIPTED_CONTENT: GameContent = { ...BYSTANDER_CONTENT, sets: [SCRIPTED_SET] };

const SCRIPTED_OPTIONS: SimulationOptions = {
  ...BYSTANDER_OPTIONS,
  content: SCRIPTED_CONTENT,
  setId: SCRIPTED_SET.id,
  players: [{ id: 0, classId: 'carer' }],
  seed: 42,
};

function scriptedGame(ticks: number): PlayerCommand[][] {
  return Array.from({ length: ticks }, (_, tick) => [
    {
      ...commandFor(0, {
        move: { x: tick % 60 < 30 ? 1 : -1, y: tick % 90 < 45 ? 0.5 : -0.5 },
        fire: true,
        skill: tick % 47 === 0,
      }),
      actions: [],
    },
  ]);
}

const REFERENCE_BYSTANDER_HASH = 'b675ec09';

describe('bystanders replay', () => {
  it('keeps the fingerprint of a scripted game with the Festivalier', () => {
    const state = runScript(SCRIPTED_OPTIONS, scriptedGame(600));

    expect(hashState(state)).toBe(REFERENCE_BYSTANDER_HASH);
  });
});
