import { createAudioEngine } from '../audio';
import {
  APP_VERSION,
  type FeedbackDialog,
  buildFeedbackReport,
  feedbackMeta,
  githubFormLink,
  openFeedback,
} from '../feedback';
import { createInputHub } from '../input';
import type { DeviceId, InputSnapshot } from '../input/intents';
import { createRenderer } from '../render';
import { TICK_MS } from '../shared/tempo';
import { parseJoinCode } from '../net/code';
import { createLocalSource } from '../net/local';
import { GUEST_BUFFER_TICKS } from '../net/lockstep';
import type { CameraFocus } from '../render/types';
import type { PlayerSlot } from '../sim/initial-state';
import type { PlayerId } from '../sim/state';
import {
  type LocalPlayer,
  type UiFrame,
  createFeedbackButton,
  createSoundToggle,
  createUi,
  prefersCalmMode,
} from '../ui';
import { BENCH_ENEMIES, type DevOptions, benchScene, benchSlots, createDevProbe } from './dev';
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
import { createPauseScreen } from './pause';
import { loadPrefs, savePref } from './prefs';
import { createSeats, type LaunchedSeats } from './seats';
import { soundOf, type Screen } from './sound';
import { createToast } from './toast';
import { playerLabel } from '../ui/hud-model';

const GESTURES = ['pointerdown', 'pointerup', 'keydown'] as const;
const SET_ID = 'soiree-v0';
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
  const set = content.sets.find((candidate) => candidate.id === SET_ID);
  if (set === undefined) {
    throw new Error(`Missing set ${SET_ID}`);
  }
  const storage = () => window.localStorage;
  const classIds = content.classes.map((definition) => definition.id);
  const prefs = loadPrefs(storage, {
    calmMode: prefersCalmMode(),
    muted: false,
    classId: DEFAULT_CLASS_ID,
  });
  if (!classIds.includes(prefs.classId)) {
    prefs.classId = classIds.includes(DEFAULT_CLASS_ID) ? DEFAULT_CLASS_ID : (classIds[0] ?? '');
  }

  const stage = document.createElement('div');
  stage.className = 'game-stage';
  root.append(stage);
  const renderer = await createRenderer(
    stage,
    { calmMode: prefs.calmMode },
    content,
    dev.mode === 'fast',
  );
  const hub = createInputHub(stage);
  const audio = createAudioEngine({
    breakBars: (tier) => set.tiers[tier]?.breakBars ?? DEFAULT_BREAK_BARS,
    trapEffectOf: (id) => content.traps.find((trap) => trap.id === id)?.effect.kind ?? id,
    sfxLookups: {
      weaponKindOf: (id) => content.weapons?.find((weapon) => weapon.id === id)?.effect.kind,
      skillKindOf: (classId) =>
        content.classes.find((candidate) => candidate.id === classId)?.skill.effect.kind,
      specialKindOf: (id) => content.enemies.find((enemy) => enemy.id === id)?.special?.kind,
    },
  });

  let screen: Screen = 'title';
  let paused = false;
  let frozenAlpha = 0;
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
  renderer.setOptions({ focus: match.focus });

  const ui = createUi(root, {
    onStart: play,
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
    onToggleCalmMode(enabled) {
      prefs.calmMode = enabled;
      renderer.setOptions({ calmMode: enabled });
      savePref(storage, 'calmMode', enabled);
    },
    onToggleMute: setMuted,
    onFeedback: openForm,
    onPlayTogether: openLobby,
    onChooseClass(classId) {
      if (classIds.includes(classId)) {
        prefs.classId = classId;
        savePref(storage, 'classId', classId);
        setMatch(soloMatch());
      }
    },
    onJoinSeat(device) {
      if (seats.join(device)) {
        audio.cue('seatTaken');
        ui.updateLobby(seats.model());
      }
    },
    onLeaveSeat(playerId) {
      if (seats.leave(playerId)) {
        audio.cue('seatFreed');
        ui.updateLobby(seats.model());
      }
    },
    onSeatClass(playerId, classId) {
      if (onlineLobby) {
        void audio.start();
        online.setSeatClass(classId);
        return;
      }
      seats.setClass(playerId, classId);
      ui.updateLobby(seats.model());
    },
    onSeatName(playerId, name) {
      if (onlineLobby) {
        online.setSeatName(name);
        return;
      }
      seats.setName(playerId, name);
      ui.updateLobby(seats.model());
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
    onLeaveLobby: toTitle,
    onLeaveNotice: quit,
  });
  const online = createOnline({
    ui,
    setId: SET_ID,
    classIds,
    classId: () => prefs.classId,
    version: () => probe?.forcedVersion ?? APP_VERSION,
    onMatch: startOnline,
    onInterruption: interrupt,
    onGuestLeft(playerId) {
      const player = match.session.state.players.find((candidate) => candidate.id === playerId);
      toast.show(`${player === undefined ? 'Un joueur' : playerLabel(player)} a quitté le set`);
    },
  });
  const soundToggle = createSoundToggle();
  soundToggle.set(!prefs.muted);
  const pause = createPauseScreen(root, [
    {
      label: 'Reprendre',
      activate() {
        setPaused(false);
      },
    },
    {
      label: 'Son',
      button: soundToggle.button,
      activate() {
        setMuted(!prefs.muted);
      },
    },
    { label: 'Ton avis', button: createFeedbackButton(), activate: openForm },
    {
      label: 'Quitter la partie',
      get confirm() {
        return onlineMatch === null ? QUIT : QUIT_ONLINE;
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
      device: view.merged.device,
      classId: prefs.classId,
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
    audio.setMood(sound.mood);
  }

  function newMatch(
    slots: readonly PlayerSlot[],
    locals: ReadonlyMap<PlayerId, DeviceId | null>,
    focus: CameraFocus,
  ): Match {
    return createMatch({
      seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
      setId: SET_ID,
      content,
      slots,
      locals,
      source: createLocalSource(),
      focus,
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

  function setMuted(muted: boolean): void {
    prefs.muted = muted;
    applySound();
    savePref(storage, 'muted', muted);
    soundToggle.set(!muted);
  }

  function beginGame(): void {
    void audio.start();
    played = true;
    if (dev.mode === 'bench') {
      benchScene(match.session.state, content, match.session.state.seed, BENCH_ENEMIES);
    }
    screen = 'game';
    ui.showGame();
    applySound();
  }

  function play(): void {
    launched = null;
    setMatch(soloMatch());
    beginGame();
  }

  function launch(seated: LaunchedSeats): void {
    launched = seated;
    setMatch(newMatch(seated.slots, seated.locals, TOGETHER_FOCUS));
    audio.cue('launch');
    beginGame();
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
    interruption = null;
    launched = null;
    toast.clear();
    const { seed, setId, players } = started.start;
    setMatch(
      createMatch({
        seed,
        setId,
        content,
        slots: players,
        locals: new Map([[started.localPlayer, null]]),
        source: started.source,
        focus: { kind: 'player', playerId: started.localPlayer },
      }),
    );
    paused = false;
    pause.hide();
    beginGame();
  }

  // A game that cannot go on: nothing steps any more, and the notice offers the way out.
  function interrupt(next: Interruption): void {
    interruption = next;
    paused = false;
    pause.hide();
    screen = 'end';
    ui.showNotice(next.notice, next.details);
    applySound();
  }

  function openLobby(): void {
    void audio.start();
    seats.clear();
    screen = 'lobby';
    applySound();
    ui.showLobby(seats.model());
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
      pause.show(device, onlineMatch === null ? undefined : ONLINE_PAUSE);
    } else {
      pause.hide();
    }
  }

  // The pause is the team's: any device pauses, navigates and resumes, through the merged view.
  function beginFrame(): void {
    view = { devices: hub.poll(), merged: hub.merged() };
    if (!gestured && padPressed()) {
      openAudio();
    }
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

  function uiFrame(snapshot: InputSnapshot): UiFrame {
    return {
      snapshot,
      players: uiPlayers,
      devices: [...view.devices].map(([device, own]) => ({ device, snapshot: own })),
    };
  }

  function step(): false | undefined {
    if (onlineMatch === null) {
      if (screen === 'title' || screen === 'lobby' || paused) {
        return;
      }
      stepOnce();
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
      screen = 'end';
      ui.showEnd(session.state, onlineMatch === null ? undefined : { role: onlineMatch.role });
      online.matchEnded();
      applySound();
    }
    if (probe !== null) {
      probe.cost.sim += performance.now() - start;
    }
    return true;
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
    if (paused && onlineMatch === null) {
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
  // Browsers keep the audio shut until a gesture: the first click, key or pad button opens it, and the
  // title's ambience starts there instead of waiting for the set. A finger counts as a gesture only
  // when it lifts.
  let gestured = false;
  function openAudio(): void {
    if (!gestured) {
      gestured = true;
      void audio.start();
      for (const type of GESTURES) {
        window.removeEventListener(type, onGesture, true);
      }
    }
  }
  function onGesture(event: Event): void {
    const touchDown =
      event instanceof PointerEvent &&
      event.type === 'pointerdown' &&
      event.pointerType !== 'mouse';
    if (!touchDown) {
      openAudio();
    }
  }
  for (const type of GESTURES) {
    window.addEventListener(type, onGesture, true);
  }
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

const QUIT = {
  question: 'Quitter le set\u202f?',
  text: 'Tu rentres avant le sunrise\u202f: la partie s’arrête ici, sans score.',
  stay: 'Rester',
  leave: 'Quitter',
} as const;

const QUIT_ONLINE = {
  question: 'Quitter le set\u202f?',
  text: 'Tu laisses les autres joueurs\u202f: ton personnage reste immobile et le set continue sans toi.',
  stay: 'Rester',
  leave: 'Quitter',
} as const;

const ONLINE_PAUSE = {
  heading: 'Le set continue',
  text: 'En ligne, la pause n’arrête pas le set : ton personnage reste immobile pendant que les autres jouent.',
} as const;
