import { t } from '../shared/i18n';
import { createAudioEngine } from '../audio';
import { EIGHTH_SECONDS } from '../audio/ambience';
import {
  APP_VERSION,
  type FeedbackDialog,
  buildFeedbackReport,
  feedbackMeta,
  githubFormLink,
  openFeedback,
} from '../feedback';
import { TRACKS } from '../data/tracks';
import type { SetDefinition } from '../data/types';
import { createInputHub } from '../input';
import type { DeviceId, InputSnapshot } from '../input/intents';
import { createPortraits, createRenderer } from '../render';
import { SUN_PALETTES } from '../shared/palette';
import type { GameMode } from '../shared/stats';
import { TICK_MS } from '../shared/tempo';
import { parseJoinCode } from '../net/code';
import { createLocalSource } from '../net/local';
import { GUEST_BUFFER_TICKS } from '../net/lockstep';
import type { CameraFocus } from '../render/types';
import type { PlayerSlot } from '../sim/initial-state';
import type { PlayerId } from '../sim/state';
import {
  type ClassPickerModel,
  type LobbyModel,
  type StagePickerModel,
  type LocalPlayer,
  type SoundLevel,
  type StageCard,
  type UiFrame,
  VOLUME_STEPS,
  createFeedbackButton,
  createAutoAimToggle,
  createAutoFireToggle,
  createHitSoundToggle,
  createSoundControl,
  createUi,
  prefersCalmMode,
  stepSound,
} from '../ui';
import {
  BENCH_ENEMIES,
  type DevOptions,
  benchScene,
  benchSlots,
  bossScene,
  createDevProbe,
} from './dev';
import { createFpsMeter } from './fps';
import { createFixedStepLoop, dueTicks } from './loop';
import { type Interruption, type OnlineMatch, createOnline } from './online';
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
import { createPauseScreen } from './pause';
import { loadPrefs, savePref } from './prefs';
import { createSeats, type LaunchedSeats } from './seats';
import { soundOf, type Screen } from './sound';
import { createGameStats, outcomeOf, sendGameEvent } from './stats';
import { createToast } from './toast';
import { drawTrack, stageTracks, trackOf } from './track';
import { countVisit } from './visits';
import { playerLabel } from '../ui/hud-model';
import { stageCards } from '../ui/lobby-model';
import { showsStageChoice } from '../ui/teaser';
import { chooseLocale } from './locale';

const DEFAULT_CLASS_ID = 'mage';
const SOLO_FOCUS: CameraFocus = { kind: 'player', playerId: 0 };
const TOGETHER_FOCUS: CameraFocus = { kind: 'everyone' };
const DEFAULT_BREAK_BARS = 4;
// 29 ticks per second: a 60 Hz screen runs 0 or 1 tick per frame, a struggling one at 10 frames
// per second 3. Past 4 ticks (138 ms, under 7.25 frames per second), the game slows down instead
// of jumping ahead, so a hitch never lands a burst of hits the player could not react to.
const MAX_TICKS_PER_FRAME = 4;
// An online guest with frames to spare plays up to this many extra steps a frame to get back to
// the host's pace.
const CATCH_UP_TICKS_PER_FRAME = 2;

export async function startGame(root: HTMLElement, dev: DevOptions): Promise<void> {
  const { content } = dev;
  const first = content.sets[0];
  if (first === undefined) {
    throw new Error('No set to play');
  }
  const defaultSet: SetDefinition = first;
  const stages: readonly StageCard[] = stageCards(content.sets);
  const storage = () => window.localStorage;
  const classIds = content.classes.map((definition) => definition.id);
  const prefs = loadPrefs(storage, {
    calmMode: prefersCalmMode(),
    muted: false,
    volume: VOLUME_STEPS,
    hitSound: false,
    autoFire: false,
    autoAim: false,
    classId: DEFAULT_CLASS_ID,
    stageId: defaultSet.id,
    trackId: '',
    endless: false,
  });
  if (!classIds.includes(prefs.classId)) {
    prefs.classId = classIds.includes(DEFAULT_CLASS_ID) ? DEFAULT_CLASS_ID : (classIds[0] ?? '');
  }

  if (!content.sets.some((definition) => definition.id === prefs.stageId)) {
    prefs.stageId = defaultSet.id;
  }

  const stage = document.createElement('div');
  stage.className = 'game-stage';
  root.append(stage);
  const renderer = await createRenderer(stage, { calmMode: prefs.calmMode }, content, dev.light);
  const hub = createInputHub(stage);
  const audio = createAudioEngine({
    setOf: (setId) => content.sets.find((candidate) => candidate.id === setId),
    breakBars: (tier) =>
      setNamed(match.session.state.setId).tiers[tier]?.breakBars ?? DEFAULT_BREAK_BARS,
    trapEffectOf: (id) => content.traps.find((trap) => trap.id === id)?.effect.kind ?? id,
    sfxLookups: {
      weaponKindOf: (id) => content.weapons?.find((weapon) => weapon.id === id)?.effect.kind,
      skillKindOf: (classId) =>
        content.classes.find((candidate) => candidate.id === classId)?.skill.effect.kind,
      specialKindOf: (id) => content.enemies.find((enemy) => enemy.id === id)?.special?.kind,
    },
  });

  let screen: Screen = 'title';
  // The scene of the next set, solo or from the lobby: the last one played at first.
  let stageId = prefs.stageId;
  let paused = false;
  let frozenAlpha = 0;
  let endingLeft = 0;
  let match = soloMatch();
  let onlineMatch: OnlineMatch | null = null;
  let onlineLobby = false;
  let interruption: Interruption | null = null;
  let catchUp = 0;
  let backgroundTimer: ReturnType<typeof setTimeout> | undefined;
  let backgroundSince = 0;
  const seats = createSeats(classIds, prefs.classId);
  // Who plays again on « Rejouer » after a game of the lobby: the same seats.
  let launched: LaunchedSeats | null = null;
  let view: InputView = { devices: new Map(), merged: IDLE_SNAPSHOT };
  let uiSnapshot: InputSnapshot | null = null;
  let uiPlayers: readonly LocalPlayer[] = [];
  let played = false;
  let feedback: FeedbackDialog | null = null;
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
  const stats = createGameStats((event) => {
    sendGameEvent(event, import.meta.env.VITE_STATS_URL, window.location.search, (url, data) =>
      navigator.sendBeacon(url, data),
    );
  });
  renderer.setOptions({ focus: match.focus });

  const ui = createUi(
    root,
    {
      onStart: openClassPicker,
      onRestart() {
        if (onlineMatch !== null) {
          online.relaunch();
        } else if (launched === null) {
          play();
        } else {
          launch(launched);
        }
      },
      onQuit: quit,
      onChooseUpgrade(playerId, upgradeId) {
        match.chooseUpgrade(playerId, upgradeId);
      },
      onUpgradeCue(cue, variant) {
        audio.cue(cue, variant);
      },
      onToggleCalmMode(enabled) {
        prefs.calmMode = enabled;
        renderer.setOptions({ calmMode: enabled });
        savePref(storage, 'calmMode', enabled);
      },
      onToggleMute(muted) {
        setSound({ volume: prefs.volume, muted });
      },
      onSetVolume(volume) {
        setSound({ volume, muted: prefs.muted });
      },
      onToggleHitSound: setHitSound,
      onToggleAutoFire: setAutoFire,
      onToggleAutoAim: setAutoAim,
      onChooseLocale: chooseLocale,
      onFeedback: openForm,
      onPlayTogether: openLobby,
      onChooseClass(classId) {
        if (classIds.includes(classId)) {
          prefs.classId = classId;
          savePref(storage, 'classId', classId);
          setMatch(soloMatch());
          if (screen === 'class') {
            ui.showClassPicker(classPicker());
          }
        }
      },
      onConfirmClass: openStagePicker,
      onLeaveClassPicker: toTitle,
      onJoinSeat(device) {
        if (seats.join(device)) {
          audio.cue('seatTaken');
          ui.updateLobby(localLobby());
        }
      },
      onLeaveSeat(playerId) {
        if (seats.leave(playerId)) {
          audio.cue('seatFreed');
          ui.updateLobby(localLobby());
        }
      },
      onSeatClass(playerId, classId) {
        if (onlineLobby) {
          void audio.start();
          online.setSeatClass(classId);
          return;
        }
        seats.setClass(playerId, classId);
        ui.updateLobby(localLobby());
      },
      onSeatName(playerId, name) {
        if (onlineLobby) {
          online.setSeatName(name);
          return;
        }
        seats.setName(playerId, name);
        ui.updateLobby(localLobby());
      },
      onGoOnline: openOnline,
      onCreateRoom() {
        void audio.start();
        online.createRoom();
      },
      onJoinRoom(code) {
        void audio.start();
        online.joinRoom(code);
      },
      onLaunch() {
        if (onlineLobby) {
          void audio.start();
          online.launch();
        } else if (seats.count > 0) {
          launch(seats.launch());
        }
      },
      onChooseStage(setId) {
        if (!content.sets.some((definition) => definition.id === setId)) {
          return;
        }
        stageId = setId;
        if (screen === 'stage') {
          ui.showStagePicker(stagePicker());
        } else if (onlineLobby) {
          online.setStage(setId);
        } else {
          ui.updateLobby(localLobby());
        }
      },
      onToggleEndless(enabled) {
        if (onlineLobby && online.role !== 'host') {
          return;
        }
        prefs.endless = enabled;
        savePref(storage, 'endless', enabled);
        if (screen === 'stage') {
          ui.showStagePicker(stagePicker());
        } else if (screen === 'class') {
          ui.showClassPicker(classPicker());
        } else if (onlineLobby) {
          online.setEndless(enabled);
        } else {
          ui.updateLobby(localLobby());
        }
      },
      onConfirmStage: play,
      onLeaveStagePicker: openClassPicker,
      onLeaveLobby: toTitle,
      onLeaveNotice: quit,
    },
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
    classIds,
    classId: () => prefs.classId,
    trackId: nextTrackId,
    version: () => probe?.forcedVersion ?? APP_VERSION,
    onMatch: startOnline,
    onInterruption: interrupt,
    onGuestLeft(playerId) {
      const player = match.session.state.players.find((candidate) => candidate.id === playerId);
      toast.show(
        t('{name} a quitté le set', {
          name: player === undefined ? t('Un joueur') : playerLabel(player),
        }),
      );
    },
  });
  const soundControl = createSoundControl(stepVolume);
  soundControl.set(prefs);
  const hitSoundToggle = createHitSoundToggle();
  hitSoundToggle.set(prefs.hitSound);
  const autoFireToggle = createAutoFireToggle();
  autoFireToggle.set(prefs.autoFire);
  const autoAimToggle = createAutoAimToggle();
  autoAimToggle.set(prefs.autoAim);
  // An opacity transition on one layer: the compositor runs the fade, the frame loop does nothing.
  // It darkens to the end screen's night, whatever the time of the set.
  const fade = document.createElement('div');
  fade.className = 'defeat-fade';
  fade.style.transitionDuration = `${String(endingMs('lost', dev.speed))}ms`;
  fade.style.setProperty('--sol', SUN_PALETTES.nuit.sol);
  fade.style.setProperty('--bad-vibe', SUN_PALETTES.nuit.badVibe);
  root.append(fade);
  const pause = createPauseScreen(root, [
    {
      label: t('Reprendre'),
      activate() {
        setPaused(false);
      },
    },
    {
      label: t('Son'),
      element: soundControl.element,
      activate() {
        setSound({ volume: prefs.volume, muted: !prefs.muted });
      },
      adjust: stepVolume,
    },
    {
      label: t('Son des coups'),
      element: hitSoundToggle.button,
      activate() {
        setHitSound(!prefs.hitSound);
      },
    },
    {
      label: t('Tir automatique'),
      element: autoFireToggle.button,
      activate() {
        setAutoFire(!prefs.autoFire);
      },
    },
    {
      label: t('Visée automatique'),
      element: autoAimToggle.button,
      activate() {
        setAutoAim(!prefs.autoAim);
      },
    },
    { label: t('Ton avis'), element: createFeedbackButton(), activate: openForm },
    {
      label: t('Quitter la partie'),
      get confirm() {
        return onlineMatch === null ? quitConfirm() : quitOnlineConfirm();
      },
      activate: quit,
    },
  ]);
  showTitle();
  applySound();

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
      // Online, the pause menu stops nothing: the set goes on, and so does its music.
      paused: paused && onlineMatch === null,
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
    return createMatch({
      seed: dev.seed ?? crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
      setId: stageId,
      endless: prefs.endless,
      content,
      slots,
      locals,
      source: createLocalSource(),
      focus,
      assist: () => prefs,
    });
  }

  // Alone, the one player reads the merged view: keyboard, mouse and gamepad as one.
  function soloMatch(): Match {
    if (dev.mode === 'bench' && dev.players > 1) {
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

  // Opened from the title, the pause or the end, where the sim does not step: the form takes every
  // input until it closes, then the screen below takes them back.
  function openForm(): void {
    if (feedback !== null) {
      return;
    }
    const device = uiSnapshot?.device ?? 'none';
    const report = buildFeedbackReport(
      played ? match.session.state : null,
      feedbackMeta({
        device,
        calmMode: prefs.calmMode,
        averageFps: fps.average(),
        ...(onlineMatch === null
          ? {}
          : {
              online: {
                role: onlineMatch.role,
                players: onlineMatch.start.players.length,
                roundTripMs: online.roundTripMs,
                ...(interruption?.desyncTick === undefined
                  ? {}
                  : { desyncTick: interruption.desyncTick }),
              },
            }),
      }),
    );
    feedback = openFeedback(root, report, githubFormLink(), {
      device,
      onClose() {
        feedback = null;
      },
    });
  }

  function setSound({ volume, muted }: SoundLevel): void {
    prefs.volume = volume;
    prefs.muted = muted;
    applySound();
    savePref(storage, 'volume', volume);
    savePref(storage, 'muted', muted);
    soundControl.set(prefs);
  }

  function stepVolume(side: -1 | 1): void {
    setSound(stepSound(prefs, side));
  }

  function setHitSound(enabled: boolean): void {
    prefs.hitSound = enabled;
    applySound();
    savePref(storage, 'hitSound', enabled);
    hitSoundToggle.set(enabled);
  }

  function setAutoFire(enabled: boolean): void {
    prefs.autoFire = enabled;
    savePref(storage, 'autoFire', enabled);
    autoFireToggle.set(enabled);
  }

  function setAutoAim(enabled: boolean): void {
    prefs.autoAim = enabled;
    savePref(storage, 'autoAim', enabled);
    autoAimToggle.set(enabled);
  }

  function setNamed(id: string): SetDefinition {
    return content.sets.find((definition) => definition.id === id) ?? defaultSet;
  }

  function nextTrackId(): string {
    return drawTrack(stageTracks(TRACKS, setNamed(stageId).trackIds), prefs.trackId, Math.random)
      .id;
  }

  function localLobby(): LobbyModel {
    return { ...seats.model(), stages, stageId, endless: prefs.endless };
  }

  function classPicker(): ClassPickerModel {
    return {
      classId: prefs.classId,
      launches: !showsStageChoice(stages.length),
      endless: prefs.endless,
    };
  }

  function stagePicker(): StagePickerModel {
    return { stages, stageId, endless: prefs.endless };
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
    prefs.trackId = trackId;
    savePref(storage, 'trackId', trackId);
    played = true;
    if (dev.mode === 'bench') {
      benchScene(match.session.state, content, match.session.state.seed, BENCH_ENEMIES);
    }
    if (dev.boss !== null) {
      bossScene(match.session.state, dev.boss);
    }
    screen = 'game';
    // An online guest may still be fading out when the host plays again.
    fade.classList.remove('defeat-fade--on');
    ui.showGame();
    applySound();
    if (mode !== null) {
      stats.start(match.session.state, {
        mode,
        device: view.merged.device,
        version: __APP_RELEASE__,
      });
    }
  }

  function rememberStage(): void {
    prefs.stageId = stageId;
    savePref(storage, 'stageId', stageId);
  }

  function play(): void {
    rememberStage();
    launched = null;
    setMatch(soloMatch());
    beginGame(nextTrackId(), 'solo');
  }

  function launch(seated: LaunchedSeats): void {
    rememberStage();
    launched = seated;
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
    launched = null;
    toast.clear();
    const { seed, setId, players, endless = false } = started.start;
    setMatch(
      createMatch({
        seed,
        setId,
        endless,
        content,
        slots: players,
        locals: new Map([[started.localPlayer, null]]),
        source: started.source,
        focus: { kind: 'player', playerId: started.localPlayer },
        assist: () => prefs,
      }),
    );
    paused = false;
    pause.hide();
    beginGame(started.start.trackId, started.role === 'host' ? 'online' : null);
  }

  // A game that cannot go on: nothing steps any more, and the notice offers the way out.
  function interrupt(next: Interruption): void {
    stats.end(match.session.state, 'interrupted');
    interruption = next;
    paused = false;
    pause.hide();
    fade.classList.remove('defeat-fade--on');
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

  // Back to the title as on a fresh load: no end screen, a new idle game behind the title.
  function quit(): void {
    stats.end(match.session.state, 'quit');
    paused = false;
    pause.hide();
    played = false;
    launched = null;
    setMatch(soloMatch());
    toTitle();
  }

  function setPaused(next: boolean, device = uiSnapshot?.device ?? 'none'): void {
    if (paused === next) {
      return;
    }
    paused = next;
    applySound();
    if (next) {
      pause.show(device, onlineMatch === null ? undefined : onlinePauseText());
    } else {
      pause.hide();
    }
  }

  // The pause is the team's: any device pauses, navigates and resumes, through the merged view.
  function beginFrame(): void {
    view = { devices: hub.poll(), merged: hub.merged() };
    audioGate.pad(padPressed);
    const { merged } = view;
    if (feedback !== null) {
      feedback.update(merged);
      return;
    }
    uiSnapshot = merged;
    uiPlayers = [{ playerId: 0, snapshot: merged }];
    if (screen === 'lobby') {
      uiPlayers = seats.model().seats.map(({ playerId, device }) => ({
        playerId,
        snapshot: (device === null ? undefined : view.devices.get(device)) ?? IDLE_SNAPSHOT,
      }));
    } else if (screen === 'game') {
      const { gameplay, menu } = merged;
      const wasPaused = paused;
      if (!paused) {
        const pauser = [...view.devices.values()].find((snapshot) => snapshot.gameplay.pause);
        setPaused(gameplay.pause, pauser?.device ?? merged.device);
      } else if ((gameplay.pause || menu.back) && pause.confirming) {
        pause.cancel();
      } else if (gameplay.pause || menu.back) {
        setPaused(false);
      } else {
        pause.handle(menu, gameplay.move);
      }
      const quiet = wasPaused || paused;
      if (quiet) {
        view = withoutPressesView(view);
        uiSnapshot = withoutPresses(merged);
      }
      if (!paused) {
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
  }

  // Until a gesture opens the audio, or while the sound is off, the title keeps the ambience's time.
  function silentMenuPosition(): number {
    return performance.now() / 1000 / EIGHTH_SECONDS;
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
        paused
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
    if (!stepOnce()) {
      return false;
    }
    while (catchUp > 0 && match.source.pending > GUEST_BUFFER_TICKS && playing()) {
      catchUp -= 1;
      if (!stepOnce()) {
        break;
      }
    }
  }

  function padPressed(): boolean {
    return Array.from(navigator.getGamepads()).some(
      (pad) => pad?.buttons.some((button) => button.pressed) === true,
    );
  }

  function playing(): boolean {
    return screen === 'game';
  }

  // False when the source has no commands yet: an online guest waits for the host's frame.
  function stepOnce(): boolean {
    const start = performance.now();
    if (!match.step((point) => renderer.screenToWorld(point))) {
      return false;
    }
    const { session } = match;
    audio.update(session.state);
    const { status } = session.state;
    if (screen === 'game' && (status === 'won' || status === 'lost')) {
      online.matchEnded();
      stats.end(session.state, outcomeOf(session.state));
      endingLeft = endingTicks(status);
      if (endingLeft === 0) {
        openEnd();
      } else {
        screen = 'ending';
        fade.classList.add('defeat-fade--on');
      }
      applySound();
    }
    if (probe !== null) {
      probe.cost.sim += performance.now() - start;
    }
    return true;
  }

  function openEnd(): void {
    screen = 'end';
    fade.classList.remove('defeat-fade--on');
    ui.showEnd(match.session.state, onlineMatch === null ? undefined : { role: onlineMatch.role });
  }

  // A hidden tab gets no animation frames: an online game keeps its place in the set by timer,
  // without drawing. Browsers slow timers down in the background, so this is best effort.
  function runInBackground(): void {
    backgroundTimer = undefined;
    if (!document.hidden || onlineMatch === null) {
      return;
    }
    const tickMs = TICK_MS / dev.speed;
    const now = performance.now();
    const { ticks, spentMs } = dueTicks(
      now - backgroundSince,
      tickMs,
      MAX_TICKS_PER_FRAME * dev.speed,
    );
    backgroundSince = ticks === 0 ? backgroundSince : Math.min(now, backgroundSince + spentMs);
    catchUp = CATCH_UP_TICKS_PER_FRAME;
    for (let index = 0; index < ticks; index++) {
      if (step() === false) {
        break;
      }
    }
    match.session.endFrame();
    backgroundTimer = setTimeout(runInBackground, tickMs);
  }

  function startBackground(): void {
    if (backgroundTimer === undefined && onlineMatch !== null) {
      match.frame(stillView(view));
      backgroundSince = performance.now();
      backgroundTimer = setTimeout(runInBackground, TICK_MS / dev.speed);
    }
  }

  function render(alpha: number): void {
    // Online, the sim stops at the end: a moving alpha would swing the last two ticks back and forth.
    if ((paused && onlineMatch === null) || screen === 'ending') {
      alpha = frozenAlpha;
    } else {
      frozenAlpha = alpha;
    }
    const { session } = match;
    const start = performance.now();
    renderer.render(session.frame, alpha);
    const rendered = performance.now();
    if (uiSnapshot !== null && feedback === null) {
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
      // Input is polled once per frame, before the steps of that frame.
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
    { step, render },
  );

  window.addEventListener('resize', () => {
    renderer.resize(stage.clientWidth, stage.clientHeight);
  });
  // Closing the tab tells the others at once, instead of leaving them to wait for the connection
  // to time out.
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      online.leave();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'game' && onlineMatch === null) {
      setPaused(true);
    }
    if (document.hidden) {
      startBackground();
    } else {
      clearTimeout(backgroundTimer);
      backgroundTimer = undefined;
    }
    applySound();
  });
  // The title's ambience starts at the first gesture instead of waiting for the set.
  const audioGate = openAudioOnGesture(window, () => audio.start());
  loop.start();

  // A link to a room opens the lobby on the guest's side.
  const linked = parseJoinCode(window.location.hash);
  if (linked !== null) {
    openOnline();
    online.joinRoom(linked);
  }
}

// The view of a player who lets go: no press, no movement.
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

const quitConfirm = () =>
  ({
    question: t('Quitter le set\u202f?'),
    text: t('Tu rentres avant le sunrise\u202f: la partie s’arrête ici, sans score.'),
    stay: t('Rester'),
    leave: t('Quitter'),
  }) as const;

const quitOnlineConfirm = () =>
  ({
    question: t('Quitter le set\u202f?'),
    text: t(
      'Tu laisses les autres joueurs\u202f: ton personnage reste immobile et le set continue sans toi.',
    ),
    stay: t('Rester'),
    leave: t('Quitter'),
  }) as const;

const onlinePauseText = () =>
  ({
    heading: t('Le set continue'),
    text: t(
      'En ligne, la pause n’arrête pas le set : ton personnage reste immobile pendant que les autres jouent.',
    ),
  }) as const;
