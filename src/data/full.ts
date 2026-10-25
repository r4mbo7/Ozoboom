import type {
  ClassDefinition,
  EnemyDefinition,
  MusicTrack,
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
export const FULL_TEASERS: readonly TeaserDefinition[] = [
  { kind: 'class', name: 'Le Sportif', color: '#5aa2ff' },
  { kind: 'class', name: 'Le Tatoué', color: '#8d86ff' },
  { kind: 'class', name: 'Le Super fan', color: '#c77dff' },
  { kind: 'class', name: 'L’Enraciné', color: '#8fd16a' },
  { kind: 'class', name: 'Le Veilleur aux lucioles', color: '#4fc6a0' },
  { kind: 'class', name: 'Le Céleste', color: '#7f9cff' },
  { kind: 'class', name: 'Le Babacool', color: '#f2a65a' },
  { kind: 'class', name: 'Le Poussin', color: '#ffe14d' },
  { kind: 'class', name: 'L’Avatar', color: '#ff9a5a' },
  { kind: 'class', name: 'Le Jongleur', color: '#f7c948' },
  { kind: 'class', name: 'Le Circadien', color: '#ffc14d' },
  { kind: 'stage', name: 'Le Dome', style: 'Downtempo, dub', color: '#d9a441' },
  { kind: 'stage', name: 'Ambyss', style: 'Psychill, ambient', color: '#3fd0c9' },
  { kind: 'stage', name: 'Pumpui', style: 'Progressive', color: '#ff6fa8' },
];

export type FullSpecialEffect = never;
export type FullAttack = never;
export type FullSkillEffect = never;
