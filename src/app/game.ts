import { locale } from '../shared/i18n';
import { EIGHTH_SECONDS } from '../audio/ambience';
import {
  APP_VERSION,
  buildFeedbackReport,
  feedbackMeta,
  githubFormLink,
  openFeedback,
} from '../feedback';
import type { OnlineMeta } from '../feedback/report';
import { TRACKS } from '../data/tracks';
import type { GameContent, SetDefinition } from '../data/types';
import { createInputHub } from '../input/hub';
import { navigatorGamepads } from '../input/gamepad';
import type { DeviceId, InputSnapshot } from '../input/intents';
import { createKeyNames, learnKeyboardLayout } from '../input/key-names';
import { createPlayerKeys } from '../input/profile';
import { createPortraits, createRenderer } from '../render';
import type { GameEvent, GameMode } from '../shared/stats';
import { TICK_MS } from '../shared/tempo';
import { scoreOf } from '../sim/score';
import { setOf, setTempo } from '../sim/lineup';
import { parseJoinCode } from '../net/code';
import { createLocalSource } from '../net/local';
import type { CommandSource } from '../net/types';
import { GUEST_BUFFER_TICKS } from '../net/lockstep';
import type { CameraFocus, Renderer } from '../render/types';
import type { PlayerSlot } from '../sim/initial-state';
import type { PlayerId, SimState } from '../sim/state';
import {
  type ClassPickerModel,
  type EndSession,
  type LobbyModel,
  type StagePickerModel,
  type LocalPlayer,
  type StageCard,
  type UiFrame,
  VOLUME_STEPS,
  createUi,
  openRemap,
  prefersCalmMode,
} from '../ui';
import { type DevOptions, benchSlots, createDevProbe, devScene } from './dev';
import { createBackgroundPlay } from './background-play';
import { createDefeatFade } from './defeat-fade';
import { createDialogs } from './dialogs';
import { createFpsMeter } from './fps';
import { createGameAudio } from './game-audio';
import { createFixedStepLoop } from './loop';
import { choiceCallbacks } from './choices';
import type { Assist } from './controls';
import { type Interruption, type Online, type OnlineMatch, createOnline } from './online';
import { guestLeftText } from './online-text';
import {
  IDLE_SNAPSHOT,
  createMatch,
  withoutPresses,
  withoutPressesView,
  type InputView,
  type Match,
} from './match';
import { endingMs, endingTicks } from './ending';
import { openAudioOnGesture } from './gesture';
import { enterLandscapeFullscreen, fullscreenOnFirstTouch } from './fullscreen';
import { createPauseScreen } from './pause';
import { loadPlayerPrefs } from './prefs';
import { createSeats, type LaunchedSeats } from './seats';
import { type Settings, createSettings } from './settings';
import { soundOf, type Screen } from './sound';
import { createCrashReport } from './crash';
import { createGameStats, outcomeOf, sendGameEvent } from './stats';
import { keepRecord } from './records';
import { browserStorage } from './storage';
import { createTeamPause, pauseItems } from './team-pause';
import { createToast } from './toast';
import { drawTrack, stageTracks, trackOf } from './track';
import { countVisit } from './visits';
import { stageCards } from '../ui/lobby-model';
import type { UiCallbacks, UpgradeCue } from '../ui/types';
import { showsStageChoice } from '../ui/teaser';
import { createPrompts } from '../ui/prompts';
import { chooseLocale } from './locale';
import { createStillness } from './stillness';
import { createWeaponScenes } from './weapon-scenes';
import { downloadJson } from './download';
import { type RecordedGame, type Recorder, type Recording, createRecorder } from './recording';

const SOLO_FOCUS: CameraFocus = { kind: 'player', playerId: 0 };
const TOGETHER_FOCUS: CameraFocus = { kind: 'everyone' };
// Past 4 ticks a frame (under 7.25 fps) the game slows down, so a hitch never lands a burst of hits.
const MAX_TICKS_PER_FRAME = 4;
const CATCH_UP_TICKS_PER_FRAME = 2;

// A recorded game played back instead of the title, its steps served by `source`.
export interface Replay {
  readonly recording: Recording;
  readonly source: CommandSource;
  // A film renders the game's sound offline, in step with the page clock.
  readonly audio?: () => BaseAudioContext;
}

type MatchStart = Omit<RecordedGame, 'version' | 'query'>;

export async function startGame(
  root: HTMLElement,
  dev: DevOptions,
  replay?: Replay,
): Promise<void> {
  let screen: Screen = 'title';
  let gameMode: GameMode = 'solo';
  const sendEvent = (event: GameEvent): void => {
    sendGameEvent(event, import.meta.env.VITE_STATS_URL, window.location.search, (url, data) =>
      navigator.sendBeacon(url, data),
    );
  };
  // Listening before the stage is built counts a renderer that fails to start, too.
  const reportCrash = createCrashReport({
    version: __APP_RELEASE__,
    origin: window.location.origin,
    scene: () =>
      screen === 'game' || screen === 'ending'
        ? { stage: match.session.state.setId, mode: gameMode }
        : null,
    send: sendEvent,
  });
  window.addEventListener('error', (event) => {
    reportCrash(event.error, 'event');
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportCrash(event.reason, 'promise');
  });
  const { content } = dev;
  const first = content.sets[0];
  if (first === undefined) {
    throw new Error('No set to play');
  }
  const defaultSet: SetDefinition = first;
  const stages: readonly StageCard[] = stageCards(content.sets);
  const classIds = content.classes.map((definition) => definition.id);
  const prefs = loadPlayerPrefs(browserStorage, content, prefersCalmMode());
  const keys = createPlayerKeys(prefs.keys);
  const names = createKeyNames();
  void learnKeyboardLayout(names);
  const prompts = createPrompts(keys, names);

  const stage = document.createElement('div');
  stage.className = 'game-stage';
  root.append(stage);
  const renderer = await createRenderer(stage, { calmMode: prefs.calmMode }, content, dev.light);
  const stillness = createStillness();
  let stageSize = { width: stage.clientWidth, height: stage.clientHeight };
  const hub = createInputHub(stage, keys, names);
  const audio = createGameAudio(content, {
    state: () => match.session.state,
    lastTrackId: () => prefs.trackId,
    setNamed,
    ...(replay?.audio === undefined ? {} : { createContext: replay.audio }),
  });

  let stageId = prefs.stageId;
  let frozenAlpha = 0;
  let endingLeft = 0;
  let recorder: Recorder | null = null;
  let match = soloMatch();
  let onlineMatch: OnlineMatch | null = null;
  let onlineLobby = false;
  let interruption: Interruption | null = null;
  let catchUp = 0;
  const seats = createSeats(classIds, prefs.classId);
  let lobbySeats: LaunchedSeats | null = null;
  let view: InputView = { devices: new Map(), merged: IDLE_SNAPSHOT };
  let uiSnapshot: InputSnapshot | null = null;
  let uiPlayers: readonly LocalPlayer[] = [];
  let played = false;
  const fps = createFpsMeter();
  const probe =
    dev.mode === null
      ? null
      : createDevProbe(
          () => match.session.state,
          () => match.seats,
          () =>
            onlineMatch === null
              ? null
              : {
                  role: onlineMatch.role,
                  pending: match.source.pending,
                  roundTripMs: online.roundTripMs,
                  connectMs: online.connectMs,
                },
        );
  const toast = createToast(root);
  const stats = createGameStats(sendEvent);
  renderer.setOptions({ focus: match.focus });
  const weaponScenes = createWeaponScenes(content, renderer);
  const settings = createSettings(browserStorage, prefs, applySound);
  const dialogs = createDialogs(navigatorGamepads);

  const ui = createUi(
    root,
    {
      ...gameCallbacks(),
      ...settingsCallbacks(settings, renderer, { openForm, openControls }),
      ...menuCallbacks(),
      ...choiceCallbacks({
        seats,
        audio,
        settings,
        setIds: content.sets.map((definition) => definition.id),
        room: () => online,
        inRoom: () => onlineLobby,
        screen: () => screen,
        pickStage(setId) {
          stageId = setId;
        },
        showLobby() {
          ui.updateLobby(localLobby());
        },
        showStagePicker() {
          ui.showStagePicker(stagePicker());
        },
        showClassPicker() {
          ui.showClassPicker(classPicker());
        },
        launch,
      }),
    },
    prompts,
    content.classes,
    createPortraits(content.classes, () => prefs.calmMode),
  );
  void countVisit(window.location.hostname, (url) => fetch(url)).then((count) => {
    if (count !== null) ui.showVisits(count);
  });
  const online = createOnline({
    ui,
    stages,
    stageId: () => stageId,
    endless: () => prefs.endless,
    festival: () => prefs.festival,
    classIds,
    classId: () => prefs.classId,
    trackId: nextTrackId,
    version: () => probe?.forcedVersion ?? APP_VERSION,
    onMatch: startOnline,
    onLobby: showOnlineLobby,
    onInterruption: interrupt,
    onGuestLeft(playerId) {
      toast.show(guestLeftText(match.session.state.players, playerId));
    },
  });
  const fade = createDefeatFade(root);
  const pause = createTeamPause(
    createPauseScreen(
      root,
      prompts,
      pauseItems(settings, {
        resume: () => {
          pause.resume();
        },
        openControls,
        openForm,
        quit,
        backToLobby,
        online: () => onlineMatch !== null,
        leadsTeam: () => teamSession()?.role === 'host',
      }),
    ),
    { online: () => onlineMatch !== null, changed: applySound },
  );
  if (replay === undefined) {
    showTitle();
  } else {
    watch(replay);
  }
  applySound();

  function gameCallbacks() {
    return {
      onRestart() {
        if (onlineMatch !== null) {
          online.relaunch();
        } else if (lobbySeats === null) {
          play();
        } else {
          launch(lobbySeats);
        }
      },
      onBackToLobby: backToLobby,
      onQuit: quit,
      onChooseUpgrade(playerId: PlayerId, upgradeId: string) {
        match.chooseUpgrade(playerId, upgradeId);
      },
      onUpgradeCue(cue: UpgradeCue, variant: number) {
        audio.cue(cue, variant);
      },
      onShowWeapon(canvas: HTMLCanvasElement, weaponId: string, playerId: PlayerId) {
        const { frame } = match.session;
        const player = frame.players.find((candidate) => candidate.id === playerId);
        return player === undefined
          ? null
          : weaponScenes.show(canvas, weaponId, frame.setId, player.classId);
      },
      onLeaveNotice: quit,
    };
  }

  function menuCallbacks() {
    return {
      onStart: openClassPicker,
      onChooseClass(classId: string) {
        if (classIds.includes(classId)) {
          settings.remember('classId', classId);
          setMatch(soloMatch());
          if (screen === 'class') {
            ui.showClassPicker(classPicker());
          }
        }
      },
      onConfirmClass: openStagePicker,
      onLeaveClassPicker: toTitle,
      onConfirmStage: play,
      onLeaveStagePicker: openClassPicker,
      onPlayTogether: openLobby,
      onPlayOnline: openOnline,
      onLeaveLobby: toTitle,
    };
  }

  function showTitle(): void {
    ui.showTitle({
      calmMode: prefs.calmMode,
      muted: prefs.muted,
      volume: prefs.volume,
      hitSound: prefs.hitSound,
      autoFire: prefs.autoFire,
      autoAim: prefs.autoAim,
      device: view.merged.device,
    });
  }

  function applySound(): void {
    const sound = soundOf({
      screen,
      paused: pause.stopsTheSet,
      muted: prefs.muted,
      hidden: document.hidden,
    });
    audio.setMuted(sound.muted);
    audio.setVolume(prefs.volume / VOLUME_STEPS);
    audio.setHitSound(prefs.hitSound);
    audio.setMood(sound.mood);
  }

  function newMatch(
    slots: readonly PlayerSlot[],
    locals: ReadonlyMap<PlayerId, DeviceId | null>,
    focus: CameraFocus,
  ): Match {
    const start: MatchStart = {
      seed: dev.seed ?? crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
      setId: stageId,
      endless: prefs.endless,
      festival: prefs.festival,
      players: slots,
    };
    return createMatch({
      ...start,
      content,
      slots,
      locals,
      source: recorded(createLocalSource(), start),
      focus,
      assist: () => prefs,
    });
  }

  function recorded(source: CommandSource, start: MatchStart): CommandSource {
    if (!dev.record) {
      return source;
    }
    recorder = createRecorder(source, {
      version: APP_VERSION,
      query: window.location.search,
      ...start,
    });
    return recorder.source;
  }

  // Once a game, at its end screen or when it is left: a match never played has nothing to keep.
  function saveRecording(state: SimState): void {
    if (recorder === null || (screen !== 'game' && screen !== 'ending')) {
      return;
    }
    downloadJson(
      `ozoboom-${state.setId}-${String(state.seed)}.json`,
      recorder.save(state, prefs.trackId),
    );
    recorder = null;
  }

  function watch({ recording, source }: Replay): void {
    setMatch(
      createMatch({
        seed: recording.seed,
        setId: recording.setId,
        endless: recording.endless,
        festival: recording.festival,
        content,
        slots: recording.players,
        locals: new Map(),
        source,
        focus: recording.players.length > 1 ? TOGETHER_FOCUS : SOLO_FOCUS,
      }),
    );
    beginGame(recording.trackId, null);
  }

  // Alone, the one player reads the merged view: keyboard, mouse and gamepad as one.
  function soloMatch(): Match {
    if (dev.players > 1) {
      const slots = benchSlots(content, dev.players);
      return newMatch(slots, new Map(slots.map((slot) => [slot.id, null])), TOGETHER_FOCUS);
    }
    return newMatch([{ id: 0, classId: prefs.classId }], new Map([[0, null]]), SOLO_FOCUS);
  }

  function setMatch(next: Match): void {
    match.close();
    match = next;
    renderer.setOptions({ focus: next.focus });
  }

  function openForm(): void {
    dialogs.openFeedback((onClose) => {
      const device = uiSnapshot?.device ?? 'none';
      const report = buildFeedbackReport(
        played ? match.session.state : null,
        feedbackMeta({
          device,
          calmMode: prefs.calmMode,
          averageFps: fps.average(),
          ...onlineMeta(onlineMatch, online, interruption),
        }),
      );
      return openFeedback(root, report, githubFormLink(), { device, prompts, onClose });
    });
  }

  function openControls(): void {
    dialogs.openControls((onClose) =>
      openRemap(root, {
        device: uiSnapshot?.device ?? 'none',
        profile: prefs.keys,
        prompts,
        names,
        onChange(profile) {
          settings.remember('keys', profile);
          keys.choose(profile);
        },
        onClose,
      }),
    );
  }

  function setNamed(id: string): SetDefinition {
    return content.sets.find((definition) => definition.id === id) ?? defaultSet;
  }

  function nextTrackId(): string {
    return drawTrack(stageTracks(TRACKS, setNamed(stageId).trackIds), prefs.trackId, Math.random)
      .id;
  }

  function localLobby(): LobbyModel {
    return {
      ...seats.model(),
      stages,
      stageId,
      endless: prefs.endless,
      festival: prefs.festival,
    };
  }

  function classPicker(): ClassPickerModel {
    return {
      classId: prefs.classId,
      launches: !showsStageChoice(stages.length),
      endless: prefs.endless,
    };
  }

  function stagePicker(): StagePickerModel {
    return { stages, stageId, endless: prefs.endless, festival: prefs.festival };
  }

  function openClassPicker(): void {
    screen = 'class';
    applySound();
    ui.showClassPicker(classPicker());
  }

  function openStagePicker(): void {
    if (!showsStageChoice(stages.length)) {
      play();
      return;
    }
    screen = 'stage';
    applySound();
    ui.showStagePicker(stagePicker());
  }

  // An online guest counts nothing: the host counts the game for everyone.
  function beginGame(trackId: string, mode: GameMode | null): void {
    void audio.start();
    audio.setTrack(trackOf(TRACKS, trackId));
    settings.remember('trackId', trackId);
    played = true;
    devScene(match.session.state, dev);
    screen = 'game';
    gameMode = mode ?? 'online';
    // An online guest may still be fading out when the host plays again.
    fade.lift();
    ui.showGame();
    applySound();
    if (mode !== null) {
      stats.start(match.session.state, {
        mode,
        device: view.merged.device,
        version: __APP_RELEASE__,
        locale: locale(),
      });
    }
  }

  function rememberStage(): void {
    settings.remember('stageId', stageId);
  }

  function play(): void {
    rememberStage();
    lobbySeats = null;
    setMatch(soloMatch());
    beginGame(nextTrackId(), 'solo');
  }

  function launch(seated: LaunchedSeats): void {
    rememberStage();
    lobbySeats = seated;
    setMatch(newMatch(seated.slots, seated.locals, TOGETHER_FOCUS));
    beginGame(nextTrackId(), 'local');
    audio.cue('launch');
  }

  function openOnline(): void {
    void audio.start();
    onlineLobby = true;
    screen = 'lobby';
    applySound();
    online.open();
  }

  function startOnline(started: OnlineMatch): void {
    void audio.start();
    onlineLobby = false;
    onlineMatch = started;
    if (started.role === 'host') {
      rememberStage();
    }
    interruption = null;
    lobbySeats = null;
    toast.clear();
    setMatch(onlineMatchOf(started, content, () => prefs, recorded));
    pause.dismiss();
    beginGame(started.start.trackId, started.role === 'host' ? 'online' : null);
  }

  function interrupt(next: Interruption): void {
    stats.end(match.session.state, 'interrupted');
    saveRecording(match.session.state);
    interruption = next;
    pause.dismiss();
    fade.lift();
    screen = 'end';
    ui.showNotice(next.notice, next.details);
    applySound();
  }

  function openLobby(): void {
    void audio.start();
    seats.clear();
    screen = 'lobby';
    applySound();
    ui.showLobby(localLobby());
  }

  function toTitle(): void {
    onlineLobby = false;
    online.leave();
    onlineMatch = null;
    interruption = null;
    toast.clear();
    seats.clear();
    screen = 'title';
    applySound();
    showTitle();
  }

  function leaveMatch(): void {
    stats.end(match.session.state, 'quit');
    saveRecording(match.session.state);
    pause.dismiss();
    played = false;
    lobbySeats = null;
    setMatch(soloMatch());
  }

  function quit(): void {
    leaveMatch();
    toTitle();
  }

  // On one screen the same players come back to their seats; online, the host takes the team back.
  function backToLobby(): void {
    if (onlineMatch !== null) {
      online.backToLobby();
      return;
    }
    leaveMatch();
    screen = 'lobby';
    applySound();
    ui.showLobby(localLobby());
  }

  function showOnlineLobby(): void {
    leaveMatch();
    onlineMatch = null;
    onlineLobby = true;
    interruption = null;
    toast.clear();
    fade.lift();
    screen = 'lobby';
    applySound();
  }

  function teamSession(): EndSession | undefined {
    if (onlineMatch !== null) {
      return { role: onlineMatch.role };
    }
    return lobbySeats === null ? undefined : { role: 'host' };
  }

  function beginFrame(): void {
    view = { devices: hub.poll(), merged: hub.merged() };
    audioGate.pad(padPressed);
    const { merged } = view;
    if (dialogs.takesPresses(merged)) {
      return;
    }
    uiSnapshot = merged;
    uiPlayers = [{ playerId: 0, snapshot: merged }];
    if (screen === 'lobby') {
      uiPlayers = seatedPlayers(seats.model().seats, view.devices);
    } else if (screen === 'game') {
      playFrame(merged);
    }
  }

  function playFrame(merged: InputSnapshot): void {
    const quiet = pause.takesPresses(view);
    if (quiet) {
      view = withoutPressesView(view);
      uiSnapshot = withoutPresses(merged);
    }
    if (!pause.paused) {
      match.frame(view);
    } else if (onlineMatch !== null) {
      // The set goes on under the pause menu: the character stands still.
      match.frame(stillView(view));
    }
    uiPlayers = quiet
      ? match.players.map(({ playerId, snapshot }) => ({
          playerId,
          snapshot: withoutPresses(snapshot),
        }))
      : match.players;
  }

  function uiFrame(snapshot: InputSnapshot): UiFrame {
    return {
      snapshot,
      players: uiPlayers,
      devices: [...view.devices].map(([device, own]) => ({ device, snapshot: own })),
      menuPosition: screen === 'title' ? (audio.menuPosition() ?? silentMenuPosition()) : null,
    };
  }

  function step(): false | undefined {
    if (screen === 'ending') {
      endingLeft -= 1;
      if (endingLeft <= 0) {
        openEnd();
      }
    }
    if (onlineMatch === null) {
      if (
        screen === 'title' ||
        screen === 'class' ||
        screen === 'stage' ||
        screen === 'lobby' ||
        pause.paused
      ) {
        return;
      }
      stepOnce();
      if (probe?.afterStep() === true) {
        match.frame({ devices: hub.poll(), merged: hub.merged() });
      }
      return;
    }
    if (screen !== 'game') {
      return;
    }
    // Online, a test's player plays after every step too: each peer changes its state at the same tick.
    if (!stepOnce()) {
      return false;
    }
    probe?.afterStep();
    while (catchUp > 0 && match.source.pending > GUEST_BUFFER_TICKS && playing()) {
      catchUp -= 1;
      if (!stepOnce()) {
        break;
      }
      probe?.afterStep();
    }
  }

  function playing(): boolean {
    return screen === 'game';
  }

  function stepOnce(): boolean {
    const start = performance.now();
    if (!match.step((point) => renderer.screenToWorld(point))) {
      return false;
    }
    const { session } = match;
    audio.update(session.state);
    const { status } = session.state;
    if (screen === 'game' && (status === 'won' || status === 'lost')) {
      beginEnding(session.state, status);
    }
    if (probe !== null) {
      probe.cost.sim += performance.now() - start;
    }
    return true;
  }

  function beginEnding(state: SimState, status: 'won' | 'lost'): void {
    online.matchEnded();
    stats.end(state, outcomeOf(state));
    const tempo = setTempo(setOf(content, state.setId));
    endingLeft = endingTicks(status, tempo);
    fade.fall(status === 'lost', endingMs('lost', tempo, dev.speed));
    screen = 'ending';
    applySound();
  }

  function openEnd(): void {
    const { state } = match.session;
    saveRecording(state);
    screen = 'end';
    fade.lift();
    ui.showEnd(state, teamSession(), keepRecord(browserStorage, state, scoreOf(state)));
  }

  function render(alpha: number): void {
    // Online, the sim stops at the end: a moving alpha would swing the last two ticks back and forth.
    if (pause.stopsTheSet || screen === 'ending') {
      alpha = frozenAlpha;
    } else {
      frozenAlpha = alpha;
    }
    const { session } = match;
    const start = performance.now();
    weaponScenes.frame(start, prefs.calmMode || prefersCalmMode(), session.frame);
    renderer.render(
      session.frame,
      alpha,
      !stillness.draws(session.frame, stageSize.width, stageSize.height),
    );
    const rendered = performance.now();
    if (uiSnapshot !== null && !dialogs.open) {
      ui.update(session.frame, uiFrame(uiSnapshot), content);
    }
    session.endFrame();
    if (probe !== null) {
      const end = performance.now();
      probe.cost.render += rendered - start;
      probe.cost.ui += end - rendered;
      probe.endFrame(end);
    }
  }

  const loop = createFixedStepLoop(
    {
      tickMs: TICK_MS / dev.speed,
      maxTicksPerFrame: MAX_TICKS_PER_FRAME * dev.speed,
      now: () => performance.now(),
      requestFrame: (callback) =>
        requestAnimationFrame((time) => {
          fps.frame(time);
          beginFrame();
          catchUp = CATCH_UP_TICKS_PER_FRAME;
          callback(time);
        }),
      cancelFrame: (handle) => {
        cancelAnimationFrame(handle);
      },
    },
    {
      step,
      render,
      crashed: (error) => {
        reportCrash(error, 'loop');
      },
    },
  );
  const background = createBackgroundPlay({
    tickMs: TICK_MS / dev.speed,
    maxTicks: MAX_TICKS_PER_FRAME * dev.speed,
    now: () => performance.now(),
    hiddenOnline: () => document.hidden && onlineMatch !== null,
    standStill: () => {
      match.frame(stillView(view));
    },
    play(ticks) {
      catchUp = CATCH_UP_TICKS_PER_FRAME;
      for (let index = 0; index < ticks; index++) {
        if (step() === false) {
          break;
        }
      }
      match.session.endFrame();
    },
  });

  // The stage, not the window: a phone's address bar can hide without a resize event.
  new ResizeObserver(() => {
    if (stage.clientWidth === stageSize.width && stage.clientHeight === stageSize.height) {
      return;
    }
    stageSize = { width: stage.clientWidth, height: stage.clientHeight };
    renderer.resize(stageSize.width, stageSize.height);
  }).observe(stage);
  // Closing the tab tells the others at once, instead of leaving them to wait for a timeout.
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      online.leave();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'game' && onlineMatch === null) {
      pause.pause(uiSnapshot?.device ?? 'none');
    }
    if (document.hidden) {
      background.start();
    } else {
      background.stop();
    }
    applySound();
  });
  // The title's ambience starts as soon as the browser allows it, instead of waiting for the set.
  const audioGate = openAudioOnGesture(window, () => audio.start());
  fullscreenOnFirstTouch(window, enterLandscapeFullscreen);
  loop.start();

  const linked = parseJoinCode(window.location.hash);
  if (linked !== null) {
    openOnline();
    online.joinRoom(linked);
  }
}

function settingsCallbacks(
  settings: Settings,
  renderer: Pick<Renderer, 'setOptions'>,
  open: { readonly openForm: () => void; readonly openControls: () => void },
): Pick<
  UiCallbacks,
  | 'onToggleCalmMode'
  | 'onToggleMute'
  | 'onSetVolume'
  | 'onToggleHitSound'
  | 'onToggleAutoFire'
  | 'onToggleAutoAim'
  | 'onChooseLocale'
  | 'onFeedback'
  | 'onControls'
> {
  const { prefs } = settings;
  return {
    onToggleCalmMode(enabled) {
      settings.remember('calmMode', enabled);
      renderer.setOptions({ calmMode: enabled });
    },
    onToggleMute(muted) {
      settings.setSound({ volume: prefs.volume, muted });
    },
    onSetVolume(volume) {
      settings.setSound({ volume, muted: prefs.muted });
    },
    onToggleHitSound: settings.setHitSound,
    onToggleAutoFire: settings.setAutoFire,
    onToggleAutoAim: settings.setAutoAim,
    onChooseLocale: chooseLocale,
    onFeedback: open.openForm,
    onControls: open.openControls,
  };
}

function onlineMatchOf(
  started: OnlineMatch,
  content: GameContent,
  assist: () => Assist,
  recorded: (source: CommandSource, start: MatchStart) => CommandSource,
): Match {
  const { seed, setId, players, endless = false, festival = false } = started.start;
  return createMatch({
    seed,
    setId,
    endless,
    festival,
    content,
    slots: players,
    locals: new Map([[started.localPlayer, null]]),
    source: recorded(started.source, { seed, setId, endless, festival, players }),
    focus: { kind: 'player', playerId: started.localPlayer },
    assist,
  });
}

function onlineMeta(
  started: OnlineMatch | null,
  online: Pick<Online, 'roundTripMs'>,
  interruption: Interruption | null,
): { online?: OnlineMeta } {
  return started === null
    ? {}
    : {
        online: {
          role: started.role,
          players: started.start.players.length,
          roundTripMs: online.roundTripMs,
          ...(interruption?.desyncTick === undefined
            ? {}
            : { desyncTick: interruption.desyncTick }),
        },
      };
}

function seatedPlayers(
  seated: readonly { readonly playerId: PlayerId; readonly device: DeviceId | null }[],
  devices: ReadonlyMap<DeviceId, InputSnapshot>,
): LocalPlayer[] {
  return seated.map(({ playerId, device }) => ({
    playerId,
    snapshot: (device === null ? undefined : devices.get(device)) ?? IDLE_SNAPSHOT,
  }));
}

function padPressed(): boolean {
  return Array.from(navigator.getGamepads()).some(
    (pad) => pad?.buttons.some((button) => button.pressed) === true,
  );
}

function silentMenuPosition(): number {
  return performance.now() / 1000 / EIGHTH_SECONDS;
}

function stillView(view: InputView): InputView {
  const still = (snapshot: InputSnapshot): InputSnapshot => {
    const quiet = withoutPresses(snapshot);
    return { ...quiet, gameplay: { ...quiet.gameplay, move: { x: 0, y: 0 } } };
  };
  return {
    merged: still(view.merged),
    devices: new Map([...view.devices].map(([device, snapshot]) => [device, still(snapshot)])),
  };
}
