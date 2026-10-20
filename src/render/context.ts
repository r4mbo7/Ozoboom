import type {
  AttackDefinition,
  BystanderDefinition,
  DashDefinition,
  ClassDefinition,
  EnemyBehaviour,
  EnemyDefinition,
  SetDefinition,
  SkillDefinition,
  SkillEffect,
  SpecialEffect,
  SpeakerDefinition,
  TrapDefinition,
  WeaponDefinition,
} from '../data/types';
import type { PaletteToken } from '../shared/palette';
import type { SimEvent, SimState } from '../sim/state';
import type { Frame } from './frame';
import { classTokens } from './palette';
import type { Layers } from './layers';
import type { Textures } from './textures';
import type { RenderOptions } from './types';

export type WeaponLook = Pick<
  WeaponDefinition,
  'name' | 'classAffinity' | 'effect' | 'evolvedFrom'
>;

export interface RenderContent {
  readonly classes: readonly (Pick<ClassDefinition, 'id' | 'shadeRadius'> & {
    readonly skill: Pick<SkillDefinition, 'effect'>;
    readonly attack?: AttackDefinition;
  })[];
  readonly enemies: readonly Pick<EnemyDefinition, 'id' | 'behaviour' | 'special' | 'radius'>[];
  readonly traps: readonly Pick<TrapDefinition, 'id' | 'radius' | 'effect' | 'shade'>[];
  readonly sets: readonly SetDefinition[];
  // The paths a festival walks between two stages, drawn like a stage.
  readonly paths?: readonly SetDefinition[];
  readonly bystanders?: readonly Pick<BystanderDefinition, 'id' | 'helpTicks'>[];
  readonly weapons?: readonly (WeaponLook & Pick<WeaponDefinition, 'id'>)[];
  readonly dash?: DashDefinition;
}

export type TrapLook = Pick<TrapDefinition, 'radius' | 'effect' | 'shade'>;

export type SpeakerLook = Pick<
  SpeakerDefinition,
  'name' | 'description' | 'aura' | 'plugBars' | 'unlocksWeaponId'
>;

export interface RenderContext {
  readonly textures: Textures;
  readonly layers: Layers;
  readonly options: RenderOptions;
  readonly classTokens: ReadonlyMap<string, PaletteToken>;
  readonly behaviours: ReadonlyMap<string, EnemyBehaviour>;
  // Each bad vibe's radius as defined, for one that left before it was drawn.
  readonly enemyRadii?: ReadonlyMap<string, number>;
  readonly trapLooks: ReadonlyMap<string, TrapLook>;
  readonly specials: ReadonlyMap<string, SpecialEffect>;
  readonly helpTicks: ReadonlyMap<string, number>;
  readonly speakerLooks: ReadonlyMap<string, ReadonlyMap<string, SpeakerLook>>;
  // Every set a game may play, the paths of a festival included, by id.
  readonly stages: ReadonlyMap<string, SetDefinition>;
  readonly weaponLooks: ReadonlyMap<string, WeaponLook>;
  readonly skillEffects: ReadonlyMap<string, SkillEffect>;
  // The shade each class casts around its players, by class id: the parasol of the Hygie.
  readonly shadeRadii: ReadonlyMap<string, number>;
  // Each class's attack, where the content gives it.
  readonly attacks: ReadonlyMap<string, AttackDefinition>;
  readonly dash: DashDefinition | null;
}

export interface Family {
  update(state: SimState, alpha: number, frame: Frame): void;
  destroy(): void;
  onEvent?(event: SimEvent, state: SimState, frame: Frame): void;
  reset?(): void;
}

export function createRenderContext(
  textures: Textures,
  layers: Layers,
  options: RenderOptions,
  content: RenderContent,
): RenderContext {
  return {
    textures,
    layers,
    options,
    classTokens: classTokens(content.classes),
    behaviours: new Map(content.enemies.map((def) => [def.id, def.behaviour])),
    enemyRadii: new Map(content.enemies.map((def) => [def.id, def.radius])),
    trapLooks: new Map(content.traps.map((def) => [def.id, def])),
    specials: new Map(
      content.enemies.flatMap((def): [string, SpecialEffect][] =>
        def.special === undefined ? [] : [[def.id, def.special]],
      ),
    ),
    helpTicks: new Map((content.bystanders ?? []).map((def) => [def.id, def.helpTicks])),
    stages: new Map([...content.sets, ...(content.paths ?? [])].map((set) => [set.id, set])),
    speakerLooks: new Map(
      content.sets.map((set) => [
        set.id,
        new Map((set.speakers ?? []).map((def) => [def.id, def])),
      ]),
    ),
    weaponLooks: new Map((content.weapons ?? []).map((def) => [def.id, def])),
    skillEffects: new Map(content.classes.map((def) => [def.id, def.skill.effect])),
    shadeRadii: new Map(
      content.classes.flatMap((def): [string, number][] =>
        def.shadeRadius === undefined ? [] : [[def.id, def.shadeRadius]],
      ),
    ),
    attacks: new Map(
      content.classes.flatMap((def): [string, AttackDefinition][] =>
        def.attack === undefined ? [] : [[def.id, def.attack]],
      ),
    ),
    dash: content.dash ?? null,
  };
}
