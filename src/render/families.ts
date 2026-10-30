import { createBatterieAPlat } from './batterie';
import { createBystanders } from './bystanders';
import { createCore } from './core';
import { createCouvreFeu } from './couvre-feu';
import { createClassEffects } from './class-effects';
import { createEffects } from './effects';
import { createHits } from './hits';
import { createEnemies } from './enemies';
import { FULL_FAMILIES, FULL_LOOKS } from './full';
import { createGround } from './ground';
import { createGroundWaves } from './ground-waves';
import { createBombs } from './bombs';
import { createLoots } from './loots';
import { createMood } from './mood';
import { createPickupBursts } from './pickup-bursts';
import { createPickups } from './pickups';
import { createDownedScreen } from './downed-screen';
import { createMarkers } from './markers';
import { createStageMarker } from './stage-marker';
import { createPlayers } from './players';
import { createProjectiles } from './projectiles';
import { createRecruits } from './recruits';
import { createSpecials } from './specials';
import { createSpeakerCards } from './speaker-card';
import { createSpeakerGuide } from './speaker-guide';
import { createSpeakers } from './speakers';
import { createTraps } from './traps';
import { createWeapons } from './weapons';
import { createWounds } from './wounds';
import type { EntityId } from '../sim/state';
import type { Family, RenderContext } from './context';
import { createPogo } from './pogo';
import { createCoupDeVent } from './vent';

const BOSSES = [createCouvreFeu, createBatterieAPlat, createCoupDeVent, createPogo];

export function createFamilies(ctx: RenderContext, inset: boolean): Family[] {
  if (inset) {
    return createInsetFamilies(ctx);
  }
  const traps = createTraps(ctx);
  const enemies = createEnemies(ctx);
  const poseOf = (id: EntityId) => enemies.poseOf(id);
  return [
    createGround(ctx),
    ...FULL_LOOKS.flatMap((look) => look.families(ctx)),
    createGroundWaves(ctx),
    createSpeakers(ctx),
    createCore(ctx),
    traps,
    createPickups(ctx),
    createPickupBursts(ctx),
    createLoots(ctx),
    createBombs(ctx),
    createBystanders(ctx),
    enemies,
    createRecruits(ctx, enemies.burst.bind(enemies)),
    createWounds(ctx, poseOf),
    ...BOSSES.map((create) => create(ctx, poseOf)),
    createSpecials(ctx),
    createProjectiles(ctx),
    createMood(ctx),
    ...FULL_FAMILIES.map((create) => create(ctx, poseOf)),
    createWeapons(ctx),
    createPlayers(ctx),
    createDownedScreen(ctx),
    createSpeakerCards(ctx),
    createMarkers(ctx),
    createSpeakerGuide(ctx),
    createStageMarker(ctx),
    createEffects(ctx, (id) => traps.reachOf(id)),
    createHits(ctx, enemies),
    createClassEffects(ctx, (id, untilTick) => {
      enemies.blink(id, untilTick);
    }),
  ];
}

function createInsetFamilies(ctx: RenderContext): Family[] {
  return [
    createGround(ctx),
    createEnemies(ctx),
    createProjectiles(ctx),
    createWeapons(ctx),
    createPlayers(ctx),
  ];
}
