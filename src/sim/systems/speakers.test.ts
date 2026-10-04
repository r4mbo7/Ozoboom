import { describe, expect, it } from 'vitest';
import type { SetDefinition, SpeakerDefinition } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import {
  COMBAT_CONTENT,
  COMBAT_OPTIONS,
  EFFECTS_CONTENT,
  EFFECTS_OPTIONS,
  FIXTURE_SET,
  placeEnemy,
  stepAndRecord,
} from '../fixtures';
import { createSimulation, type Simulation, type SimulationOptions } from '../index';
import type { PlayerState, SimState } from '../state';

const DOME: SpeakerDefinition = {
  id: 'dome',
  name: 'Dôme',
  description: 'Une brume.',
  x: 200,
  y: 200,
  radius: 60,
  plugBars: 2,
  aura: { kind: 'mist', slowFactor: 0.5, healPerBar: 10, radius: 100 },
};

const SUB: SpeakerDefinition = {
  id: 'sub',
  name: 'Sub',
  description: 'Une onde.',
  x: 1200,
  y: 700,
  radius: 60,
  plugBars: 1,
  aura: { kind: 'shockwave', damage: 3, radius: 100, knockback: 0 },
};

const SPEAKER_SET: SetDefinition = { ...FIXTURE_SET, speakers: [DOME, SUB] };

const OPTIONS: SimulationOptions = {
  ...EFFECTS_OPTIONS,
  content: { ...EFFECTS_CONTENT, sets: [SPEAKER_SET] },
};

const COMBAT_SPEAKERS: SimulationOptions = {
  ...COMBAT_OPTIONS,
  content: {
    ...COMBAT_CONTENT,
    sets: COMBAT_CONTENT.sets.map((set) => ({ ...set, speakers: [DOME, SUB] })),
  },
};

function game(options = OPTIONS): { simulation: Simulation; state: SimState; player: PlayerState } {
  const simulation = createSimulation(options);
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, state: simulation.state, player };
}

function stand(player: PlayerState, x: number, y: number): void {
  player.x = x;
  player.y = y;
  player.prevX = x;
  player.prevY = y;
}

const speaker = (state: SimState, id: string) => state.speakers?.find((s) => s.id === id);

describe('speakers', () => {
  it('plug after plugBars bars with a player inside, and raise the Volume by one', () => {
    const { simulation, state, player } = game();
    stand(player, 200, 200);

    const recorded = stepAndRecord(simulation, 2 * TICKS_PER_BAR);

    expect(speaker(state, 'dome')?.plugged).toBe(true);
    expect(state.volume).toBe(1);
    const types = recorded.map(({ event }) => event.type);
    expect(types.filter((type) => type === 'speakerPlugged')).toHaveLength(1);
    expect(types.filter((type) => type === 'volumeChanged')).toHaveLength(1);
    expect(recorded.find(({ event }) => event.type === 'speakerPlugged')?.tick).toBe(
      2 * TICKS_PER_BAR,
    );
  });

  it('do not plug one tick early', () => {
    const { simulation, state, player } = game();
    stand(player, 200, 200);

    stepAndRecord(simulation, 2 * TICKS_PER_BAR - 1);

    expect(speaker(state, 'dome')?.plugged).toBe(false);
    expect(state.volume).toBe(0);
  });

  it('start again from zero when the player steps out', () => {
    const { simulation, state, player } = game();
    stand(player, 200, 200);
    stepAndRecord(simulation, 2 * TICKS_PER_BAR - 1);

    stand(player, 600, 600);
    stepAndRecord(simulation, 1);
    expect(speaker(state, 'dome')?.plugTicks).toBe(0);

    stand(player, 200, 200);
    stepAndRecord(simulation, 2 * TICKS_PER_BAR - 1);
    expect(speaker(state, 'dome')?.plugged).toBe(false);
    stepAndRecord(simulation, 1);
    expect(speaker(state, 'dome')?.plugged).toBe(true);
  });

  it('ignore a downed player', () => {
    const { simulation, state, player } = game();
    stand(player, 200, 200);
    player.downed = true;

    stepAndRecord(simulation, 2 * TICKS_PER_BAR);

    expect(speaker(state, 'dome')?.plugTicks).toBe(0);
  });

  it('announce the progress on every beat while plugging', () => {
    const { simulation, player } = game();
    stand(player, 200, 200);

    const recorded = stepAndRecord(simulation, TICKS_PER_BAR);

    const progress = recorded.flatMap(({ event }) =>
      event.type === 'speakerPlugging' && event.speakerId === 'dome' ? [event.progress] : [],
    );
    expect(progress.length).toBeGreaterThanOrEqual(3);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect(progress.every((value) => value > 0 && value < 1)).toBe(true);
  });

  it('heal a player beside a plugged mist speaker and nobody beside an unplugged one', () => {
    const { simulation, state, player } = game();
    stand(player, 200, 200);
    stepAndRecord(simulation, 2 * TICKS_PER_BAR);
    expect(speaker(state, 'dome')?.plugged).toBe(true);
    player.hp = 50;
    stand(player, 240, 200);

    stepAndRecord(simulation, TICKS_PER_BAR);

    expect(player.hp).toBeGreaterThan(50);

    const quiet = game();
    quiet.player.hp = 50;
    stand(quiet.player, 240, 200);
    stepAndRecord(quiet.simulation, 2 * TICKS_PER_BAR);
    expect(quiet.player.hp).toBe(50);
  });

  it('plays a shockwave aura on the beat, with the code of the traps', () => {
    const { simulation, state, player } = game(COMBAT_SPEAKERS);
    stand(player, 1200, 700);
    stepAndRecord(simulation, TICKS_PER_BAR);
    expect(speaker(state, 'sub')?.plugged).toBe(true);
    stand(player, 600, 450);
    const enemy = placeEnemy(state, 'grump', 1200, 700);
    enemy.stunTicks = 100_000;
    const before = enemy.hp;

    stepAndRecord(simulation, TICKS_PER_BAR);

    expect(enemy.hp).toBeLessThan(before);
    expect((before - enemy.hp) % 3).toBe(0);
  });
});
