import type {
  ClassDefinition,
  EnemyBehaviour,
  EnemyDefinition,
  SetDefinition,
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
  readonly enemies: readonly Pick<EnemyDefinition, 'id' | 'behaviour'>[];
  readonly traps: readonly Pick<TrapDefinition, 'id' | 'radius' | 'effect'>[];
  readonly sets: readonly SetDefinition[];
}

export type TrapLook = Pick<TrapDefinition, 'radius' | 'effect'>;

export interface RenderContext {
  readonly textures: Textures;
  readonly layers: Layers;
  readonly options: RenderOptions;
  readonly classTokens: ReadonlyMap<string, PaletteToken>;
  readonly behaviours: ReadonlyMap<string, EnemyBehaviour>;
  readonly trapLooks: ReadonlyMap<string, TrapLook>;
}

export interface Family {
  update(state: SimState, alpha: number, frame: Frame): void;
  destroy(): void;
  onEvent?(event: SimEvent, state: SimState, frame: Frame): void;
  reset?(): void;
}
