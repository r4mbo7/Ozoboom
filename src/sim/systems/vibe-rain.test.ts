import { describe, expect, it } from 'vitest';
import type { SetDefinition, SpeakerDefinition, VibeRainRules } from '../../data/types';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../../shared/tempo';
import { EFFECTS_CONTENT, EFFECTS_OPTIONS, FIXTURE_SET, peaceful } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import { touchesObstacle } from '../obstacles';
import type { PickupState, PlayerState, SimState } from '../state';

const WEST: SpeakerDefinition = {
  id: 'west',
  name: 'Ouest',
  description: 'Une brume.',
  x: 200,
  y: 450,
  radius: 60,
  plugBars: 1,
  aura: { kind: 'mist', slowFactor: 1, healPerBar: 0, radius: 100 },
};

const SOUTH: SpeakerDefinition = { ...WEST, id: 'south', name: 'Sud', x: 800, y: 800 };

const RAIN: VibeRainRules = { bars: 2, dropsPerBar: 4, amount: 0.25, radius: 250, flightBeats: 2 };

const RAIN_SET: SetDefinition = { ...FIXTURE_SET, speakers: [WEST, SOUTH], vibeRain: RAIN };

function game(set: SetDefinition = RAIN_SET): {
  simulation: Simulation;
  state: SimState;
  player: PlayerState;
} {
  const simulation = peaceful(
    createSimulation({ ...EFFECTS_OPTIONS, content: { ...EFFECTS_CONTENT, sets: [set] } }),
  );
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, state: simulation.state, player };
}

function stand(player: PlayerState, at: { x: number; y: number }): void {
  player.x = at.x;
  player.y = at.y;
  player.prevX = at.x;
  player.prevY = at.y;
}

function steps(simulation: Simulation, count: number): void {
  for (let i = 0; i < count; i++) {
    simulation.step([]);
  }
}

function plug(simulation: Simulation, player: PlayerState, speaker: SpeakerDefinition): void {
  stand(player, speaker);
  steps(simulation, speaker.plugBars * TICKS_PER_BAR - 1);
}

function fromCore(
  state: SimState,
  pickup: PickupState,
): { x: number; y: number; distance: number } {
  const x = pickup.x - state.core.x;
  const y = pickup.y - state.core.y;
  return { x, y, distance: Math.sqrt(x * x + y * y) };
}

describe('vibe rain', () => {
  it('lobs dropsPerBar vibes a bar for `bars` bars once a speaker is plugged, then stops', () => {
    const { simulation, state, player } = game();
    plug(simulation, player, WEST);
    expect(state.pickups).toHaveLength(0);

    steps(simulation, 1);
    expect(state.pickups).toHaveLength(1);

    steps(simulation, RAIN.bars * TICKS_PER_BAR - 1);
    expect(state.pickups).toHaveLength(RAIN.bars * RAIN.dropsPerBar);
    expect(state.pickups.every((pickup) => pickup.amount === RAIN.amount)).toBe(true);

    steps(simulation, TICKS_PER_BAR);
    expect(state.pickups).toHaveLength(RAIN.bars * RAIN.dropsPerBar);
  });

  it('lands every vibe around the core, on the side of its speaker', () => {
    const { simulation, state, player } = game();
    plug(simulation, player, WEST);

    steps(simulation, RAIN.bars * TICKS_PER_BAR);

    for (const pickup of state.pickups) {
      const landing = fromCore(state, pickup);
      expect(landing.distance).toBeGreaterThan(state.core.radius);
      expect(landing.distance).toBeLessThanOrEqual(RAIN.radius);
      expect(landing.x * (WEST.x - state.core.x)).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps a vibe in flight for flightBeats beats, from its speaker', () => {
    const { simulation, state, player } = game();
    plug(simulation, player, WEST);
    steps(simulation, 1);
    const [first] = state.pickups;

    expect(first?.flight).toMatchObject({ fromX: WEST.x, fromY: WEST.y });
    steps(simulation, RAIN.flightBeats * TICKS_PER_BEAT - 2);
    expect(first?.flight).toBeDefined();
    steps(simulation, 1);
    expect(first?.flight).toBeUndefined();
  });

  it('starts again at the new Volume when another speaker is plugged, each one lobbing in turn', () => {
    const { simulation, state, player } = game();
    plug(simulation, player, WEST);
    steps(simulation, 1);
    plug(simulation, player, SOUTH);
    state.pickups.length = 0;

    const sources: (number | undefined)[] = [];
    for (let tick = 0; tick < (RAIN.bars + 1) * TICKS_PER_BAR; tick++) {
      simulation.step([]);
      sources.push(...state.pickups.slice(sources.length).map((pickup) => pickup.flight?.fromX));
    }

    const perSpeaker = RAIN.bars * RAIN.dropsPerBar;
    expect(sources.filter((fromX) => fromX === WEST.x)).toHaveLength(perSpeaker);
    expect(sources.filter((fromX) => fromX === SOUTH.x)).toHaveLength(perSpeaker);
  });

  it('never lands a vibe in an obstacle', () => {
    const obstacles = [
      { x: 620, y: 450, radius: 90 },
      { x: 700, y: 300, radius: 60 },
      { x: 700, y: 600, radius: 60 },
    ];
    const { simulation, state, player } = game({
      ...RAIN_SET,
      obstacles,
      vibeRain: { ...RAIN, bars: 16 },
    });
    plug(simulation, player, WEST);

    steps(simulation, 16 * TICKS_PER_BAR);

    expect(state.pickups.length).toBeGreaterThan(0);
    for (const pickup of state.pickups) {
      expect(touchesObstacle({ x: pickup.x, y: pickup.y, radius: 0 }, obstacles)).toBe(false);
    }
  });

  it('does nothing on a set without rules', () => {
    const { simulation, state, player } = game({ ...FIXTURE_SET, speakers: [WEST] });
    plug(simulation, player, WEST);

    steps(simulation, 2 * TICKS_PER_BAR);

    expect(state.volume).toBe(1);
    expect(state.pickups).toHaveLength(0);
  });
});
