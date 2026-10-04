import { createAudioEngine } from '../audio';
import type { InputSnapshot } from '../input/intents';
import { createInputSource } from '../input';
import { createRenderer } from '../render';
import { TICK_MS } from '../shared/tempo';
import { length, normalize } from '../shared/vec';
import { IDLE_INPUT } from '../sim/commands';
import { createUi, prefersCalmMode } from '../ui';
import { Controls } from './controls';
import { BENCH_ENEMIES, type DevOptions, crowd, createDevProbe } from './dev';
import { createFixedStepLoop } from './loop';
import { createPauseScreen } from './pause';
import { loadPrefs, savePref } from './prefs';
import { createSession, type Session } from './session';

const SET_ID = 'soiree-v0';
const CLASS_ID = 'mage';
const DEFAULT_BREAK_BARS = 4;
// 29 ticks per second: a 60 Hz screen runs 0 or 1 tick per frame, a struggling one at 10 frames
// per second 3. Past 4 ticks (138 ms, under 7.25 frames per second), the game slows down instead
// of jumping ahead, so a hitch never lands a burst of hits the player could not react to.
const MAX_TICKS_PER_FRAME = 4;

type Screen = 'title' | 'game' | 'end';

export async function startGame(root: HTMLElement, dev: DevOptions): Promise<void> {
  const { content } = dev;
  const set = content.sets.find((candidate) => candidate.id === SET_ID);
  if (set === undefined) {
    throw new Error(`Missing set ${SET_ID}`);
  }
  const storage = () => window.localStorage;
  const prefs = loadPrefs(storage, { calmMode: prefersCalmMode(), muted: false });

  const stage = document.createElement('div');
  stage.className = 'game-stage';
  root.append(stage);
  const renderer = await createRenderer(stage, { calmMode: prefs.calmMode }, content);
  const input = createInputSource(stage);
  const audio = createAudioEngine({
    breakBars: (tier) => set.tiers[tier]?.breakBars ?? DEFAULT_BREAK_BARS,
    trapEffectOf: (id) => content.traps.find((trap) => trap.id === id)?.effect.kind ?? id,
  });
  audio.setMuted(prefs.muted);

  let screen: Screen = 'title';
  let paused = false;
  let frozenAlpha = 0;
  let session = newSession();
  let controls = controlsFor(session);
  let uiSnapshot: InputSnapshot | null = null;
  const probe = dev.mode === null ? null : createDevProbe(() => session.state);

  const ui = createUi(root, {
    onStart: play,
    onRestart: play,
    onChooseUpgrade(_playerId, upgradeId) {
      controls.chooseUpgrade(upgradeId);
    },
    onToggleCalmMode(enabled) {
      prefs.calmMode = enabled;
      renderer.setOptions({ calmMode: enabled });
      savePref(storage, 'calmMode', enabled);
    },
    onToggleMute(muted) {
      prefs.muted = muted;
      audio.setMuted(muted || paused);
      savePref(storage, 'muted', muted);
    },
  });
  const pause = createPauseScreen(root, [
    {
      label: 'Reprendre',
      activate() {
        setPaused(false);
      },
    },
  ]);
  ui.showTitle({ calmMode: prefs.calmMode, muted: prefs.muted, device: 'none' });

  function newSession(): Session {
    return createSession({
      seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
      players: [{ id: 0, classId: CLASS_ID }],
      setId: SET_ID,
      content,
    });
  }

  function controlsFor({ state }: Session): Controls {
    const player = state.players[0];
    const outward =
      player === undefined
        ? null
        : normalize({ x: player.x - state.core.x, y: player.y - state.core.y });
    return new Controls(
      content.traps,
      outward !== null && length(outward) > 0 ? outward : IDLE_INPUT.aim,
    );
  }

  function play(): void {
    void audio.start();
    session = newSession();
    if (dev.mode === 'bench') {
      crowd(session.state, content, BENCH_ENEMIES);
    }
    controls = controlsFor(session);
    screen = 'game';
    ui.showGame();
  }

  function setPaused(next: boolean, device = uiSnapshot?.device ?? 'none'): void {
    if (paused === next) {
      return;
    }
    paused = next;
    audio.setMuted(next || prefs.muted);
    if (next) {
      pause.show(device);
    } else {
      pause.hide();
    }
  }

  function beginFrame(): void {
    let snapshot = input.poll();
    if (screen === 'game') {
      const { gameplay, menu } = snapshot;
      const wasPaused = paused;
      if (!paused) {
        setPaused(gameplay.pause, snapshot.device);
      } else if (gameplay.pause || menu.back) {
        setPaused(false);
      } else {
        pause.handle(menu);
      }
      // The press that pauses or resumes, and any press during the pause, acts on nothing else:
      // the A that resumes must not place a trap.
      if (wasPaused || paused) {
        snapshot = {
          ...snapshot,
          gameplay: { ...snapshot.gameplay, ...IDLE_ACTIONS },
          menu: NO_MENU,
        };
      }
      if (!paused) {
        controls.frame(snapshot);
      }
    }
    uiSnapshot = snapshot;
  }

  function step(): void {
    if (screen === 'title' || paused) {
      return;
    }
    const start = performance.now();
    const player = session.state.players[0];
    if (player === undefined) {
      throw new Error('The game has no player 0');
    }
    session.step([controls.command(player, (point) => renderer.screenToWorld(point))]);
    audio.update(session.state);
    const { status } = session.state;
    if (screen === 'game' && (status === 'won' || status === 'lost')) {
      screen = 'end';
      ui.showEnd(session.state);
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
    const start = performance.now();
    renderer.render(session.frame, alpha);
    const rendered = performance.now();
    if (uiSnapshot !== null) {
      ui.update(session.frame, uiSnapshot, content);
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
  });
  loop.start();
}

const IDLE_ACTIONS = {
  fire: false,
  skill: false,
  ultimate: false,
  placeTrap: false,
  nextTrap: false,
  previousTrap: false,
  selectTrap: null,
  pause: false,
} as const;

const NO_MENU = {
  up: false,
  down: false,
  left: false,
  right: false,
  confirm: false,
  back: false,
} as const;
