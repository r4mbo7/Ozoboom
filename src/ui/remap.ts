import './ui.css';
import './remap.css';
import type { MenuDirection } from '../input/bindings';
import type { GamepadLike } from '../input/gamepad';
import type { InputDevice, InputSnapshot } from '../input/intents';
import { buttonName, inputName, learnKeyName } from '../input/key-names';
import {
  DEFAULT_KEY_PROFILE,
  GAMEPAD_ACTIONS,
  KEYBOARD_ACTIONS,
  type GamepadAction,
  type KeyProfile,
  type KeyboardAction,
  type Slot,
  isBindableButton,
  isReservedKey,
  rebindButton,
  rebindKey,
} from '../input/profile';
import { direction, t } from '../shared/i18n';
import { el, fillHint, keycap, setText } from './dom';
import { onMouseMove } from './pointer';
import { promptsFor } from './prompts';
import { createToggle } from './toggle';
import { createMenuInput } from './navigation';

export interface RemapOptions {
  device: InputDevice;
  profile: KeyProfile;
  onChange(profile: KeyProfile): void;
  onClose(): void;
}

export interface RemapScreen {
  update(
    input: Pick<InputSnapshot, 'menu' | 'device' | 'gameplay'>,
    pads: readonly (GamepadLike | null)[],
  ): void;
  close(): void;
}

type Tab = 'keyboard' | 'gamepad';

type Action = KeyboardAction | GamepadAction;

interface Cell {
  readonly node: HTMLButtonElement;
  // Null for the buttons of both tabs.
  readonly tab: Tab | null;
  readonly activate: () => void;
}

interface Listening {
  readonly tab: Tab;
  readonly action: Action;
  readonly slot: Slot;
  // The gamepad buttons down on the last update, null before the first: a button counts as it
  // goes down, never one held since the slot was chosen.
  held: ReadonlySet<string> | null;
}

const ACTION_NAMES: Readonly<Record<Action, () => string>> = {
  moveUp: () => t('Haut'),
  moveDown: () => t('Bas'),
  moveLeft: () => t('Gauche'),
  moveRight: () => t('Droite'),
  fire: () => t('Tirer'),
  placeTrap: () => t('Poser le piège'),
  skill: () => t('Spéciale'),
  dash: () => t('Dash'),
  nextTrap: () => t('Piège suivant'),
  previousTrap: () => t('Piège précédent'),
};

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

const START_BUTTON = 9;

let screens = 0;

function button(className: string, text: string): HTMLButtonElement {
  const node = el('button', className, text);
  node.type = 'button';
  node.tabIndex = -1;
  return node;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// The nearest box on that side, the one most in line first: rows and columns stay walkable however
// the screen lays them out.
export function stepInDirection(boxes: readonly Box[], from: number, side: MenuDirection): number {
  const origin = boxes[from];
  if (origin === undefined) {
    return from;
  }
  const ox = origin.x + origin.width / 2;
  const oy = origin.y + origin.height / 2;
  let best = from;
  let bestScore = Infinity;
  boxes.forEach((box, index) => {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const vertical = side === 'up' || side === 'down';
    const along = { up: oy - cy, down: cy - oy, left: ox - cx, right: cx - ox }[side];
    const across = vertical ? Math.abs(cx - ox) : Math.abs(cy - oy);
    if (index === from || along < 1) {
      return;
    }
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

export function openRemap(root: HTMLElement, options: RemapOptions): RemapScreen {
  screens += 1;
  const titleId = `ui-remap-title-${String(screens)}`;
  let profile = options.profile;
  let device: InputDevice = options.device;
  let tab: Tab = device === 'gamepad' ? 'gamepad' : 'keyboard';
  let listening: Listening | null = null;
  let closed = false;
  let index = 0;
  const menuInput = createMenuInput();
  menuInput.open();

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
  for (const [name, node] of Object.entries(tabs) as [Tab, HTMLButtonElement][]) {
    node.setAttribute('role', 'tab');
    node.addEventListener('click', (event) => {
      if (event.detail !== 0) {
        showTab(name);
      }
    });
  }
  tabList.append(tabs.keyboard, tabs.gamepad);
  tabRow.append(before, tabList, after);

  const cells: Cell[] = [];
  const slotNodes = new Map<string, HTMLButtonElement>();
  const slotKey = (on: Tab, action: Action, slot: Slot) => `${on}:${action}:${String(slot)}`;

  function panel(on: Tab, groups: readonly Group<Action>[]): HTMLElement {
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
          slotNodes.set(slotKey(on, action, slot), slotNode);
          cells.push({
            node: slotNode,
            tab: on,
            activate: () => {
              listen(on, action, slot);
            },
          });
          row.append(slotNode);
        }
        section.append(row);
      }
      node.append(section);
    }
    return node;
  }

  const keyboardPanel = panel('keyboard', KEYBOARD_GROUPS);
  const gamepadPanel = panel('gamepad', GAMEPAD_GROUPS);
  const swap = createToggle(
    t('Inverser les sticks'),
    t('Marcher au stick droit, viser au gauche'),
    t('Oui'),
    t('Non'),
  );
  swap.button.tabIndex = -1;
  // Under the trap buttons: the two columns end level.
  gamepadPanel.lastElementChild?.append(swap.button);
  cells.push({
    node: swap.button,
    tab: 'gamepad',
    activate: () => {
      change({ ...profile, swapSticks: !profile.swapSticks });
      say(
        profile.swapSticks
          ? t('Tu marches au stick droit et tu vises au gauche.')
          : t('Tu marches au stick gauche et tu vises au droit.'),
      );
    },
  });

  // What stays fixed, until a change has something to say.
  const status = el('p', 'ui-remap__status');
  status.setAttribute('role', 'status');

  const reset = button('ui-button ui-remap__secondary', t('Remettre par défaut'));
  const done = button('ui-button ui-button--primary', t('Fermer'));
  const actions = el('div', 'ui-remap__actions');
  actions.append(done, reset);
  cells.push({ node: done, tab: null, activate: close });
  cells.push({
    node: reset,
    tab: null,
    activate: () => {
      change(
        tab === 'keyboard'
          ? { ...profile, keyboard: DEFAULT_KEY_PROFILE.keyboard }
          : { ...profile, gamepad: DEFAULT_KEY_PROFILE.gamepad, swapSticks: false },
      );
      say(tab === 'keyboard' ? t('Touches par défaut remises.') : t('Boutons par défaut remis.'));
    },
  });

  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-remap__body');
  body.append(header, tabRow, keyboardPanel, gamepadPanel, status, actions, hint);
  element.append(body);

  function visibleCells(): Cell[] {
    return cells.filter((cell) => cell.tab === null || cell.tab === tab);
  }

  function select(next: number): void {
    const visible = visibleCells();
    index = Math.min(Math.max(next, 0), visible.length - 1);
    for (const cell of cells) {
      cell.node.removeAttribute('aria-current');
    }
    visible[index]?.node.setAttribute('aria-current', 'true');
  }

  for (const cell of cells) {
    onMouseMove(cell.node, () => {
      const position = visibleCells().indexOf(cell);
      if (listening === null && position >= 0 && position !== index) {
        select(position);
      }
    });
    cell.node.addEventListener('click', (event) => {
      const position = visibleCells().indexOf(cell);
      if (event.detail === 0 || listening !== null || position < 0) {
        return;
      }
      select(position);
      cell.activate();
    });
  }

  function fixedKeys(): string {
    return tab === 'keyboard'
      ? t(
          'Toujours là : Échap pour la pause, 1 à 5 pour les pièges, les flèches et Entrée dans les menus.',
        )
      : t('Toujours là : Start pour la pause, la croix pour les gestes, A et B dans les menus.');
  }

  function say(text: string): void {
    status.toggleAttribute('data-fixed', text === '');
    setText(status, text === '' ? fixedKeys() : text);
  }

  function nameOf(on: Tab, input: string | number | null): string {
    if (input === null) {
      return '';
    }
    return on === 'keyboard' ? inputName(String(input)) : buttonName(Number(input));
  }

  function inputOf(on: Tab, action: Action, slot: Slot): string | number | null {
    return on === 'keyboard'
      ? profile.keyboard[action][slot]
      : profile.gamepad[action as GamepadAction][slot];
  }

  function render(): void {
    for (const on of ['keyboard', 'gamepad'] as const) {
      const actionsOf: readonly Action[] = on === 'keyboard' ? KEYBOARD_ACTIONS : GAMEPAD_ACTIONS;
      for (const action of actionsOf) {
        for (const slot of [0, 1] as const) {
          const node = slotNodes.get(slotKey(on, action, slot));
          if (node === undefined) {
            continue;
          }
          const isListening =
            listening?.tab === on && listening.action === action && listening.slot === slot;
          const input = inputOf(on, action, slot);
          node.toggleAttribute('data-listening', isListening);
          node.toggleAttribute('data-empty', input === null && !isListening);
          node.setAttribute(
            'aria-label',
            t('{action}, touche {number} : {key}', {
              action: ACTION_NAMES[action](),
              number: slot + 1,
              key: input === null ? t('aucune') : nameOf(on, input),
            }),
          );
          if (isListening) {
            node.replaceChildren(el('span', 'ui-remap__waiting', t('Appuie…')));
          } else if (input === null) {
            node.replaceChildren();
          } else {
            node.replaceChildren(keycap(nameOf(on, input), on === 'keyboard' ? 'key' : 'button'));
          }
        }
      }
    }
    swap.set(profile.swapSticks);
    showHint();
  }

  function showHint(): void {
    const prompts = promptsFor(device);
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
    before.replaceChildren(
      ...(prompts.tabs[0] === undefined ? [] : [keycap(prompts.tabs[0], prompts.style)]),
    );
    after.replaceChildren(
      ...(prompts.tabs[1] === undefined ? [] : [keycap(prompts.tabs[1], prompts.style)]),
    );
    fillHint(
      hint,
      [
        { keys: prompts.navigate, label: t('naviguer') },
        { keys: [prompts.confirm], label: t('changer') },
        { keys: [prompts.back], label: t('fermer') },
      ],
      prompts.style,
    );
  }

  function showTab(next: Tab): void {
    if (listening !== null) {
      return;
    }
    tab = next;
    for (const [name, node] of Object.entries(tabs) as [Tab, HTMLButtonElement][]) {
      node.setAttribute('aria-selected', String(name === tab));
    }
    keyboardPanel.hidden = tab !== 'keyboard';
    gamepadPanel.hidden = tab !== 'gamepad';
    say('');
    select(0);
  }

  function change(next: KeyProfile): void {
    profile = next;
    options.onChange(next);
    render();
  }

  function listen(on: Tab, action: Action, slot: Slot): void {
    listening = { tab: on, action, slot, held: null };
    say(
      on === 'keyboard'
        ? t('{action} : appuie sur une touche, un bouton de la souris ou la molette.', {
            action: ACTION_NAMES[action](),
          })
        : t('{action} : appuie sur un bouton de la manette.', { action: ACTION_NAMES[action]() }),
    );
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    render();
  }

  function stopListening(): void {
    listening = null;
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('wheel', onWheel, true);
    // What was pressed to choose waits for its release before it walks the screen again.
    menuInput.open();
    render();
  }

  function assign(input: string | number | null): void {
    if (listening === null) {
      return;
    }
    const { tab: on, action, slot } = listening;
    const replaced = inputOf(on, action, slot);
    const rebound =
      on === 'keyboard'
        ? rebindKey(profile, action, slot, input as string | null)
        : rebindButton(profile, action as GamepadAction, slot, input as number | null);
    stopListening();
    change(rebound.profile);
    if (rebound.moved !== null) {
      const moved = slotNodes.get(slotKey(on, rebound.moved.action, rebound.moved.slot));
      moved?.removeAttribute('data-moved');
      // Reading the layout starts the animation again on a second swap.
      moved?.getBoundingClientRect();
      moved?.setAttribute('data-moved', '');
    }
    const name = ACTION_NAMES[action]();
    if (input === null) {
      say(t('{action} : case vidée.', { action: name }));
    } else if (rebound.moved === null) {
      say(t('{key} va à {action}.', { key: nameOf(on, input), action: name }));
    } else if (replaced === null) {
      say(
        t('{key} va à {action} et quitte {other}.', {
          key: nameOf(on, input),
          action: name,
          other: ACTION_NAMES[rebound.moved.action](),
        }),
      );
    } else {
      say(
        t('{key} va à {action}, {other} prend {old}.', {
          key: nameOf(on, input),
          action: name,
          other: ACTION_NAMES[rebound.moved.action](),
          old: nameOf(on, replaced),
        }),
      );
    }
  }

  function cancel(): void {
    stopListening();
    say('');
  }

  function onKeyDown(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat || listening === null) {
      return;
    }
    if (event.code === 'Escape') {
      cancel();
    } else if (listening.tab !== 'keyboard') {
      return;
    } else if (event.code === 'Backspace' || event.code === 'Delete') {
      assign(null);
    } else if (isReservedKey(event.code)) {
      say(t('Cette touche garde son rôle, choisis-en une autre.'));
    } else {
      if (!(event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)) {
        learnKeyName(event.code, event.key);
      }
      assign(event.code);
    }
  }

  // The click that follows the press would choose a slot again: whichever of them the button
  // makes, they come with its release, and go no further.
  function swallowClicks(): void {
    const kinds = ['click', 'auxclick', 'contextmenu'] as const;
    const swallow = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    for (const kind of kinds) {
      window.addEventListener(kind, swallow, true);
    }
    window.addEventListener(
      'mouseup',
      () => {
        setTimeout(() => {
          for (const kind of kinds) {
            window.removeEventListener(kind, swallow, true);
          }
        }, 0);
      },
      { capture: true, once: true },
    );
  }

  // On the gamepad tab, a click lets go of the slot.
  function onMouseDown(event: MouseEvent): void {
    if (listening === null) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    swallowClicks();
    if (listening.tab === 'keyboard') {
      assign(`Mouse${String(event.button)}`);
    } else {
      cancel();
    }
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (listening?.tab !== 'keyboard' || event.deltaY === 0) {
      return;
    }
    assign(event.deltaY > 0 ? 'WheelDown' : 'WheelUp');
  }

  function listenToPads(pads: readonly (GamepadLike | null)[]): void {
    if (listening === null) {
      return;
    }
    const down = new Set<string>();
    for (const pad of pads) {
      if (pad?.connected !== true) {
        continue;
      }
      pad.buttons.forEach((state, number) => {
        if (state.pressed) {
          down.add(`${String(pad.index)}:${String(number)}`);
        }
      });
    }
    const before = listening.held;
    listening.held = down;
    const pressed = before === null ? undefined : [...down].find((id) => !before.has(id));
    if (pressed === undefined || listening.tab !== 'gamepad') {
      return;
    }
    const number = Number(pressed.split(':')[1]);
    if (number === START_BUTTON) {
      cancel();
    } else if (isBindableButton(number)) {
      assign(number);
    } else {
      say(t('Ce bouton garde son rôle, choisis-en un autre.'));
    }
  }

  function close(): void {
    if (closed) {
      return;
    }
    closed = true;
    if (listening !== null) {
      stopListening();
    }
    layer.remove();
    options.onClose();
  }

  showTab(tab);
  render();
  root.append(layer);

  return {
    update(input, pads) {
      if (closed) {
        return;
      }
      if (input.device !== device && input.device !== 'none') {
        device = input.device;
        showHint();
      }
      const edges = menuInput.edges(input.menu, input.gameplay.move);
      if (listening !== null) {
        // Escape never reaches the game while a slot listens: on the keyboard tab, B cancels. On the
        // gamepad tab, B is a button like the others.
        if (listening.tab === 'keyboard' && edges.back) {
          cancel();
          return;
        }
        listenToPads(pads);
        return;
      }
      if (edges.back) {
        close();
        return;
      }
      if (edges.previous !== edges.next) {
        showTab(tab === 'keyboard' ? 'gamepad' : 'keyboard');
        return;
      }
      // The menus read left and right along the reading direction: the boxes are laid out on screen.
      const rtl = direction() === 'rtl';
      const side: MenuDirection | null = edges.up
        ? 'up'
        : edges.down
          ? 'down'
          : (rtl ? edges.right : edges.left)
            ? 'left'
            : (rtl ? edges.left : edges.right)
              ? 'right'
              : null;
      const visible = visibleCells();
      if (side !== null) {
        const next = stepInDirection(
          visible.map((cell) => cell.node.getBoundingClientRect()),
          index,
          side,
        );
        if (next !== index) {
          select(next);
          visible[next]?.node.scrollIntoView({ block: 'nearest' });
        }
      }
      if (edges.confirm) {
        visible[index]?.activate();
      }
    },
    close,
  };
}
