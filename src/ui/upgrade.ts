import type { GameContent, UpgradeFamily } from '../data/types';
import type { InputDevice } from '../input/intents';
import type { PlayerState, UpgradeOffer } from '../sim/state';
import { el, fillHint, icon, setText } from './dom';
import { familyIcon } from './icons';
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

const FAMILY_LABEL: Record<UpgradeFamily, string> = {
  class: 'Classe',
  generic: 'Générique',
  defense: 'Défense',
  relic: 'Relique',
};

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

  function card(upgradeId: string, player: PlayerState | undefined, content: GameContent) {
    const definition = content.upgrades.find((entry) => entry.id === upgradeId);
    const button = el('button', 'ui-card');
    button.type = 'button';
    const family = definition?.family ?? 'generic';
    button.dataset.family = family;
    const familyRow = el('span', 'ui-card__family');
    const className =
      family === 'class'
        ? content.classes.find((entry) => entry.id === definition?.classId)?.name
        : undefined;
    familyRow.append(
      icon('ui-card__glyph', familyIcon(family)),
      el(
        'span',
        '',
        className === undefined ? FAMILY_LABEL[family] : `${FAMILY_LABEL[family]} · ${className}`,
      ),
    );
    const stacks = player?.upgrades.filter((id) => id === upgradeId).length ?? 0;
    const maxStacks = definition?.maxStacks ?? 1;
    const foot = el('span', 'ui-card__foot');
    foot.append(
      el(
        'span',
        'ui-card__rank',
        stacks === 0 ? 'Nouveau' : `Rang ${String(stacks + 1)} sur ${String(maxStacks)}`,
      ),
      el('span', 'ui-card__cta', 'Choisir'),
    );
    button.append(
      familyRow,
      el('span', 'ui-card__name', definition?.name ?? upgradeId),
      el('span', 'ui-card__desc', definition?.description ?? ''),
      foot,
    );
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
      setText(kicker, player === undefined ? 'Niveau supérieur' : `Niveau ${String(player.level)}`);
      const buttons = offer.options.map((id) => card(id, player, content));
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
