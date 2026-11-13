import type { SkillEffect } from '../data/types';
import type { PaletteToken } from '../shared/palette';
import type { RenderContext } from './context';
import type { Layers } from './layers';
import type { Textures } from './textures';

// What a portrait's families draw with: a character and its class's effects, nothing of a game.
export function portraitContext(
  textures: Textures,
  layers: Layers,
  classTokens: ReadonlyMap<string, PaletteToken>,
  skillEffects: ReadonlyMap<string, SkillEffect>,
): RenderContext {
  return {
    textures,
    layers,
    options: { calmMode: false },
    dash: null,
    stages: new Map(),
    classTokens,
    behaviours: new Map(),
    trapLooks: new Map(),
    specials: new Map(),
    helpTicks: new Map(),
    speakerLooks: new Map(),
    weaponLooks: new Map(),
    skillEffects,
    shadeRadii: new Map(),
    attacks: new Map(),
  };
}
