import { describe, expect, it } from 'vitest';
import { soundOf, type SoundScene } from './sound';

const playing: SoundScene = { screen: 'game', paused: false, muted: false, hidden: false };

describe('soundOf', () => {
  it('plays the set during the game, upgrade choices included', () => {
    expect(soundOf(playing)).toEqual({ mood: 'set', muted: false });
  });

  it('switches to the menu ambience at the pause', () => {
    expect(soundOf({ ...playing, paused: true })).toEqual({ mood: 'menu', muted: false });
  });

  it('comes back to the set when the game resumes', () => {
    const paused = soundOf({ ...playing, paused: true });

    const resumed = soundOf(playing);

    expect(paused.mood).toBe('menu');
    expect(resumed).toEqual({ mood: 'set', muted: false });
  });

  it('switches to the menu ambience on the end screen', () => {
    expect(soundOf({ ...playing, screen: 'end' })).toEqual({ mood: 'menu', muted: false });
  });

  it('keeps the title silent', () => {
    expect(soundOf({ ...playing, screen: 'title' }).muted).toBe(true);
  });

  it('plays nothing on any screen while the player has turned the sound off', () => {
    const scenes: SoundScene[] = [
      { ...playing, screen: 'title' },
      playing,
      { ...playing, paused: true },
      { ...playing, screen: 'end' },
    ];

    const sounds = scenes.map((scene) => soundOf({ ...scene, muted: true }));

    expect(sounds.every((sound) => sound.muted)).toBe(true);
  });

  it('plays nothing while the page is hidden, menu ambience included', () => {
    expect(soundOf({ ...playing, paused: true, hidden: true }).muted).toBe(true);
    expect(soundOf({ ...playing, screen: 'end', hidden: true }).muted).toBe(true);
  });
});
