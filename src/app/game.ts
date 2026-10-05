import { createAudioEngine } from '../audio';
import {
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
import { createLocalSource } from '../net/local';
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
import { BENCH_ENEMIES, type DevOptions, benchScene, createDevProbe } from './dev';
import { createFpsMeter } from './fps';
import { createFixedStepLoop } from './loop';
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

const SET_ID = 'soiree-v0';
const DEFAULT_CLASS_ID = 'mage';
const SOLO_FOCUS: CameraFocus = { kind: 'player', playerId: 0 };
const TOGETHER_FOCUS: CameraFocus = { kind: 'everyone' };
const DEFAULT_BREAK_BARS = 4;
// 29 ticks per second: a 60 Hz screen runs 0 or 1 tick per frame, a struggling one at 10 frames
// per second 3. Past 4 ticks (138 ms, under 7.25 frames per second), the game slows down instead
// of jumping ahead, so a hitch never lands a burst of hits the player could not react to.
const MAX_TICKS_PER_FRAME = 4;

function noop(): void {
  // The callbacks of the online lobby, which only the online game wires (#147).
}

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
  const renderer = await createRenderer(stage, { calmMode: prefs.calmMode }, content);
  const hub = createInputHub(stage);
  const audio = createAudioEngine({
    breakBars: (tier) => set.tiers[tier]?.breakBars ?? DEFAULT_BREAK_BARS,
    trapEffectOf: (id) => content.traps.find((trap) => trap.id === id)?.effect.kind ?? id,
    sfxLookups: {
      weaponKindOf: (id) => content.weapons?.find((weapon) => weapon.id === id)?.effect.kind,
      skillSoundOf: (classId, slot) => {
        const effect = content.classes.find((candidate) => candidate.id === classId)?.[slot].effect;
        return effect === undefined
          ? undefined
          : { kind: effect.kind, revive: effect.kind === 'healPulse' && effect.revive === true };
      },
      specialKindOf: (id) => content.enemies.find((enemy) => enemy.id === id)?.special?.kind,
    },
  });

  let screen: Screen = 'title';
  let paused = false;
  let frozenAlpha = 0;
  let match = soloMatch();
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
        );
  renderer.setOptions({ focus: match.focus });

  const ui = createUi(root, {
    onStart: play,
    onRestart() {
      if (launched === null) {
        play();
      } else {
        launch(launched);
      }
    },
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
      seats.setClass(playerId, classId);
      ui.updateLobby(seats.model());
    },
    onSeatName(playerId, name) {
      seats.setName(playerId, name);
      ui.updateLobby(seats.model());
    },
    onCreateRoom: noop,
    onJoinRoom: noop,
    onLaunch() {
      if (seats.count > 0) {
        launch(seats.launch());
      }
    },
    onLeaveLobby: toTitle,
    onLeaveNotice: quit,
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
    { label: 'Quitter la partie', confirm: QUIT, activate: quit },
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
    const sound = soundOf({ screen, paused, muted: prefs.muted, hidden: document.hidden });
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
      feedbackMeta({ device, calmMode: prefs.calmMode, averageFps: fps.average() }),
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

  function openLobby(): void {
    void audio.start();
    seats.clear();
    screen = 'lobby';
    applySound();
    ui.showLobby(seats.model());
  }

  function toTitle(): void {
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
      pause.show(device);
    } else {
      pause.hide();
    }
  }

  // The pause is the team's: any device pauses, navigates and resumes, through the merged view.
  function beginFrame(): void {
    view = { devices: hub.poll(), merged: hub.merged() };
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

  function step(): void {
    if (screen === 'title' || screen === 'lobby' || paused) {
      return;
    }
    const start = performance.now();
    if (!match.step((point) => renderer.screenToWorld(point))) {
      return;
    }
    const { session } = match;
    audio.update(session.state);
    const { status } = session.state;
    if (screen === 'game' && (status === 'won' || status === 'lost')) {
      screen = 'end';
      ui.showEnd(session.state);
      applySound();
    }
    if (probe !== null) {
      probe.cost.sim += performance.now() - start;
    }
  }

  function render(alpha: number): void {
    if (paused) {
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
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'game') {
      setPaused(true);
    }
    applySound();
  });
  loop.start();
}

const QUIT = {
  question: 'Quitter le set\u202f?',
  text: 'Tu rentres avant le sunrise\u202f: la partie s’arrête ici, sans score.',
  stay: 'Rester',
  leave: 'Quitter',
} as const;
