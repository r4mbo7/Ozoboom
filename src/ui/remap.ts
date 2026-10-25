import './ui.css';
import './remap.css';
import type { GamepadLike } from '../input/gamepad';
import type { InputDevice, InputSnapshot } from '../input/intents';
import type { KeyNames } from '../input/key-names';
import {
  GAMEPAD_ACTIONS,
  type KeyProfile,
  type Rebound,
  type Slot,
  rebindButton,
  rebindKey,
} from '../input/profile';
import { isOneOf } from '../shared/guards';
import { direction, t } from '../shared/i18n';
import { keysOf } from '../shared/records';
import { onPointerClick, setText } from './dom';
import { type SlotCapture, startCapture } from './remap-capture';
import { type Cell, createCellCursor } from './remap-cursor';
import {
  type Action,
  type Tab,
  defaultsFor,
  fixedKeysText,
  inputOf,
  listenText,
  settledText,
} from './remap-model';
import { type ListenedSlot, createRemapView } from './remap-view';
import { createMenuInput } from './navigation';
import type { Prompts } from './prompts';

export interface RemapOptions {
  device: InputDevice;
  profile: KeyProfile;
  prompts: Prompts;
  names: Pick<KeyNames, 'of' | 'learn'>;
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

interface Listening extends ListenedSlot {
  readonly capture: SlotCapture;
}

let screens = 0;

export function openRemap(root: HTMLElement, options: RemapOptions): RemapScreen {
  screens += 1;
  let profile = options.profile;
  let device: InputDevice = options.device;
  let tab: Tab = device === 'gamepad' ? 'gamepad' : 'keyboard';
  let listening: Listening | null = null;
  let closed = false;
  const menuInput = createMenuInput();
  menuInput.open();

  const view = createRemapView(`ui-remap-title-${String(screens)}`, options.prompts, options.names);
  for (const name of keysOf(view.tabs)) {
    onPointerClick(view.tabs[name], () => {
      showTab(name);
    });
  }
  const cells: readonly Cell[] = [
    ...view.slots.map(({ node, tab: on, action, slot }) => ({
      node,
      tab: on,
      activate: () => {
        listen(on, action, slot);
      },
    })),
    { node: view.swap.button, tab: 'gamepad', activate: swapSticks },
    { node: view.done, tab: null, activate: close },
    { node: view.reset, tab: null, activate: resetTab },
  ];
  const cursor = createCellCursor(
    cells,
    () => tab,
    () => listening !== null,
  );

  function swapSticks(): void {
    change({ ...profile, swapSticks: !profile.swapSticks });
    say(
      profile.swapSticks
        ? t('Tu marches au stick droit et tu vises au gauche.')
        : t('Tu marches au stick gauche et tu vises au droit.'),
    );
  }

  function resetTab(): void {
    change(defaultsFor(profile, tab));
    say(tab === 'keyboard' ? t('Touches par défaut remises.') : t('Boutons par défaut remis.'));
  }

  function say(text: string): void {
    view.status.toggleAttribute('data-fixed', text === '');
    setText(view.status, text === '' ? fixedKeysText(tab) : text);
  }

  function render(): void {
    view.paint(profile, listening);
    view.paintHint(device, listening);
  }

  function showTab(next: Tab): void {
    if (listening !== null) {
      return;
    }
    tab = next;
    view.showPanel(tab);
    say('');
    cursor.select(0);
  }

  function change(next: KeyProfile): void {
    profile = next;
    options.onChange(next);
    render();
  }

  function listen(on: Tab, action: Action, slot: Slot): void {
    listening = {
      tab: on,
      action,
      slot,
      capture: startCapture(window, options.names, on, {
        cancel,
        key: assignKey,
        button: assignButton,
        refused: (what) => {
          say(
            what === 'key'
              ? t('Cette touche garde son rôle, choisis-en une autre.')
              : t('Ce bouton garde son rôle, choisis-en un autre.'),
          );
        },
      }),
    };
    say(listenText(on, action));
    render();
  }

  function stopListening(): void {
    listening?.capture.stop();
    listening = null;
    // What was pressed to choose waits for its release before it walks the screen again.
    menuInput.open();
    render();
  }

  function assignKey(input: string | null): void {
    if (listening?.tab !== 'keyboard') {
      return;
    }
    const { action, slot } = listening;
    settle('keyboard', action, slot, input, rebindKey(profile, action, slot, input));
  }

  function assignButton(input: number): void {
    if (listening?.tab !== 'gamepad' || !isOneOf(listening.action, GAMEPAD_ACTIONS)) {
      return;
    }
    const { action, slot } = listening;
    settle('gamepad', action, slot, input, rebindButton(profile, listening.action, slot, input));
  }

  function settle(
    on: Tab,
    action: Action,
    slot: Slot,
    input: string | number | null,
    rebound: Rebound<Action>,
  ): void {
    const replaced = inputOf(profile, on, action, slot);
    stopListening();
    change(rebound.profile);
    if (rebound.moved !== null) {
      view.pulseMoved(on, rebound.moved.action, rebound.moved.slot);
    }
    say(settledText({ on, action, input, moved: rebound.moved, replaced }, options.names));
  }

  function cancel(): void {
    stopListening();
    say('');
  }

  function close(): void {
    if (closed) {
      return;
    }
    closed = true;
    if (listening !== null) {
      stopListening();
    }
    view.layer.remove();
    options.onClose();
  }

  showTab(tab);
  render();
  root.append(view.layer);

  return {
    update(input, pads) {
      if (closed) {
        return;
      }
      if (input.device !== device && input.device !== 'none') {
        device = input.device;
        view.paintHint(device, listening);
      }
      const edges = menuInput.edges(input.menu, input.gameplay.move);
      if (listening !== null) {
        // Escape never reaches the game while a slot listens: B cancels on the keyboard tab, and is a button like the others on the gamepad tab.
        if (listening.tab === 'keyboard' && edges.back) {
          cancel();
          return;
        }
        listening.capture.readPads(pads);
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
      cursor.handle(edges, direction());
    },
    close,
  };
}
