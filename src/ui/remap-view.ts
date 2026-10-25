import type { InputDevice } from '../input/intents';
import type { KeyNames } from '../input/key-names';
import type { GamepadAction, KeyProfile, KeyboardAction, Slot } from '../input/profile';
import { t } from '../shared/i18n';
import { keysOf } from '../shared/records';
import { button, el, fillHint, keycap } from './dom';
import type { Prompts } from './prompts';
import { type Action, ACTION_NAMES, type Tab, inputOf, nameOf } from './remap-model';
import { type Toggle, createToggle } from './toggle';

interface Group<A extends Action> {
  readonly name: () => string;
  readonly actions: readonly A[];
  // Across both columns, its rows side by side.
  readonly wide?: true;
}

const KEYBOARD_GROUPS: readonly Group<KeyboardAction>[] = [
  { name: () => t('Se déplacer'), actions: ['moveUp', 'moveDown', 'moveLeft', 'moveRight'] },
  { name: () => t('Agir'), actions: ['fire', 'placeTrap', 'skill', 'dash'] },
  { name: () => t('Pièges'), actions: ['previousTrap', 'nextTrap'], wide: true },
];

const GAMEPAD_GROUPS: readonly Group<GamepadAction>[] = [
  { name: () => t('Agir'), actions: ['fire', 'placeTrap', 'skill', 'dash'] },
  { name: () => t('Pièges'), actions: ['previousTrap', 'nextTrap'] },
];

export interface SlotButton {
  readonly node: HTMLButtonElement;
  readonly tab: Tab;
  readonly action: Action;
  readonly slot: Slot;
}

export type ListenedSlot = Pick<SlotButton, 'tab' | 'action' | 'slot'>;

export interface RemapView {
  readonly layer: HTMLElement;
  readonly tabs: Readonly<Record<Tab, HTMLButtonElement>>;
  readonly slots: readonly SlotButton[];
  readonly swap: Toggle;
  readonly done: HTMLButtonElement;
  readonly reset: HTMLButtonElement;
  readonly status: HTMLElement;
  showPanel(tab: Tab): void;
  paint(profile: KeyProfile, listening: ListenedSlot | null): void;
  paintHint(device: InputDevice, listening: ListenedSlot | null): void;
  pulseMoved(tab: Tab, action: Action, slot: Slot): void;
}

export function createRemapView(
  titleId: string,
  prompts: Prompts,
  names: Pick<KeyNames, 'of'>,
): RemapView {
  const layer = el('div', 'ui ui-remap-layer');
  const element = el('section', 'ui-screen ui-overlay ui-remap');
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-labelledby', titleId);
  layer.append(element);

  const title = el('h2', 'ui-heading', t('Contrôles'));
  title.id = titleId;
  const header = el('header', 'ui-remap__header');
  header.append(el('p', 'ui-kicker', t('Réglages')), title);

  const tabRow = el('div', 'ui-remap__tabrow');
  const before = el('span', 'ui-remap__tabkey');
  const after = el('span', 'ui-remap__tabkey');
  const tabList = el('div', 'ui-remap__tabs');
  tabList.setAttribute('role', 'tablist');
  const tabs: Readonly<Record<Tab, HTMLButtonElement>> = {
    keyboard: button('ui-remap__tab', t('Clavier et souris')),
    gamepad: button('ui-remap__tab', t('Manette')),
  };
  for (const name of keysOf(tabs)) {
    tabs[name].setAttribute('role', 'tab');
  }
  tabList.append(tabs.keyboard, tabs.gamepad);
  tabRow.append(before, tabList, after);

  const slots: SlotButton[] = [];
  const panels: Readonly<Record<Tab, HTMLElement>> = {
    keyboard: panel('keyboard', KEYBOARD_GROUPS, slots),
    gamepad: panel('gamepad', GAMEPAD_GROUPS, slots),
  };
  const swap = createToggle(
    t('Inverser les sticks'),
    t('Marcher au stick droit, viser au gauche'),
    t('Oui'),
    t('Non'),
  );
  swap.button.tabIndex = -1;
  // Under the trap buttons: the two columns end level.
  panels.gamepad.lastElementChild?.append(swap.button);

  const status = el('p', 'ui-remap__status');
  status.setAttribute('role', 'status');

  const reset = button('ui-button ui-remap__secondary', t('Remettre par défaut'));
  const done = button('ui-button ui-button--primary', t('Fermer'));
  const actions = el('div', 'ui-remap__actions');
  actions.append(done, reset);

  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-remap__body');
  body.append(header, tabRow, panels.keyboard, panels.gamepad, status, actions, hint);
  element.append(body);

  return {
    layer,
    tabs,
    slots,
    swap,
    done,
    reset,
    status,
    showPanel(tab) {
      for (const name of keysOf(tabs)) {
        tabs[name].setAttribute('aria-selected', String(name === tab));
      }
      panels.keyboard.hidden = tab !== 'keyboard';
      panels.gamepad.hidden = tab !== 'gamepad';
    },
    paint(profile, listening) {
      for (const slot of slots) {
        paintSlot(slot, profile, listening, names);
      }
      swap.set(profile.swapSticks);
    },
    paintHint(device, listening) {
      if (listening !== null) {
        fillHint(
          hint,
          listening.tab === 'keyboard'
            ? [
                { keys: [t('Échap')], label: t('annuler') },
                { keys: [t('Retour arrière')], label: t('vider') },
              ]
            : [{ keys: ['Start'], label: t('annuler') }],
          listening.tab === 'keyboard' ? 'key' : 'button',
        );
        return;
      }
      const shown = prompts.for(device);
      before.replaceChildren(
        ...(shown.tabs[0] === undefined ? [] : [keycap(shown.tabs[0], shown.style)]),
      );
      after.replaceChildren(
        ...(shown.tabs[1] === undefined ? [] : [keycap(shown.tabs[1], shown.style)]),
      );
      fillHint(
        hint,
        [
          { keys: shown.navigate, label: t('naviguer') },
          { keys: [shown.confirm], label: t('changer') },
          { keys: [shown.back], label: t('fermer') },
        ],
        shown.style,
      );
    },
    pulseMoved(tab, action, slot) {
      const moved = slots.find(
        (other) => other.tab === tab && other.action === action && other.slot === slot,
      )?.node;
      moved?.removeAttribute('data-moved');
      // Reading the layout starts the animation again on a second swap.
      moved?.getBoundingClientRect();
      moved?.setAttribute('data-moved', '');
    },
  };
}

function panel(on: Tab, groups: readonly Group<Action>[], slots: SlotButton[]): HTMLElement {
  const node = el('div', 'ui-remap__panel');
  node.setAttribute('role', 'tabpanel');
  for (const group of groups) {
    const section = el('section', 'ui-remap__group');
    section.toggleAttribute('data-wide', group.wide === true);
    section.append(el('h3', 'ui-remap__group-name', group.name()));
    for (const action of group.actions) {
      const row = el('div', 'ui-remap__row');
      row.append(el('span', 'ui-remap__action', ACTION_NAMES[action]()));
      for (const slot of [0, 1] as const) {
        const slotNode = button('ui-remap__slot', '');
        slots.push({ node: slotNode, tab: on, action, slot });
        row.append(slotNode);
      }
      section.append(row);
    }
    node.append(section);
  }
  return node;
}

function paintSlot(
  { node, tab, action, slot }: SlotButton,
  profile: KeyProfile,
  listening: ListenedSlot | null,
  names: Pick<KeyNames, 'of'>,
): void {
  const isListening =
    listening?.tab === tab && listening.action === action && listening.slot === slot;
  const input = inputOf(profile, tab, action, slot);
  node.toggleAttribute('data-listening', isListening);
  node.toggleAttribute('data-empty', input === null && !isListening);
  node.setAttribute(
    'aria-label',
    t('{action}, touche {number} : {key}', {
      action: ACTION_NAMES[action](),
      number: slot + 1,
      key: input === null ? t('aucune') : nameOf(tab, input, names),
    }),
  );
  if (isListening) {
    node.replaceChildren(el('span', 'ui-remap__waiting', t('Appuie…')));
  } else if (input === null) {
    node.replaceChildren();
  } else {
    node.replaceChildren(keycap(nameOf(tab, input, names), tab === 'keyboard' ? 'key' : 'button'));
  }
}
