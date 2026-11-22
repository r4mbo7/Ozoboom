import type { GameContent } from '../data/types';
import { t } from '../shared/i18n';
import type { PlayerState, UpgradeOffer } from '../sim/state';
import type { Card } from './cards';
import { el, keycap } from './dom';
import { MARKS, namesIn } from './names-in';
import type { DevicePrompts } from './prompts';
import { statsSheetOf } from './stats-model';
import { type StatsSheetView, createStatsSheet } from './stats-sheet';

// The panel shows its cards, or the player's stats with the focused card taken.
export type OfferView = 'cards' | 'stats';

export interface OfferStats {
  readonly element: HTMLElement;
  readonly toggle: HTMLButtonElement;
  readonly view: OfferView;
  deal(models: readonly Card[]): void;
  show(next: OfferView): void;
  label(prompts: Pick<DevicePrompts, 'switchView' | 'style'>): void;
  fill(
    offer: UpgradeOffer,
    player: PlayerState,
    content: GameContent,
    ticksPerBeat: number,
    focused: number,
  ): void;
}

// The upgrade panel's view of the player's stats, which shares its box with the cards.
export function createOfferStats(panel: HTMLElement, cards: HTMLElement): OfferStats {
  // Turns the panel between its cards and the player's stats; outside the menu, so that the arrows
  // still walk the cards.
  const toggle = el('button', 'ui-offer__toggle');
  toggle.type = 'button';
  toggle.tabIndex = -1;
  const aim = el('p', 'ui-offer__aim');
  // A sheet for each card the stats can take, then one with none, stacked: the stats keep the
  // tallest's height whichever card they preview.
  const stack = el('div', 'ui-offer__sheets');
  const element = el('div', 'ui-offer__stats');
  element.append(aim, stack);

  let models: readonly Card[] = [];
  let sheets: readonly StatsSheetView[] = [];
  let view: OfferView = 'cards';
  // The card last named over the stats, and whether it changes none of their lines.
  let named = '';

  function show(next: OfferView): void {
    view = next;
    panel.dataset.view = next;
    // The view not shown keeps its room in the box, out of sight and out of reach.
    cards.toggleAttribute('inert', next === 'stats');
    element.toggleAttribute('inert', next === 'cards');
  }

  // The stats with the focused card taken, lit in its tint; no card is focused on a touch screen.
  function fill(
    offer: UpgradeOffer,
    player: PlayerState,
    content: GameContent,
    ticksPerBeat: number,
    focused: number,
  ): void {
    const model = models[focused];
    const shownAt = model === undefined ? models.length : focused;
    let unchanged = false;
    for (const [index, sheet] of sheets.entries()) {
      const taken = models[index];
      const preview =
        taken === undefined
          ? undefined
          : { id: taken.id, rarity: offer.rarities[index] ?? 'common' };
      const filled = statsSheetOf(player, content, ticksPerBeat, preview);
      if (filled === null) {
        throw new Error(`Player ${String(player.id)} plays the unknown class "${player.classId}"`);
      }
      sheet.update(filled);
      sheet.element.toggleAttribute('data-shown', index === shownAt);
      unchanged ||= index === shownAt && filled.unchanged;
    }
    const tint = model?.tint ?? 'common';
    if (element.dataset.tint !== tint) {
      element.dataset.tint = tint;
    }
    aim.toggleAttribute('data-blank', model === undefined);
    const naming = `${model?.name ?? ''}|${String(unchanged)}`;
    if (model !== undefined && naming !== named) {
      named = naming;
      aim.replaceChildren(
        namesIn('ui-offer__aimtext', t('Selected upgrade: {card}', { card: MARKS[0] }), [
          model.name,
          '',
        ]),
        // On the sheet's edge, where it takes none of the sheet's height.
        ...(unchanged ? [el('span', 'ui-offer__aimnote', t('No change to these stats'))] : []),
      );
    }
  }

  return {
    element,
    toggle,
    get view() {
      return view;
    },
    deal(dealt) {
      models = dealt;
      sheets = Array.from({ length: models.length + 1 }, () => createStatsSheet('panel'));
      stack.replaceChildren(...sheets.map((sheet) => sheet.element));
    },
    show,
    label({ switchView, style }) {
      toggle.replaceChildren(
        ...(switchView === '' ? [] : [keycap(switchView, style)]),
        el('span', 'ui-offer__togglelabel', view === 'cards' ? t('My stats') : t('Cards')),
      );
    },
    fill,
  };
}
