import './ui.css';
import type { InputDevice } from '../input/intents';
import { setFraction, setOf } from '../sim/lineup';
import { el } from './dom';
import { createEnd } from './end';
import { createHud } from './hud';
import { createMenuInput } from './navigation';
import { createNotice } from './notice';
import { createSunFollower } from './sun';
import { createTitle } from './title';
import type { CreateUi, LobbyModel, Notice } from './types';
import type { GameContent } from '../data/types';
import { BROKEN_LINK, DOOR, TWO_VERSIONS } from './icons';
import { createUpgradeOverlay } from './upgrade';

export type {
  EndSession,
  LobbyModel,
  LobbySeat,
  LocalPlayer,
  Notice,
  Ui,
  UiCallbacks,
  UiFrame,
} from './types';
export { createFeedbackButton } from './feedback-button';
export { createSoundToggle } from './toggle';
export { selectTrap } from './navigation';

type Screen = 'title' | 'lobby' | 'game' | 'end' | 'notice';

const NOTICES: Readonly<Record<Notice, { title: string; text: string; glyph: string }>> = {
  desync: {
    title: 'Les deux versions de la partie ont divergé',
    text: 'Le set s’arrête pour tout le monde plutôt que de continuer de travers. Le rapport est prêt pour « Ton avis ».',
    glyph: TWO_VERSIONS,
  },
  hostLeft: {
    title: 'L’hôte a quitté le set',
    text: 'Sans lui, le sound system s’éteint.',
    glyph: DOOR,
  },
  connectionLost: {
    title: 'Connexion perdue',
    text: 'Le lien avec les autres joueurs est coupé.',
    glyph: BROKEN_LINK,
  },
};

function lobbyText(model: LobbyModel): string {
  const lines = [model.error ?? '', model.code === null ? '' : `Code du salon : ${model.code}`];
  lines.push(...model.seats.map((seat) => `${String(seat.playerId + 1)}. ${seat.name}`));
  return lines.filter((line) => line !== '').join(' · ');
}

const MENU_GRACE_MS = 500;

export function prefersCalmMode(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const createUi: CreateUi = (root, callbacks) => {
  const container = el('div', 'ui');
  root.append(container);
  const sun = createSunFollower(root);

  let screen: Screen = 'title';
  let calmMode = false;
  let muted = false;
  let device: InputDevice = 'none';
  let acted = false;
  let lastContent: GameContent | null = null;
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
      : (details?: string) => {
          menuInput.open();
          callbacks.onFeedback?.(details);
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
  const upgrade = createUpgradeOverlay((playerId, upgradeId) => {
    callbacks.onChooseUpgrade(playerId, upgradeId);
  });
  const end = createEnd(() => {
    once(() => {
      callbacks.onRestart();
    });
  }, feedback);
  const lobby = createNotice('Salon', () => {
    once(() => {
      callbacks.onLeaveLobby();
    });
  });
  const notice = createNotice(
    'Interruption',
    () => {
      once(() => {
        callbacks.onLeaveNotice();
      });
    },
    feedback,
  );
  container.append(
    hud.element,
    upgrade.element,
    end.element,
    title.element,
    lobby.element,
    notice.element,
  );

  function applyOptions(): void {
    root.classList.toggle('calm', calmMode);
    title.setOptions(calmMode, muted);
  }

  function applyDevice(next: InputDevice): void {
    device = next;
    title.setDevice(next);
    end.setDevice(next);
    lobby.setDevice(next);
    notice.setDevice(next);
  }

  function show(next: Screen): void {
    screen = next;
    acted = false;
    if (next === 'title') {
      sun.fix('nuit');
    }
    title.element.hidden = next !== 'title';
    lobby.element.hidden = next !== 'lobby';
    notice.element.hidden = next !== 'notice';
    hud.element.hidden = next !== 'game' && next !== 'notice';
    end.element.hidden = next !== 'end';
    upgrade.hide();
  }

  function updateLobby(model: LobbyModel): void {
    const name = model.mode === 'online' ? 'Salon en ligne' : 'Salon local';
    lobby.show('Salon', name, lobbyText(model));
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
    showLobby(model) {
      sun.fix('nuit');
      show('lobby');
      updateLobby(model);
      menuInput.open();
    },
    updateLobby,
    showNotice(kind, details) {
      const content = NOTICES[kind];
      notice.show('Partie interrompue', content.title, content.text, {
        glyph: content.glyph,
        detail: details,
      });
      show('notice');
      menuOpensAt = performance.now() + MENU_GRACE_MS;
      menuInput.open();
    },
    showGame() {
      hud.reset();
      sun.fix('nuit');
      show('game');
    },
    showEnd(state, session) {
      end.show(state, lastContent, session);
      sun.fix(state.status === 'won' ? 'jour' : 'nuit');
      show('end');
      menuOpensAt = performance.now() + MENU_GRACE_MS;
      menuInput.open();
    },
    update(state, frame, content) {
      lastContent = content;
      const snapshot = frame.snapshot;
      if (snapshot.device !== device) {
        applyDevice(snapshot.device);
      }
      const edges = menuInput.edges(snapshot.menu, snapshot.gameplay.move);

      if (screen === 'title') {
        title.menu.handle(edges);
        return;
      }
      if (screen === 'lobby') {
        lobby.menu.handle(edges);
        return;
      }
      if (screen === 'notice') {
        if (performance.now() >= menuOpensAt) {
          notice.menu.handle(edges);
        }
        return;
      }
      if (screen === 'end') {
        if (performance.now() >= menuOpensAt) {
          end.menu.handle(edges);
        }
        return;
      }

      hud.update(state, frame, content);
      sun.follow(setFraction(setOf(content, state.setId), state));
      upgrade.update(state, frame, content, performance.now());
    },
    destroy() {
      container.remove();
      root.classList.remove('calm');
      sun.clear();
    },
  };
};
