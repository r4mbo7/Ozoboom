import type {
  ClassDefinition,
  EnemyDefinition,
  MusicTrack,
  Release,
  SetDefinition,
  SummonDefinition,
  TeaserDefinition,
  UpgradeDefinition,
} from './types';

export const FULL_CLASSES: readonly ClassDefinition[] = [];
export const FULL_UPGRADES: readonly UpgradeDefinition[] = [];
export const FULL_SETS: readonly SetDefinition[] = [];
export const FULL_PATHS: readonly SetDefinition[] = [];
export const FULL_TRACKS: readonly MusicTrack[] = [];
export const FULL_ENEMIES: readonly EnemyDefinition[] = [];
export const FULL_SUMMONS: readonly SummonDefinition[] = [];
export const FULL_RELEASES: readonly Release[] = [];
export const FULL_COMING: readonly string[] = [];
export const FULL_TEASERS: readonly TeaserDefinition[] = [
  { kind: 'class', name: 'The Athlete', color: '#5aa2ff' },
  { kind: 'class', name: 'The Inked', color: '#8d86ff' },
  { kind: 'class', name: 'The Superfan', color: '#c77dff' },
  { kind: 'class', name: 'The Rooted', color: '#8fd16a' },
  { kind: 'class', name: 'The Firefly Keeper', color: '#4fc6a0' },
  { kind: 'class', name: 'The Celestial', color: '#7f9cff' },
  { kind: 'class', name: 'The Hippie', color: '#f2a65a' },
  { kind: 'class', name: 'The Chick', color: '#ffe14d' },
  { kind: 'class', name: 'The Avatar', color: '#ff9a5a' },
  { kind: 'class', name: 'The Juggler', color: '#f7c948' },
  { kind: 'class', name: 'The Circadian', color: '#ffc14d' },
  { kind: 'class', name: 'The Stilt Walker', color: '#e85d75' },
  { kind: 'class', name: 'The Wizard', color: '#c9a0ff' },
  { kind: 'class', name: 'The Fire Breather', color: '#ff6a2b' },
  { kind: 'class', name: 'The Mapper', color: '#3fe0d0' },
  { kind: 'class', name: 'The Pacifist', color: '#ffb3c7' },
  { kind: 'class', name: 'The Volunteer', color: '#d7ff3a' },
  { kind: 'class', name: 'The Cook', color: '#ff8b73' },
  { kind: 'class', name: 'The Somnambubble', color: '#8fe6ff' },
  { kind: 'class', name: 'The Kaleido', color: '#ff7de9' },
  { kind: 'class', name: 'The Reggae', color: '#3aa655' },
  { kind: 'class', name: 'Futurum Sonat', color: '#6fe36b' },
  { kind: 'stage', name: 'The Dome', style: 'Downtempo, dub', color: '#d9a441' },
  { kind: 'stage', name: 'Ambyss', style: 'Psychill, ambient', color: '#3fd0c9' },
  { kind: 'stage', name: 'Pumpui', style: 'Progressive', color: '#ff6fa8' },
  { kind: 'boss', name: 'The Storm', color: '#7f9cff' },
  { kind: 'boss', name: 'The Heatwave', color: '#ff9a3d' },
  { kind: 'boss', name: 'The Screech', color: '#ff6fa8' },
  { kind: 'boss', name: 'The Mosquitoes', color: '#d7ff3a' },
  { kind: 'boss', name: 'The Loose Wire', color: '#3fd0c9' },
];

export type FullSpecialEffect = never;
export type FullAttack = never;
export type FullSkillEffect = never;
