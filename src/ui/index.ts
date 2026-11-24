import './ui.css';
import type { InputDevice, MenuIntents } from '../input/intents';
import { CLASSES } from '../data/classes';
import { setFraction, setOf } from '../sim/lineup';
import type { PlayerId } from '../sim/state';
import { type ClassInfo, swatchPortrait } from './class-picker';
import { type ClassPickerScreen, createClassPicker } from './class-screen';
import { el, setFlag } from './dom';
import { type EndScreen, createEnd } from './end';
import { type Hud, createHud } from './hud';
import { type LobbyScreen, createLobby } from './lobby';
import { type MenuGrace, createMenuGrace } from './menu-grace';
import { createMenuInput } from './navigation';
import { type NoticeScreen, createNotice } from './notice';
import { type ProgrammeScreen, createProgramme } from './programme/programme';
import { PROGRAMME_TABS } from './programme/tabs';
import type { Prompts } from './prompts';
import { classActions, lobbyActions, stageActions, titleActions } from './screen-actions';
import { type Screen, createShownScreen } from './shown-screen';
import { type StagePickerScreen, createStagePicker } from './stage';
import { createEntryOverlay } from './stage-entry';
import { createSunFollower } from './sun';
import { type TitleOptions, type TitleScreen, createTitle } from './title';
import { createTitleOptions } from './title-options';
import { t } from '../shared/i18n';
import type { GameContent, TrapDefinition } from '../data/types';
import { BROKEN_LINK, DOOR, TWO_VERSIONS } from './icons';
import type {
  CreatePortrait,
  LobbyModel,
  LocalPlayer,
  Notice,
  StagePickerModel,
  StepGuide,
  Ui,
  UiCallbacks,
  UiFrame,
} from './types';
import { type UpgradeOverlay, createUpgradeOverlay } from './upgrade';
import { veilStyle } from './veil';
import { keyTraps } from './key-traps';
import { lostWithoutMove, stillToMove } from './trap-lesson';

export type {
  ClassPickerModel,
  CreatePortrait,
  EndSession,
  LobbyModel,
  LocalPlayer,
  Notice,
  PickerSeat,
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
export { defaultName } from './lobby-model';
export { showRendererUnavailable } from './renderer-unavailable';

const NO_CALLERS: readonly PlayerId[] = [];

const notices = (): Readonly<Record<Notice, { title: string; text: string; glyph: string }>> => ({
  desync: {
    title: t('The two copies of the game drifted apart'),
    text: t(
      'The set stops for everyone rather than go on out of step. The report is ready in “Your feedback”.',
    ),
    glyph: TWO_VERSIONS,
  },
  hostLeft: {
    title: t('The host left the set'),
    text: t('Without them, the sound system goes dark.'),
    glyph: DOOR,
  },
  connectionLost: {
    title: t('Connection lost'),
    text: t('The link with the other players is cut.'),
    glyph: BROKEN_LINK,
  },
});

export function prefersCalmMode(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Screens {
  readonly title: TitleScreen;
  readonly programme: ProgrammeScreen;
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
  screens.programme.element.hidden = next !== 'programme';
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
  screens.programme.setDevice(device);
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
      screens.title.follow(frame.menuPosition ?? null, calm());
    },
    programme(edges) {
      screens.programme.handle(edges);
    },
    class(edges, frame) {
      screens.classPicker.update(edges, frame);
    },
    stage(edges) {
      screens.stagePicker.update(edges);
    },
    lobby(edges) {
      screens.lobby.update(edges);
    },
    notice(edges) {
      if (grace.over()) {
        screens.notice.menu.handle(edges);
      }
    },
    end(edges) {
      if (grace.over()) {
        screens.end.handle(edges);
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
  container.append(el('style', '', veilStyle()));
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
  let trapDefinitions: ReadonlyMap<string, TrapDefinition> = new Map();
  // The players on this screen, from the last frame, for the key each one presses.
  let localPlayers: readonly LocalPlayer[] = [];
  let shownKeyTraps: StepGuide['keyTraps'] = [];
  // The players of this game who never lifted a trap, null before its first step.
  let unmoved: readonly PlayerId[] | null = null;
  let tutorialGame = false;

  const feedback =
    callbacks.onFeedback === undefined
      ? undefined
      : (details?: string) => {
          menuInput.open();
          callbacks.onFeedback?.(details);
        };
  const screens = createScreens();
  const { title, programme, classPicker, stagePicker, lobby, notice, hud, end, upgrade } = screens;
  const menus = screenMenus(screens, grace, isCalm);
  const entry = createEntryOverlay(() => performance.now(), isCalm);
  container.append(
    hud.element,
    entry.element,
    upgrade.element,
    upgrade.effects,
    end.element,
    title.element,
    programme.element,
    classPicker.element,
    stagePicker.element,
    lobby.element,
    notice.element,
  );

  function createScreens(): Screens {
    // The app paints the masks and the characters and plays the specials; a harness without it
    // leaves their frames empty and Listen silent.
    const programme = createProgramme(
      prompts,
      PROGRAMME_TABS,
      {
        paintMask(canvas, enemyId) {
          callbacks.onPaintMask?.(canvas, enemyId);
        },
        playStage(setId) {
          callbacks.onListenStage?.(setId);
        },
        quiet() {
          callbacks.onListenStage?.(null);
        },
        paintClass(canvas, classId) {
          callbacks.onPaintClass?.(canvas, classId);
        },
        playSpecial(classId) {
          callbacks.onPlaySpecial?.(classId);
        },
        weaponSound(weaponId) {
          return callbacks.onWeaponSound?.(weaponId) ?? null;
        },
      },
      () => {
        showMenu('title');
      },
    );
    const title = createTitle(
      prompts,
      titleActions(callbacks, shown, options.actions, menuInput, feedback, () => {
        showMenu('programme');
        programme.open();
      }),
    );

    const classPicker = createClassPicker(
      prompts,
      classes,
      portrait,
      classActions(callbacks, shown),
      () => performance.now(),
    );
    const hud = createHud(prompts);
    const upgrade = createUpgradeOverlay({
      prompts,
      calm: isCalm,
      choose(playerId, upgradeId) {
        callbacks.onChooseUpgrade(playerId, upgradeId);
      },
      reroll(playerId) {
        callbacks.onRerollOffer(playerId);
      },
      cue(cue, variant) {
        callbacks.onUpgradeCue?.(cue, variant);
      },
      landing: (playerId, weaponId) => hud.landing(playerId, weaponId),
      offerPlaces: (playerId, places) => hud.offerPlaces(playerId, places),
      showWeapon: (canvas, weaponId, playerId) =>
        callbacks.onShowWeapon?.(canvas, weaponId, playerId) ?? null,
      showTrap: (canvas, trapIds, playerId) =>
        callbacks.onShowTrap?.(canvas, trapIds, playerId) ?? null,
    });
    const end = createEnd(
      prompts,
      { calm: isCalm, graceOver: () => grace.over() },
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
      (pseudo) => {
        callbacks.onBoardName(pseudo);
      },
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
    return { title, programme, classPicker, stagePicker, lobby, notice, hud, end, upgrade };
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

  // Between the title and the Programme: what was held when the screen changed waits for its release.
  function showMenu(next: 'title' | 'programme'): void {
    show(next);
    menuInput.open();
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
    showChangelogNews(news) {
      title.setChangelogNews(news);
    },
    // The screen first: a seat leaving beside friends all ready launches from setModel, and the game
    // it shows must stay on screen.
    showClassPicker(model) {
      openMenu('class', classPicker);
      classPicker.setModel(model);
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
      notice.show(t('Game interrupted'), content.title, content.text, {
        glyph: content.glyph,
        detail: details,
      });
      show('notice');
      grace.start();
      menuInput.open();
    },
    showGame(tutorial) {
      unmoved = null;
      tutorialGame = tutorial;
      hud.reset();
      hud.tutorial.reset(tutorial);
      sun.fix('nuit');
      show('game');
    },
    setLeaderboard(board) {
      title.setLeaderboard(board);
    },
    setBoardLine(line) {
      end.setBoardLine(line);
    },
    showEnd(state, session, best) {
      end.show(state, lastContent, session, best, lostWithoutMove(state, unmoved));
      sun.fix(state.status === 'won' ? 'jour' : 'nuit');
      show('end');
      grace.start();
      menuInput.open();
    },
    observeStep(state) {
      const tutorial = hud.tutorial.observe(state);
      unmoved = stillToMove(unmoved, state.players);
      // The tutorial asks one gesture at a time: the trap calls only when it is asked.
      const calling = !tutorialGame || tutorial === 'trap';
      if (lastContent !== null) {
        shownKeyTraps = keyTraps(
          state,
          lastContent,
          trapDefinitions,
          localPlayers,
          prompts,
          shownKeyTraps,
        );
      }
      return {
        tutorial,
        tutorialKey: hud.tutorial.askedKey(),
        trapCallers: calling ? unmoved : NO_CALLERS,
        keyTraps: shownKeyTraps,
      };
    },
    update(state, frame, content) {
      if (content !== lastContent) {
        trapDefinitions = new Map(content.traps.map((trap) => [trap.id, trap]));
      }
      lastContent = content;
      localPlayers = frame.players;
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
      // The HUD comes with the game, on the landing of its entry.
      hud.element.hidden = entry.update(frame.entry ?? null, state.core, frame.toScreen);
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
