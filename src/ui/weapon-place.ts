import { weaponGlyph } from '../data/weapon-glyphs';
import { t } from '../shared/i18n';
import type { WeaponPlace } from './cards';
import { el, icon, setFlag, setVar } from './dom';
import { formatNumber } from './format';

// The rank pearls sit on the ring's lower edge, this far apart, like the beads of a bracelet.
const PEARL_STEP_DEG = 28;

export interface PlaceRow {
  readonly element: HTMLElement;
  show(places: readonly WeaponPlace[]): void;
}

export function placesKey(places: readonly WeaponPlace[]): string {
  return places
    .map(
      (place) =>
        `${place.state}:${place.weapon?.id ?? ''}:${String(place.level)}:${String(place.lit)}`,
    )
    .join(',');
}

function spoken(place: WeaponPlace): string {
  return place.state === 'held' && place.weapon !== null
    ? t('{weapon}, niveau {level}', { weapon: place.label, level: formatNumber(place.level) })
    : place.label;
}

function pearls(place: WeaponPlace, maxLevel: number): HTMLElement {
  const row = el('span', 'ui-place__pearls');
  for (let rank = 1; rank <= maxLevel; rank += 1) {
    const pearl = el('span', 'ui-place__pearl');
    setVar(pearl, '--turn', `${String(((maxLevel + 1) / 2 - rank) * PEARL_STEP_DEG)}deg`);
    setFlag(pearl, 'on', rank <= place.level);
    setFlag(pearl, 'next', place.lit && rank === place.level + 1);
    row.append(pearl);
  }
  return row;
}

function weaponPlace(place: WeaponPlace): HTMLElement {
  const node = el('span', 'ui-place');
  node.dataset.state = place.state;
  setFlag(node, 'lit', place.lit);
  const ring = el('span', 'ui-place__ring');
  const { weapon } = place;
  if (weapon !== null) {
    node.dataset.weapon = weapon.id;
    setFlag(node, 'continuous', weapon.rhythm === 'continuous');
    ring.append(icon('ui-place__icon', weaponGlyph(weapon.effect)));
  }
  if (place.state === 'held' && weapon !== null) {
    node.title = t('{name} : {description}', {
      name: place.label,
      description: t(weapon.description),
    });
    ring.append(pearls(place, weapon.maxLevel));
  }
  node.append(ring, el('span', 'ui-place__label', place.label));
  return node;
}

// The places of the circus weapons, the same in the HUD and on the level screen.
export function createPlaceRow(className: string): PlaceRow {
  const element = el('section', className);
  element.setAttribute('role', 'img');
  let shown = '';
  return {
    element,
    show(places) {
      const key = placesKey(places);
      if (key === shown) {
        return;
      }
      shown = key;
      element.setAttribute(
        'aria-label',
        t('Tes agrès : {places}', { places: places.map(spoken).join(', ') }),
      );
      element.replaceChildren(...places.map(weaponPlace));
    },
  };
}
