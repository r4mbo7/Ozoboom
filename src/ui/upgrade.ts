import type { GameContent } from '../data/types';
import type { InputDevice } from '../input/intents';
import type { PlayerState, UpgradeOffer } from '../sim/state';
import { el, fillHint, icon, setText } from './dom';
import { SIXTEENTHS_PER_BAR, type WeaponCard, cardFor, offerHeading, offerKicker } from './cards';
import { familyIcon, weaponIcon } from './icons';
import { type Menu, createMenu } from './menu';
import { promptsFor } from './prompts';

export interface UpgradeOverlay {
  readonly element: HTMLElement;
  readonly menu: Menu;
  readonly offer: UpgradeOffer | null;
  show(offer: UpgradeOffer, player: PlayerState | undefined, content: GameContent): void;
  setDevice(device: InputDevice): void;
  hide(): void;
}

export function createUpgradeOverlay(
  onChoose: (offer: UpgradeOffer, upgradeId: string) => void,
): UpgradeOverlay {
  const element = el('section', 'ui-screen ui-overlay ui-upgrade');
  element.setAttribute('aria-label', 'Choix d’amélioration');
  element.hidden = true;
  const kicker = el('p', 'ui-kicker');
  const heading = el('h2', 'ui-heading', 'Choisis ton amélioration');
  const cards = el('div', 'ui-cards');
  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-upgrade__body');
  body.append(kicker, heading, cards, hint);
  element.append(body);

  let current: UpgradeOffer | null = null;
  let device: InputDevice | null = null;

  const menu = createMenu((index) => {
    const upgradeId = current?.options[index];
    if (current !== null && upgradeId !== undefined) {
      onChoose(current, upgradeId);
    }
  });

  function strip(card: WeaponCard): HTMLElement {
    const { steps } = card;
    const label =
      steps === 'continuous'
        ? 'Joue en continu'
        : `Tire sur les doubles croches ${steps
            .flatMap((on, step) => (on ? [String(step + 1)] : []))
            .join(', ')}${card.everyBars > 1 ? `, une mesure sur ${String(card.everyBars)}` : ''}`;
    const row = el('span', 'ui-card__steps');
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', label);
    row.dataset.mode = steps === 'continuous' ? 'continuous' : 'steps';
    const cells = steps === 'continuous' ? Array<boolean>(SIXTEENTHS_PER_BAR).fill(true) : steps;
    row.append(
      ...cells.map((on, step) => {
        const cell = el('span', 'ui-card__step');
        cell.dataset.on = String(on);
        cell.dataset.beat = String(step % 4 === 0);
        return cell;
      }),
    );
    return row;
  }

  function card(
    id: string,
    offer: UpgradeOffer,
    player: PlayerState | undefined,
    content: GameContent,
  ) {
    const model = cardFor(id, offer, player, content);
    const button = el('button', 'ui-card');
    button.type = 'button';
    button.dataset.kind = model.kind;
    button.dataset.tint = model.tint;
    if (model.kind === 'upgrade') {
      button.dataset.family = model.family;
    }
    const glyph =
      model.kind === 'upgrade' ? familyIcon(model.family) : weaponIcon(model.weapon.effect);
    const familyRow = el('span', 'ui-card__family');
    familyRow.append(icon('ui-card__glyph', glyph), el('span', 'ui-card__label', model.label));
    if (model.rarityLabel !== null) {
      familyRow.append(el('span', 'ui-card__rarity', model.rarityLabel));
    }
    const foot = el('span', 'ui-card__foot');
    foot.append(
      el(
        'span',
        'ui-card__rank',
        model.kind === 'fusion' ? `Remplace ${model.replaces}` : model.rank,
      ),
      el('span', 'ui-card__cta', 'Choisir'),
    );
    button.append(familyRow, el('span', 'ui-card__name', model.name));
    if (model.kind === 'fusion') {
      button.append(el('span', 'ui-card__recipe', `B2B : ${model.recipe}`));
    }
    button.append(el('span', 'ui-card__desc', model.description));
    if (model.kind === 'weapon') {
      button.append(strip(model));
    }
    button.append(foot);
    return button;
  }

  return {
    element,
    menu,
    get offer() {
      return current;
    },
    show(offer, player, content) {
      element.hidden = false;
      if (offer === current) {
        return;
      }
      current = offer;
      setText(kicker, offerKicker(offer, player));
      const buttons = offer.options.map((id) => card(id, offer, player, content));
      cards.dataset.count = String(buttons.length);
      cards.dataset.offer = offer.kind ?? 'levelUp';
      setText(heading, offerHeading(offer));
      cards.replaceChildren(...buttons);
      menu.setItems(buttons);
    },
    setDevice(next) {
      if (next === device) {
        return;
      }
      device = next;
      const prompts = promptsFor(next);
      fillHint(
        hint,
        [
          { keys: prompts.navigateRow, label: 'choisir', screen: 'wide' },
          { keys: prompts.navigate, label: 'choisir', screen: 'narrow' },
          { keys: [prompts.confirm], label: 'valider' },
        ],
        prompts.style,
      );
    },
    hide() {
      element.hidden = true;
      current = null;
    },
  };
}
