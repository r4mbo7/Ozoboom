import type {
  BystanderDefinition,
  ClassDefinition,
  EnemyBehaviour,
  EnemyDefinition,
  SetDefinition,
  SpecialEffect,
  TrapDefinition,
} from '../data/types';
import type { PaletteToken } from '../shared/palette';
import type { SimEvent, SimState } from '../sim/state';
import type { Frame } from './frame';
import type { Layers } from './layers';
import type { Textures } from './textures';
import type { RenderOptions } from './types';

export interface RenderContent {
  readonly classes: readonly Pick<ClassDefinition, 'id'>[];
  readonly enemies: readonly Pick<EnemyDefinition, 'id' | 'behaviour' | 'special'>[];
  readonly traps: readonly Pick<TrapDefinition, 'id' | 'radius' | 'effect'>[];
  readonly sets: readonly SetDefinition[];
  readonly bystanders?: readonly Pick<BystanderDefinition, 'id' | 'helpTicks'>[];
}

export type TrapLook = Pick<TrapDefinition, 'radius' | 'effect'>;

export interface RenderContext {
  readonly textures: Textures;
  readonly layers: Layers;
  readonly options: RenderOptions;
  readonly classTokens: ReadonlyMap<string, PaletteToken>;
  readonly behaviours: ReadonlyMap<string, EnemyBehaviour>;
  readonly trapLooks: ReadonlyMap<string, TrapLook>;
  readonly specials: ReadonlyMap<string, SpecialEffect>;
  readonly helpTicks: ReadonlyMap<string, number>;
}

export interface Family {
  update(state: SimState, alpha: number, frame: Frame): void;
  destroy(): void;
  onEvent?(event: SimEvent, state: SimState, frame: Frame): void;
  reset?(): void;
}
