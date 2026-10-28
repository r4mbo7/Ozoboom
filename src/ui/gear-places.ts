import type { GameContent } from '../data/types';
import type { PlayerState, SimState } from '../sim/state';
import { type WeaponPlace, weaponPlaces } from './cards';
import { createPlaceRow } from './weapon-place';

export interface GearPlaces {
  readonly element: HTMLElement;
  update(player: PlayerState, state: SimState, content: GameContent, slots: number): void;
  // The places of the offer being chosen, over those held; null gives the held ones back.
  offer(places: readonly WeaponPlace[] | null): void;
  landing(weaponId: string | null): HTMLElement | null;
}

export function createGearPlaces(): GearPlaces {
  const row = createPlaceRow('ui-hud__gear');
  let held: readonly WeaponPlace[] = [];
  let offered: readonly WeaponPlace[] | null = null;

  function placeOf(weaponId: string): HTMLElement | null {
    return row.element.querySelector(`.ui-place[data-state='held'][data-weapon='${weaponId}']`);
  }

  function pulse(player: PlayerState, state: SimState): void {
    for (const event of state.events) {
      if (event.type !== 'weaponFired' || event.playerId !== player.id) {
        continue;
      }
      const place = placeOf(event.weaponId);
      if (place !== null && place.dataset.continuous === undefined) {
        place.dataset.pulse = place.dataset.pulse === 'a' ? 'b' : 'a';
      }
    }
  }

  return {
    element: row.element,
    update(player, state, content, slots) {
      held = weaponPlaces(player, content, slots, undefined);
      row.show(offered ?? held);
      pulse(player, state);
    },
    offer(places) {
      offered = places;
      row.show(offered ?? held);
    },
    landing(weaponId) {
      const place = weaponId === null ? null : placeOf(weaponId);
      return place !== null && place.getClientRects().length > 0 ? place : null;
    },
  };
}
