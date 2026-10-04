import './ui.css';
import type { InputDevice } from '../input/intents';
import type { UpgradeOffer } from '../sim/state';
import { el } from './dom';
import { createEnd } from './end';
import { createHud } from './hud';
import { createMenuInput } from './navigation';
import { createTitle } from './title';
import type { CreateUi } from './types';
import { createUpgradeOverlay } from './upgrade';

export type { Ui, UiCallbacks } from './types';
export { createFeedbackButton } from './feedback-button';
export { createSoundToggle } from './toggle';
export { selectTrap } from './navigation';

type Screen = 'title' | 'game' | 'end';

const MENU_GRACE_MS = 500;

export function prefersCalmMode(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const createUi: CreateUi = (root, callbacks) => {
  const container = el('div', 'ui');
  root.append(container);

  let screen: Screen = 'title';
  let calmMode = false;
  let muted = false;
  let device: InputDevice = 'none';
  let acted = false;
  let chosenOffer: UpgradeOffer | null = null;
  const menuInput = createMenuInput();
  let menuOpensAt = 0;

  function once(action: () => void): void {
    if (!acted) {
      acted = true;
      action();
    }
  }

  const feedback =
    callbacks.onFeedback === undefined
      ? undefined
      : () => {
          menuInput.open();
          callbacks.onFeedback?.();
        };

  const title = createTitle({
    ...(feedback === undefined ? {} : { feedback }),
    start() {
      once(() => {
        callbacks.onStart();
      });
    },
    toggleCalmMode() {
      calmMode = !calmMode;
      applyOptions();
      callbacks.onToggleCalmMode(calmMode);
    },
    toggleMute() {
      muted = !muted;
      applyOptions();
      callbacks.onToggleMute(muted);
    },
  });
  const hud = createHud();
  const upgrade = createUpgradeOverlay((offer, upgradeId) => {
    if (chosenOffer !== offer) {
      chosenOffer = offer;
      callbacks.onChooseUpgrade(offer.playerId, upgradeId);
    }
  });
  const end = createEnd(() => {
    once(() => {
      callbacks.onRestart();
    });
  }, feedback);
  container.append(hud.element, upgrade.element, end.element, title.element);

  function applyOptions(): void {
    root.classList.toggle('calm', calmMode);
    title.setOptions(calmMode, muted);
  }

  function applyDevice(next: InputDevice): void {
    device = next;
    title.setDevice(next);
    upgrade.setDevice(next);
    end.setDevice(next);
  }

  function show(next: Screen): void {
    screen = next;
    acted = false;
    title.element.hidden = next !== 'title';
    hud.element.hidden = next !== 'game';
    end.element.hidden = next !== 'end';
    upgrade.hide();
    chosenOffer = null;
  }

  applyOptions();
  applyDevice(device);
  show('title');

  return {
    showTitle(options) {
      calmMode = options.calmMode;
      muted = options.muted;
      applyOptions();
      applyDevice(options.device);
      show('title');
      title.menu.select(0);
    },
    showGame() {
      hud.reset();
      show('game');
    },
    showEnd(state) {
      end.show(state);
      show('end');
      menuOpensAt = performance.now() + MENU_GRACE_MS;
      menuInput.open();
    },
    update(state, snapshot, content) {
      if (snapshot.device !== device) {
        applyDevice(snapshot.device);
      }
      const edges = menuInput.edges(snapshot.menu, snapshot.gameplay.move);

      if (screen === 'title') {
        title.menu.handle(edges);
        return;
      }
      if (screen === 'end') {
        if (performance.now() >= menuOpensAt) {
          end.menu.handle(edges);
        }
        return;
      }

      hud.update(state, snapshot, content);
      const offer = state.status === 'choosingUpgrade' ? state.pendingUpgrades[0] : undefined;
      if (offer === undefined) {
        upgrade.hide();
        chosenOffer = null;
        return;
      }
      if (offer !== upgrade.offer) {
        menuOpensAt = performance.now() + MENU_GRACE_MS;
        menuInput.open();
      }
      upgrade.show(
        offer,
        state.players.find((player) => player.id === offer.playerId),
        content,
      );
      if (offer !== chosenOffer && performance.now() >= menuOpensAt) {
        upgrade.menu.handle(edges);
      }
    },
    destroy() {
      container.remove();
      root.classList.remove('calm');
    },
  };
};
