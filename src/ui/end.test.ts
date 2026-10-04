import { describe, expect, it } from 'vitest';
import { FIXTURE_OPTIONS, peaceful, stepAndRecord } from '../sim/fixtures';
import { createSimulation } from '../sim/index';
import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../shared/tempo';
import { endingOf } from './end';

const SET_LENGTH = 2 * (TICKS_PER_PHRASE + 3 * TICKS_PER_BAR);

describe('endingOf', () => {
  it('tells of the sound system when the scene goes silent', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    simulation.state.core.hp = 0;

    simulation.step([]);

    expect(simulation.state.status).toBe('lost');
    expect(endingOf(simulation.state)).toEqual({
      title: 'La musique s’arrête',
      text: 'Les bad vibes ont eu raison du sound system. On rebranche et on y retourne ?',
    });
  });

  it('tells of the dancefloor, not of the scene, when every player is down', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    for (const player of simulation.state.players) {
      player.downed = true;
    }

    simulation.step([]);

    expect(simulation.state.status).toBe('lost');
    expect(simulation.state.core.hp).toBe(simulation.state.core.maxHp);
    const ending = endingOf(simulation.state);
    expect(ending.title).toBe('Plus personne debout');
    expect(ending.text).toBe(
      'Le sound system tient bon, mais les bad vibes ont vidé la piste. On se relève et on y retourne ?',
    );
  });

  it('tells of the silence when the scene and the players fall on the same tick', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    simulation.state.core.hp = 0;
    for (const player of simulation.state.players) {
      player.downed = true;
    }

    simulation.step([]);

    expect(endingOf(simulation.state).title).toBe('La musique s’arrête');
  });

  it('greets the sunrise when the set ends', () => {
    const simulation = peaceful(createSimulation(FIXTURE_OPTIONS));

    stepAndRecord(simulation, SET_LENGTH);

    expect(simulation.state.status).toBe('won');
    expect(endingOf(simulation.state).title).toBe('Sunrise !');
  });
});
