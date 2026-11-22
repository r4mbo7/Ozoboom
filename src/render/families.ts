import { createBatterieAPlat } from './batterie';
import { createBystanders } from './bystanders';
import { createCore } from './core';
import { createDancer } from './dancer';
import { createCouvreFeu } from './couvre-feu';
import { createClassEffects } from './class-effects';
import { createEffects } from './effects';
import { createHits } from './hits';
import { createEnemies } from './enemies';
import { FULL_FAMILIES, FULL_LOOKS } from './full';
import { createGround } from './ground';
import { createGroundWaves } from './ground-waves';
import { createBombs } from './bombs';
import { createTwinVibes } from './twin-vibes';
import { createBattery } from './battery';
import { createPotion } from './potion';
import { createDice } from './dice';
import { createCarriers } from './carried-traps';
import { createMood } from './mood';
import { createPickupBursts } from './pickup-bursts';
import { createPickups } from './pickups';
import { createDownedScreen } from './downed-screen';
import { createMarkers } from './markers';
import { createStageMarker } from './stage-marker';
import { createPlayers } from './players';
import { createProjectiles } from './projectiles';
import { createRechargeCords } from './recharge-cords';
import { createRecruits } from './recruits';
import { createSpecials } from './specials';
import { createSpeakerCards } from './speaker-card';
import { createSpeakerGuide } from './speaker-guide';
import { createTutorialGuide } from './tutorial-guide';
import { createSpeakers } from './speakers';
import { createTrapKeys } from './trap-keys';
import { createTraps } from './traps';
import { createWeapons } from './weapons';
import { createWounds } from './wounds';
import type { EntityId } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { PotionBodies } from './potion-aura-model';
import { createPogo } from './pogo';
import { createCoupDeVent } from './vent';

const BOSSES = [createCouvreFeu, createBatterieAPlat, createCoupDeVent, createPogo];

export interface Families {
  readonly families: Family[];
  readonly potion: PotionBodies;
}

export function createFamilies(ctx: RenderContext, inset: boolean): Families {
  if (inset) {
    return createInsetFamilies(ctx);
  }
  const traps = createTraps(ctx);
  const enemies = createEnemies(ctx);
  const poseOf = (id: EntityId) => enemies.poseOf(id);
  const beforePlayers = [
    createGround(ctx),
    ...FULL_LOOKS.flatMap((look) => look.families(ctx)),
    createGroundWaves(ctx),
    createSpeakers(ctx),
    createCore(ctx),
    // Before the traps, whose destruction takes this layer's children with it.
    createRechargeCords(ctx),
    traps,
    createPickups(ctx),
    createPickupBursts(ctx),
    createCarriers(ctx),
    createBombs(ctx),
    createTwinVibes(ctx),
    createBattery(ctx),
    createPotion(ctx),
    createDice(ctx),
    createBystanders(ctx),
    createDancer(ctx),
    enemies,
    createRecruits(ctx, enemies.burst.bind(enemies)),
    createWounds(ctx, poseOf),
    ...BOSSES.map((create) => create(ctx, poseOf)),
    createSpecials(ctx),
    createProjectiles(ctx),
    createMood(ctx),
    ...FULL_FAMILIES.map((create) => create(ctx, poseOf)),
    createWeapons(ctx),
  ];
  const players = createPlayers(ctx);
  const families = [
    ...beforePlayers,
    players,
    createDownedScreen(ctx),
    createSpeakerCards(ctx),
    createMarkers(ctx),
    createSpeakerGuide(ctx),
    createTutorialGuide(ctx),
    createTrapKeys(ctx),
    createStageMarker(ctx),
    createEffects(ctx, (id) => traps.reachOf(id)),
    createHits(ctx, enemies),
    createClassEffects(ctx, (id, untilTick) => {
      enemies.blink(id, untilTick);
    }),
  ];
  return { families, potion: players.potion };
}

function createInsetFamilies(ctx: RenderContext): Families {
  const beforePlayers = [
    createGround(ctx),
    createEnemies(ctx),
    createProjectiles(ctx),
    createWeapons(ctx),
  ];
  const players = createPlayers(ctx);
  return { families: [...beforePlayers, players], potion: players.potion };
}
