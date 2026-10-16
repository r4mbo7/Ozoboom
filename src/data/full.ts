import type {
  ClassDefinition,
  EnemyDefinition,
  MusicTrack,
  SetDefinition,
  TeaserDefinition,
  UpgradeDefinition,
} from './types';

export const FULL_CLASSES: readonly ClassDefinition[] = [];
export const FULL_UPGRADES: readonly UpgradeDefinition[] = [];
export const FULL_SETS: readonly SetDefinition[] = [];
export const FULL_TRACKS: readonly MusicTrack[] = [];
export const FULL_ENEMIES: readonly EnemyDefinition[] = [];
export const FULL_TEASERS: readonly TeaserDefinition[] = [
  { kind: 'class', name: 'Le Jongleur', color: '#f7c948' },
  { kind: 'stage', name: 'Le Dome', style: 'Downtempo, dub', color: '#d9a441' },
  { kind: 'stage', name: 'Ambyss', style: 'Psychill, ambient', color: '#3fd0c9' },
  { kind: 'stage', name: 'Pumpui', style: 'Progressive', color: '#ff6fa8' },
];

export type FullSpecialEffect = never;
export type FullAttack = never;
export type FullSkillEffect = never;
