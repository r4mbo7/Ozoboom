import './ui.css';
import type { InputDevice, MenuIntents } from '../input/intents';
import { CLASSES } from '../data/classes';
import { setFraction, setOf } from '../sim/lineup';
import { type ClassInfo, swatchPortrait } from './class-picker';
import { type ClassPickerScreen, createClassPicker } from './class-screen';
import { el, setFlag } from './dom';
import { type EndScreen, createEnd } from './end';
import { type Hud, createHud } from './hud';
import { type LobbyScreen, createLobby } from './lobby';
import { type MenuGrace, createMenuGrace } from './menu-grace';
import { createMenuInput } from './navigation';
import { type NoticeScreen, createNotice } from './notice';
import type { Prompts } from './prompts';
import { classActions, lobbyActions, stageActions, titleActions } from './screen-actions';
import { type Screen, createShownScreen } from './shown-screen';
import { type StagePickerScreen, createStagePicker } from './stage';
import { createSunFollower } from './sun';
import { type TitleOptions, type TitleScreen, createTitle } from './title';
import { createTitleOptions } from './title-options';
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
  UiFrame,
} from './types';
import { type UpgradeOverlay, createUpgradeOverlay } from './upgrade';
import { lostWithoutTrap } from './trap-lesson';

export type {
  ClassPickerModel,
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
export { defaultName } from './lobby-model';

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

export function prefersCalmMode(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Screens {
  readonly title: TitleScreen;
  readonly classPicker: ClassPickerScreen;
  readonly stagePicker: StagePickerScreen;
  readonly lobby: LobbyScreen;
  readonly notice: NoticeScreen;
  readonly hud: Hud;
  readonly end: EndScreen;
  readonly upgrade: UpgradeOverlay;
}

type ScreenMenu = (edges: MenuIntents, frame: UiFrame) => void;

function reveal(screens: Screens, next: Screen): void {
  screens.title.element.hidden = next !== 'title';
  screens.classPicker.element.hidden = next !== 'class';
  screens.stagePicker.element.hidden = next !== 'stage';
  screens.lobby.element.hidden = next !== 'lobby';
  screens.notice.element.hidden = next !== 'notice';
  screens.hud.element.hidden = next !== 'game' && next !== 'notice';
  screens.end.element.hidden = next !== 'end';
  screens.upgrade.hide();
}

function showDevice(screens: Screens, device: InputDevice): void {
  screens.title.setDevice(device);
  screens.end.setDevice(device);
  screens.classPicker.setDevice(device);
  screens.stagePicker.setDevice(device);
  screens.lobby.setDevice(device);
  screens.notice.setDevice(device);
}

function screenMenus(
  screens: Screens,
  grace: MenuGrace,
  calm: () => boolean,
): Readonly<Record<Exclude<Screen, 'game'>, ScreenMenu>> {
  return {
    title(edges, frame) {
      screens.title.handle(edges);
      screens.title.follow(calm() ? null : (frame.menuPosition ?? null));
    },
    class(edges) {
      screens.classPicker.update(edges);
    },
    stage(edges) {
      screens.stagePicker.update(edges);
    },
    lobby(edges, frame) {
      screens.lobby.update(frame, edges);
    },
    notice(edges) {
      if (grace.over()) {
        screens.notice.menu.handle(edges);
      }
    },
    end(edges) {
      if (grace.over()) {
        screens.end.menu.handle(edges);
      }
    },
  };
}

// Only a harness offers other classes than the data ones; without a portrait maker, each class shows as a disc of its colour.
export function createUi(
  root: HTMLElement,
  callbacks: UiCallbacks,
  prompts: Prompts,
  classes: readonly ClassInfo[] = CLASSES,
  portrait: CreatePortrait = () => swatchPortrait(classes),
): Ui {
  const container = el('div', 'ui');
  root.append(container);
  const sun = createSunFollower(root);
  const shown = createShownScreen('title');
  const menuInput = createMenuInput();
  const grace = createMenuGrace(() => performance.now());
  const options = createTitleOptions(callbacks, applyOptions);
  const isCalm = () => options.calmMode() || prefersCalmMode();
  let device: InputDevice = 'none';
  let keysShown = prompts.version();
  let lastContent: GameContent | null = null;
  // A trap stood on the field during this game: its end screen needs no lesson.
  let trapStood = false;

  const feedback =
    callbacks.onFeedback === undefined
      ? undefined
      : (details?: string) => {
          menuInput.open();
          callbacks.onFeedback?.(details);
        };
  const screens = createScreens();
  const { title, classPicker, stagePicker, lobby, notice, hud, end, upgrade } = screens;
  const menus = screenMenus(screens, grace, isCalm);
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

  function createScreens(): Screens {
    const title = createTitle(
      prompts,
      titleActions(callbacks, shown, options.actions, menuInput, feedback),
    );
    const classPicker = createClassPicker(
      prompts,
      classes,
      portrait,
      classActions(callbacks, shown),
    );
    const hud = createHud(prompts);
    const upgrade = createUpgradeOverlay({
      prompts,
      calm: isCalm,
      choose(playerId, upgradeId) {
        callbacks.onChooseUpgrade(playerId, upgradeId);
      },
      cue(cue, variant) {
        callbacks.onUpgradeCue?.(cue, variant);
      },
      landing: (playerId, weaponId) => hud.landing(playerId, weaponId),
      offerPlaces: (playerId, places) => hud.offerPlaces(playerId, places),
      showWeapon: (canvas, weaponId, playerId) =>
        callbacks.onShowWeapon?.(canvas, weaponId, playerId) ?? null,
    });
    const end = createEnd(
      prompts,
      shown.once(() => {
        callbacks.onRestart();
      }),
      shown.once(() => {
        callbacks.onBackToLobby();
      }),
      shown.once(() => {
        callbacks.onQuit();
      }),
      shown.once(() => {
        callbacks.onLearn();
      }),
      feedback,
    );
    const lobby = createLobby(prompts, lobbyActions(callbacks, shown), classes, portrait);
    const stagePicker = createStagePicker(prompts, stageActions(callbacks, shown));
    const notice = createNotice(
      prompts,
      t('Interruption'),
      shown.once(() => {
        callbacks.onLeaveNotice();
      }),
      feedback,
    );
    return { title, classPicker, stagePicker, lobby, notice, hud, end, upgrade };
  }

  function applyOptions(current: TitleOptions): void {
    root.classList.toggle('calm', current.calmMode);
    title.setOptions(current);
  }

  function applyDevice(next: InputDevice): void {
    device = next;
    keysShown = prompts.version();
    setFlag(root, 'touch', next === 'touch');
    showDevice(screens, next);
  }

  function show(next: Screen): void {
    shown.show(next);
    if (next === 'title') {
      sun.fix('nuit');
    }
    reveal(screens, next);
  }

  function openMenu(next: 'class' | 'stage', menu: ClassPickerScreen | StagePickerScreen): void {
    if (shown.current() !== next) {
      menu.open();
      sun.fix('nuit');
      show(next);
      menuInput.open();
    }
  }

  function updateLobby(model: LobbyModel): void {
    lobby.setModel(model);
  }

  options.apply();
  applyDevice(device);
  show('title');

  return {
    showTitle({ device: shownDevice, ...shownOptions }) {
      options.apply(shownOptions);
      applyDevice(shownDevice);
      show('title');
      title.open('main');
    },
    showVisits(count) {
      title.setVisits(count);
    },
    showClassPicker(model) {
      classPicker.setModel(model);
      openMenu('class', classPicker);
    },
    showStagePicker(model: StagePickerModel) {
      stagePicker.setModel(model);
      openMenu('stage', stagePicker);
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
      grace.start();
      menuInput.open();
    },
    showGame(tutorial) {
      trapStood = false;
      hud.reset();
      hud.tutorial.reset(tutorial);
      sun.fix('nuit');
      show('game');
    },
    showEnd(state, session, best) {
      end.show(state, lastContent, session, best, lostWithoutTrap(state, trapStood));
      sun.fix(state.status === 'won' ? 'jour' : 'nuit');
      show('end');
      grace.start();
      menuInput.open();
    },
    observeStep(state) {
      return hud.tutorial.observe(state);
    },
    update(state, frame, content) {
      lastContent = content;
      const snapshot = frame.snapshot;
      if (snapshot.device !== device || keysShown !== prompts.version()) {
        applyDevice(snapshot.device);
      }
      const edges = menuInput.edges(snapshot.menu, snapshot.gameplay.move);
      const screen = shown.current();
      if (screen !== 'game') {
        menus[screen](edges, frame);
        return;
      }
      trapStood ||= state.traps.length > 0;
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
