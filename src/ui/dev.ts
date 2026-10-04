import '../style.css';
import {
  type FeedbackDialog,
  type FeedbackTransport,
  buildFeedbackReport,
  feedbackMeta,
  githubFormLink,
  openFeedback,
} from '../feedback';
import type { InputDevice, InputSnapshot, MenuIntents } from '../input/intents';
import type { SimState } from '../sim/state';
import { TICK_MS } from '../shared/tempo';
import {
  UI_FIXTURE_CONTENT,
  UI_FIXTURE_SCREENS,
  type UiFixtureScreen,
  fixtureForScreen,
  idleSnapshot,
} from './fixtures';
import { createUi, prefersCalmMode } from './index';

const found = document.querySelector<HTMLElement>('#app');
if (found === null) {
  throw new Error('Missing #app root element');
}
const root: HTMLElement = found;

const params = new URLSearchParams(window.location.search);
const requested = params.get('screen');
const initial: UiFixtureScreen =
  requested === 'feedback'
    ? 'lost'
    : (UI_FIXTURE_SCREENS.find((screen) => screen === requested) ?? 'title');
let current = initial;
let device: InputDevice = params.get('device') === 'gamepad' ? 'gamepad' : 'keyboardMouse';
let state: SimState = fixtureForScreen(initial);
let pending: InputSnapshot = idleSnapshot({ device });
const titleOptions = {
  calmMode: params.has('calm') || prefersCalmMode(),
  muted: params.has('muted'),
};
const blockedTab: FeedbackTransport = {
  send: () => Promise.resolve({ status: 'failed' }),
};
const transport = params.get('transport') === 'blocked' ? blockedTab : githubFormLink();
let feedback: FeedbackDialog | null = null;

const ui = createUi(root, {
  onStart() {
    console.info('[ui] onStart');
    open('game');
  },
  onRestart() {
    console.info('[ui] onRestart');
    open('title');
  },
  onChooseUpgrade(playerId, upgradeId) {
    console.info('[ui] onChooseUpgrade', playerId, upgradeId);
    open('game');
  },
  onToggleCalmMode(enabled) {
    console.info('[ui] onToggleCalmMode', enabled);
    titleOptions.calmMode = enabled;
  },
  onToggleMute(muted) {
    console.info('[ui] onToggleMute', muted);
    titleOptions.muted = muted;
  },
  onFeedback() {
    console.info('[ui] onFeedback');
    openForm();
  },
});

function openForm(): void {
  const report = buildFeedbackReport(
    current === 'title' ? null : state,
    feedbackMeta({ device, calmMode: titleOptions.calmMode, averageFps: null }),
  );
  feedback = openFeedback(root, report, transport, {
    device,
    onClose() {
      console.info('[ui] feedback closed');
      feedback = null;
    },
  });
}

function open(screen: UiFixtureScreen): void {
  feedback?.close();
  current = screen;
  state = fixtureForScreen(screen);
  switch (screen) {
    case 'title':
      ui.showTitle({ ...titleOptions, device });
      break;
    case 'game':
    case 'upgrade':
      ui.showGame();
      break;
    case 'won':
    case 'lost':
      ui.showEnd(state);
      break;
  }
}

const MENU_KEYS: Record<string, keyof MenuIntents> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'confirm',
  Escape: 'back',
};

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLTextAreaElement) {
    return;
  }
  const menuKey = MENU_KEYS[event.code];
  if (menuKey !== undefined) {
    pending = { ...pending, menu: { ...pending.menu, [menuKey]: true } };
  } else if (event.code === 'Tab') {
    const key = event.shiftKey ? 'previousTrap' : 'nextTrap';
    pending = { ...pending, gameplay: { ...pending.gameplay, [key]: true } };
  } else if (/^Digit[1-5]$/.test(event.code)) {
    const selectTrap = Number(event.code.slice(-1)) - 1;
    pending = { ...pending, gameplay: { ...pending.gameplay, selectTrap } };
  } else if (event.code === 'KeyG') {
    device = device === 'gamepad' ? 'keyboardMouse' : 'gamepad';
  } else if (event.code === 'F6') {
    if (feedback === null) {
      openForm();
    }
  } else if (/^F[1-5]$/.test(event.code)) {
    const screen = UI_FIXTURE_SCREENS[Number(event.code.slice(1)) - 1];
    if (screen !== undefined) {
      open(screen);
    }
  } else {
    return;
  }
  event.preventDefault();
});

ui.showTitle({ ...titleOptions, device });
open(initial);
if (requested === 'feedback') {
  openForm();
}

window.setInterval(() => {
  const snapshot: InputSnapshot = { ...pending, device };
  pending = idleSnapshot({ device });
  if (feedback === null) {
    ui.update(state, snapshot, UI_FIXTURE_CONTENT);
  } else {
    feedback.update(snapshot);
  }
}, TICK_MS);
