import './ui.css';
import type { InputDevice } from '../input/intents';
import { CLASSES } from '../data/classes';
import { setFraction, setOf } from '../sim/lineup';
import { type ClassInfo, swatchPortrait } from './class-picker';
import { createClassPicker } from './class-screen';
import { el, setFlag } from './dom';
import { createEnd } from './end';
import { createHud } from './hud';
import { createLobby } from './lobby';
import { createMenuInput } from './navigation';
import { createNotice } from './notice';
import { promptsVersion } from './prompts';
import { createStagePicker } from './stage';
import { createSunFollower } from './sun';
import { createTitle } from './title';
import { t } from '../shared/i18n';
import type { GameContent } from '../data/types';
import { BROKEN_LINK, DOOR, TWO_VERSIONS } from './icons';
import type {
  CreatePortrait,
  LobbyModel,
  Notice,
  StagePickerModel,
  Ui,
  UiCallbacks,
} from './types';
import { createUpgradeOverlay } from './upgrade';
import { VOLUME_STEPS, type SoundLevel, stepSound } from './volume';

export type {
  ClassPickerModel,
  ClassPortrait,
  CreatePortrait,
  EndSession,
  LobbyModel,
  LobbySeat,
  LocalPlayer,
  Notice,
  StageCard,
  StagePickerModel,
  Ui,
  UiCallbacks,
  UiFrame,
} from './types';
export { createControlsButton, createFeedbackButton } from './feedback-button';
export { type RemapScreen, openRemap } from './remap';
export { createAutoAimToggle, createAutoFireToggle, createHitSoundToggle } from './toggle';
export { VOLUME_STEPS, createSoundControl, stepSound, type SoundLevel } from './volume';
export { heldSlot, selectTrap } from './navigation';
export { SEAT_IDS, defaultName } from './lobby-model';

type Screen = 'title' | 'class' | 'stage' | 'lobby' | 'game' | 'end' | 'notice';

const notices = (): Readonly<Record<Notice, { title: string; text: string; glyph: string }>> => ({
  desync: {
    title: t('Les deux versions de la partie ont divergé'),
    text: t(
      'Le set s’arrête pour tout le monde plutôt que de continuer de travers. Le rapport est prêt pour « Ton avis ».',
    ),
    glyph: TWO_VERSIONS,
  },
  hostLeft: {
    title: t('L’hôte a quitté le set'),
    text: t('Sans lui, le sound system s’éteint.'),
    glyph: DOOR,
  },
  connectionLost: {
    title: t('Connexion perdue'),
    text: t('Le lien avec les autres joueurs est coupé.'),
    glyph: BROKEN_LINK,
  },
});

const MENU_GRACE_MS = 500;

export function prefersCalmMode(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// The classes offered are the data ones: only a harness shows others. Without a portrait maker
// (the game draws them), each class shows as a disc of its colour.
export function createUi(
  root: HTMLElement,
  callbacks: UiCallbacks,
  classes: readonly ClassInfo[] = CLASSES,
  portrait: CreatePortrait = () => swatchPortrait(classes),
): Ui {
  const container = el('div', 'ui');
  root.append(container);
  const sun = createSunFollower(root);

  let screen: Screen = 'title';
  let calmMode = false;
  let muted = false;
  let volume = VOLUME_STEPS;
  let hitSound = false;
  let autoFire = false;
  let autoAim = false;
  let device: InputDevice = 'none';
  let keysShown = promptsVersion();
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
    playTogether() {
      callbacks.onPlayTogether();
    },
    toggleCalmMode() {
      calmMode = !calmMode;
      applyOptions();
      callbacks.onToggleCalmMode(calmMode);
    },
    toggleMute() {
      setSound({ volume, muted: !muted });
    },
    stepVolume(side) {
      setSound(stepSound({ volume, muted }, side));
    },
    toggleHitSound() {
      hitSound = !hitSound;
      applyOptions();
      callbacks.onToggleHitSound(hitSound);
    },
    toggleAutoFire() {
      autoFire = !autoFire;
      applyOptions();
      callbacks.onToggleAutoFire(autoFire);
    },
    toggleAutoAim() {
      autoAim = !autoAim;
      applyOptions();
      callbacks.onToggleAutoAim(autoAim);
    },
    controls() {
      menuInput.open();
      callbacks.onControls();
    },
    chooseLocale(next) {
      callbacks.onChooseLocale(next);
    },
  });
  const classPicker = createClassPicker(classes, portrait, {
    choose(classId) {
      callbacks.onChooseClass(classId);
    },
    toggleEndless(enabled) {
      callbacks.onToggleEndless(enabled);
    },
    confirm() {
      once(() => {
        callbacks.onConfirmClass();
      });
    },
    leave() {
      once(() => {
        callbacks.onLeaveClassPicker();
      });
    },
  });
  const hud = createHud();
  const isCalm = () => calmMode || prefersCalmMode();
  const upgrade = createUpgradeOverlay({
    calm: isCalm,
    choose(playerId, upgradeId) {
      callbacks.onChooseUpgrade(playerId, upgradeId);
    },
    cue(cue, variant) {
      callbacks.onUpgradeCue?.(cue, variant);
    },
    landing: (playerId, weaponId) => hud.landing(playerId, weaponId),
  });
  const end = createEnd(
    () => {
      once(() => {
        callbacks.onRestart();
      });
    },
    () => {
      once(() => {
        callbacks.onQuit();
      });
    },
    feedback,
  );
  const lobby = createLobby(
    {
      joinSeat(device) {
        callbacks.onJoinSeat(device);
      },
      leaveSeat(playerId) {
        callbacks.onLeaveSeat(playerId);
      },
      seatClass(playerId, classId) {
        callbacks.onSeatClass(playerId, classId);
      },
      seatName(playerId, name) {
        callbacks.onSeatName(playerId, name);
      },
      chooseStage(setId) {
        callbacks.onChooseStage(setId);
      },
      chooseNight(night) {
        callbacks.onChooseNight(night);
      },
      ...(callbacks.onGoOnline === undefined
        ? {}
        : {
            goOnline() {
              callbacks.onGoOnline?.();
            },
          }),
      createRoom() {
        callbacks.onCreateRoom();
      },
      joinRoom(code) {
        callbacks.onJoinRoom(code);
      },
      launch() {
        once(() => {
          callbacks.onLaunch();
        });
      },
      leave() {
        once(() => {
          callbacks.onLeaveLobby();
        });
      },
    },
    classes,
    portrait,
  );
  const stagePicker = createStagePicker({
    choose(setId) {
      callbacks.onChooseStage(setId);
    },
    chooseNight(night) {
      callbacks.onChooseNight(night);
    },
    confirm() {
      once(() => {
        callbacks.onConfirmStage();
      });
    },
    leave() {
      once(() => {
        callbacks.onLeaveStagePicker();
      });
    },
  });
  const notice = createNotice(
    t('Interruption'),
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
    upgrade.effects,
    end.element,
    title.element,
    classPicker.element,
    stagePicker.element,
    lobby.element,
    notice.element,
  );

  function applyOptions(): void {
    root.classList.toggle('calm', calmMode);
    title.setOptions({ calmMode, muted, volume, hitSound, autoFire, autoAim });
  }

  function setSound(next: SoundLevel): void {
    const before = { volume, muted };
    ({ volume, muted } = next);
    applyOptions();
    if (next.muted !== before.muted) {
      callbacks.onToggleMute(muted);
    }
    if (next.volume !== before.volume) {
      callbacks.onSetVolume(volume);
    }
  }

  function applyDevice(next: InputDevice): void {
    device = next;
    keysShown = promptsVersion();
    setFlag(root, 'touch', next === 'touch');
    title.setDevice(next);
    end.setDevice(next);
    classPicker.setDevice(next);
    stagePicker.setDevice(next);
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
    classPicker.element.hidden = next !== 'class';
    stagePicker.element.hidden = next !== 'stage';
    lobby.element.hidden = next !== 'lobby';
    notice.element.hidden = next !== 'notice';
    hud.element.hidden = next !== 'game' && next !== 'notice';
    end.element.hidden = next !== 'end';
    upgrade.hide();
  }

  function updateLobby(model: LobbyModel): void {
    lobby.setModel(model);
  }

  applyOptions();
  applyDevice(device);
  show('title');

  return {
    showTitle(options) {
      calmMode = options.calmMode;
      muted = options.muted;
      volume = options.volume;
      hitSound = options.hitSound;
      autoFire = options.autoFire;
      autoAim = options.autoAim;
      applyOptions();
      applyDevice(options.device);
      show('title');
      title.menu.select(0);
    },
    showVisits(count) {
      title.setVisits(count);
    },
    showClassPicker(model) {
      classPicker.setModel(model);
      if (screen !== 'class') {
        classPicker.open();
        sun.fix('nuit');
        show('class');
        menuInput.open();
      }
    },
    showStagePicker(model: StagePickerModel) {
      stagePicker.setModel(model);
      if (screen !== 'stage') {
        stagePicker.open();
        sun.fix('nuit');
        show('stage');
        menuInput.open();
      }
    },
    showLobby(model) {
      sun.fix('nuit');
      show('lobby');
      updateLobby(model);
      lobby.open();
      menuInput.open();
    },
    updateLobby,
    showNotice(kind, details) {
      const content = notices()[kind];
      notice.show(t('Partie interrompue'), content.title, content.text, {
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
      if (snapshot.device !== device || keysShown !== promptsVersion()) {
        applyDevice(snapshot.device);
      }
      const edges = menuInput.edges(snapshot.menu, snapshot.gameplay.move);

      if (screen === 'title') {
        title.handle(edges);
        title.follow(isCalm() ? null : (frame.menuPosition ?? null));
        return;
      }
      if (screen === 'class') {
        classPicker.update(edges);
        return;
      }
      if (screen === 'stage') {
        stagePicker.update(edges);
        return;
      }
      if (screen === 'lobby') {
        lobby.update(frame, edges);
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
}
