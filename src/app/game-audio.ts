import { createAudioEngine } from '../audio';
import type { AudioEngine } from '../audio/types';
import { TRACKS } from '../data/tracks';
import type { GameContent, SetDefinition } from '../data/types';
import type { SimState } from '../sim/state';
import { drawTrack, seededRandom, stageTracks } from './track';

const DEFAULT_BREAK_BARS = 4;

export interface PlayedGame {
  state(): SimState;
  lastTrackId(): string;
  setNamed(id: string): SetDefinition;
}

export function createGameAudio(content: GameContent, game: PlayedGame): AudioEngine {
  return createAudioEngine({
    setOf: (setId) =>
      [...content.sets, ...(content.paths ?? [])].find((candidate) => candidate.id === setId),
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
      weaponKindOf: (id) => content.weapons?.find((weapon) => weapon.id === id)?.effect.kind,
      skillKindOf: (classId) =>
        content.classes.find((candidate) => candidate.id === classId)?.skill.effect.kind,
      specialKindOf: (id) => content.enemies.find((enemy) => enemy.id === id)?.special?.kind,
    },
  });
}
