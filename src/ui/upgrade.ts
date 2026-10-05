import type { GameContent } from '../data/types';
import type { InputDevice, InputSnapshot } from '../input/intents';
import type { PlayerId, PlayerState, SimState, UpgradeOffer } from '../sim/state';
import { el, fillHint, icon, setFlag, setText } from './dom';
import {
  SIXTEENTHS_PER_BAR,
  type WeaponCard,
  cardFor,
  offerHeading,
  offerKicker,
  waitingFor,
} from './cards';
import { playerLabel } from './hud-model';
import { familyIcon, weaponIcon } from './icons';
import { type Menu, createMenu } from './menu';
import { type MenuInput, createMenuInput } from './navigation';
import { promptsFor } from './prompts';
import type { UiFrame } from './types';
import { createWho, fillWho, whoColor } from './who';

export interface UpgradeOverlay {
  readonly element: HTMLElement;
  // Shows the offer of each player of this screen side by side, each driven by that player's own
  // snapshot, and who the others are still waited for. Hides itself when nobody is choosing.
  update(state: SimState, frame: UiFrame, content: GameContent, now: number): void;
  hide(): void;
}

const MENU_GRACE_MS = 500;

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
): HTMLButtonElement {
  const model = cardFor(id, offer, player, content);
  const button = el('button', 'ui-card');
  button.type = 'button';
  button.dataset.id = id;
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

// The offer of one player of this screen. It keeps its place once the choice is made, until the
// others have chosen too.
interface Panel {
  readonly element: HTMLElement;
  readonly input: MenuInput;
  readonly visible: boolean;
  readonly done: boolean;
  update(
    offer: UpgradeOffer | undefined,
    player: PlayerState | undefined,
    content: GameContent,
    snapshot: InputSnapshot,
    team: boolean,
    now: number,
  ): void;
  reset(): void;
}

function createPanel(onChoose: (upgradeId: string) => void): Panel {
  const element = el('div', 'ui-upgrade__body ui-offer');
  element.hidden = true;
  const who = createWho();
  const kicker = el('p', 'ui-kicker');
  const heading = el('h2', 'ui-heading', 'Choisis ton amélioration');
  const cards = el('div', 'ui-cards');
  const hint = el('p', 'ui-hint');
  element.append(who, kicker, heading, cards, hint);

  const input = createMenuInput();
  let current: UpgradeOffer | null = null;
  let chosen: string | null = null;
  let opensAt = 0;
  let device: InputDevice | null = null;
  let buttons: readonly HTMLButtonElement[] = [];

  const menu: Menu = createMenu((index) => {
    const upgradeId = current?.options[index];
    if (current !== null && upgradeId !== undefined && chosen === null) {
      chosen = upgradeId;
      markChosen();
      onChoose(upgradeId);
    }
  });

  function markChosen(): void {
    element.dataset.state = chosen === null ? 'choosing' : 'chosen';
    for (const button of buttons) {
      const picked = button.dataset.id === chosen;
      setFlag(button, 'chosen', picked);
      const cta = button.querySelector('.ui-card__cta');
      if (cta instanceof HTMLElement) {
        setText(cta, picked ? 'Choisi' : 'Choisir');
      }
    }
    hint.hidden = chosen !== null;
  }

  function fillHints(next: InputDevice): void {
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
  }

  function reset(): void {
    current = null;
    chosen = null;
    element.hidden = true;
  }

  return {
    element,
    input,
    get visible() {
      return current !== null;
    },
    get done() {
      return chosen !== null;
    },
    update(offer, player, content, snapshot, team, now) {
      const edges = input.edges(snapshot.menu, snapshot.gameplay.move);
      if (offer === undefined) {
        if (chosen === null) {
          reset();
        }
        return;
      }
      fillHints(snapshot.device);
      if (offer !== current) {
        current = offer;
        chosen = null;
        opensAt = now + MENU_GRACE_MS;
        input.open();
        setText(kicker, offerKicker(offer, player));
        buttons = offer.options.map((id) => card(id, offer, player, content));
        cards.dataset.count = String(buttons.length);
        cards.dataset.offer = offer.kind ?? 'levelUp';
        setText(heading, offerHeading(offer));
        cards.replaceChildren(...buttons);
        menu.setItems(buttons);
        markChosen();
      }
      element.hidden = false;
      who.hidden = !team;
      if (team && player !== undefined) {
        fillWho(who, player);
        element.style.setProperty('--who', whoColor(player.classId));
      }
      if (chosen === null && now >= opensAt) {
        menu.handle(edges);
      }
    },
    reset,
  };
}

export function createUpgradeOverlay(
  onChoose: (playerId: PlayerId, upgradeId: string) => void,
): UpgradeOverlay {
  const element = el('section', 'ui-screen ui-overlay ui-upgrade');
  element.setAttribute('aria-label', 'Choix d’amélioration');
  element.hidden = true;
  const body = el('div', 'ui-offers');
  const panelsRow = el('div', 'ui-offers__panels');
  const remoteRow = el('div', 'ui-offers__remote');
  const wait = el('p', 'ui-offers__wait');
  wait.setAttribute('role', 'status');
  body.append(panelsRow, remoteRow, wait);
  element.append(body);

  const panels = new Map<PlayerId, Panel>();

  function panelOf(playerId: PlayerId): Panel {
    let panel = panels.get(playerId);
    if (panel === undefined) {
      panel = createPanel((upgradeId) => {
        onChoose(playerId, upgradeId);
      });
      panels.set(playerId, panel);
      panelsRow.append(panel.element);
    }
    return panel;
  }

  function hide(): void {
    element.hidden = true;
    for (const panel of panels.values()) {
      panel.reset();
    }
  }

  return {
    element,
    update(state, frame, content, now) {
      const offers = state.status === 'choosingUpgrade' ? state.pendingUpgrades : [];
      // A frame without players of its own still drives the one offer there is.
      const locals =
        frame.players.length > 0
          ? frame.players
          : offers.slice(0, 1).map((offer) => ({
              playerId: offer.playerId,
              snapshot: frame.snapshot,
            }));
      const team = state.players.length > 1;

      for (const local of locals) {
        panelOf(local.playerId).update(
          offers.find((offer) => offer.playerId === local.playerId),
          state.players.find((player) => player.id === local.playerId),
          content,
          local.snapshot,
          team,
          now,
        );
      }
      if (offers.length === 0) {
        hide();
        return;
      }

      const shown = locals.map((local) => panelOf(local.playerId)).filter((panel) => panel.visible);
      panelsRow.dataset.count = String(shown.length);
      setFlag(panelsRow, 'multi', shown.length > 1);
      const remote = offers
        .filter((offer) => !locals.some((local) => local.playerId === offer.playerId))
        .map((offer) => {
          const player = state.players.find((candidate) => candidate.id === offer.playerId);
          return player === undefined
            ? `Joueur ${String(offer.playerId + 1)}`
            : playerLabel(player);
        });
      const waiting = waitingFor(
        remote,
        shown.every((panel) => panel.done),
      );
      remoteRow.replaceChildren(
        ...waiting.choosing.map((line) => el('span', 'ui-offers__chip', line)),
      );
      remoteRow.hidden = waiting.choosing.length === 0;
      setText(wait, waiting.waiting ?? '');
      wait.hidden = waiting.waiting === null;
      element.hidden = false;
    },
    hide,
  };
}
