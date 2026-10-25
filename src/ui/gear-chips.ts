import type { GameContent } from '../data/types';
import { t } from '../shared/i18n';
import type { PlayerState, SimState } from '../sim/state';
import { el, icon, setFlag } from './dom';
import { formatNumber } from './format';
import { type GearSlotView, gearSlots } from './hud-model';
import { weaponIcon } from './icons';

export interface GearChips {
  readonly element: HTMLElement;
  update(player: PlayerState, state: SimState, content: GameContent): void;
  landing(weaponId: string | null): HTMLElement | null;
}

function gearChip(view: GearSlotView): HTMLElement[] {
  if (view.weapon === null) {
    return [];
  }
  const chip = el('div', 'ui-gear');
  chip.setAttribute('role', 'img');
  const name = t(view.weapon.name);
  chip.setAttribute(
    'aria-label',
    t('{weapon}, niveau {level}', { weapon: name, level: formatNumber(view.level) }),
  );
  chip.title = t('{name} : {description}', { name, description: t(view.weapon.description) });
  chip.dataset.weapon = view.weapon.id;
  if (view.weapon.rhythm === 'continuous') {
    chip.dataset.continuous = '';
  }
  const dots = el('span', 'ui-gear__dots');
  for (let rank = 1; rank <= view.weapon.maxLevel; rank += 1) {
    const dot = el('span', 'ui-gear__dot');
    setFlag(dot, 'on', rank <= view.level);
    dots.append(dot);
  }
  chip.append(icon('ui-gear__icon', weaponIcon(view.weapon.effect)), dots);
  return [chip];
}

export function createGearChips(): GearChips {
  const element = el('section', 'ui-hud__gear');
  element.setAttribute('aria-label', t('Agrès'));
  let chips: HTMLElement[] = [];
  let gearKey: string | null = null;

  function pulse(player: PlayerState, state: SimState): void {
    for (const event of state.events) {
      if (event.type !== 'weaponFired' || event.playerId !== player.id) {
        continue;
      }
      const chip = chips.find((view) => view.dataset.weapon === event.weaponId);
      if (chip !== undefined && chip.dataset.continuous === undefined) {
        chip.dataset.pulse = chip.dataset.pulse === 'a' ? 'b' : 'a';
      }
    }
  }

  return {
    element,
    update(player, state, content) {
      const held = gearSlots(player, content).filter((view) => view.weapon !== null);
      const key = held.map((view) => `${view.weapon?.id ?? '-'}:${String(view.level)}`).join(',');
      if (key !== gearKey) {
        gearKey = key;
        chips = held.flatMap(gearChip);
        element.replaceChildren(...chips);
        element.hidden = chips.length === 0;
      }
      pulse(player, state);
    },
    landing(weaponId) {
      const chip = chips.find((candidate) => candidate.dataset.weapon === weaponId);
      return chip !== undefined && chip.getClientRects().length > 0 ? chip : null;
    },
  };
}
