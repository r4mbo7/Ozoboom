import { createAudioEngine, type AudioEngineOptions } from '../audio';
import { MENU_RECORDING, loadRecording, prefetchRecording } from '../audio/menu-track';
import type { AudioEngine } from '../audio/types';
import { TRACKS } from '../data/tracks';
import type { GameContent, SetDefinition } from '../data/types';
import type { SimState } from '../sim/state';
import { type DevOptions, type Landings, createLandings } from './dev';
import { drawTrack, seededRandom, stageTracks } from './track';
import { playedSets } from '../data/played-sets';

const DEFAULT_BREAK_BARS = 4;

export interface PlayedGame {
  state(): SimState;
  lastTrackId(): string;
  setNamed(id: string): SetDefinition;
  // Absent, the speakers of the machine. A film renders into its own context, music and effects
  // apart, and is told when the files it plays next have decoded.
  film?: (loaded: () => Promise<void>) => BaseAudioContext;
}

// The sound of a game, and where its start waits for it: a film lands, as `?dev=moment` does, once
// the files it plays first have decoded.
export interface GameSound {
  readonly audio: AudioEngine;
  readonly landings: Landings;
}

export function createGameSound(
  content: GameContent,
  game: PlayedGame,
  dev: Pick<DevOptions, 'moment'>,
  current: () => object,
  // Absent, the files placed with `pnpm sounds`.
  samples?: AudioEngineOptions['samples'],
): GameSound {
  const { film } = game;
  const menuTrack = (): NonNullable<AudioEngineOptions['menuTrack']> => {
    const fetchFile = prefetchRecording(MENU_RECORDING);
    return (context) => loadRecording(context, MENU_RECORDING, fetchFile);
  };
  const audio: AudioEngine = createAudioEngine({
    ...(film === undefined
      ? { menuTrack: menuTrack() }
      : { createContext: () => film(() => audio.loaded()), stems: true }),
    ...(samples === undefined ? {} : { samples }),
    setOf: (setId) => playedSets(content).find((candidate) => candidate.id === setId),
    // Every peer of a festival walks into the same track of the stage ahead.
    trackFor: (set) =>
      drawTrack(
        stageTracks(TRACKS, set.trackIds),
        game.lastTrackId(),
        seededRandom(game.state().seed, set.id),
      ),
    breakBars: (tier) =>
      game.setNamed(game.state().setId).tiers[tier]?.breakBars ?? DEFAULT_BREAK_BARS,
    trapEffectOf: (id) => content.traps.find((trap) => trap.id === id)?.effect.kind ?? id,
    sfxLookups: {
      attackKindOf: (classId) =>
        content.classes.find((candidate) => candidate.id === classId)?.attack.kind,
      weaponKindOf: (id) => content.weapons?.find((weapon) => weapon.id === id)?.effect.kind,
      skillKindOf: (classId) =>
        content.classes.find((candidate) => candidate.id === classId)?.skill.effect.kind,
      specialKindOf: (id) => content.enemies.find((enemy) => enemy.id === id)?.special?.kind,
    },
  });
  return { audio, landings: createLandings(dev.moment !== null || film !== undefined, current) };
}
