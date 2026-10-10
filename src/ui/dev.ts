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
import type { PlayerId, SimState } from '../sim/state';
import { TICK_MS } from '../shared/tempo';
import {
  UI_FIXTURE_CONTENT,
  UI_FIXTURE_SCREENS,
  type UiFixtureScreen,
  fixtureForScreen,
  idleSnapshot,
} from './fixtures';
import { createUi, prefersCalmMode } from './index';
import {
  LOBBY_CLASSES,
  LOBBY_FIXTURES,
  ROOM_CODE,
  STAGE_CARDS,
  lobbyFixture,
} from './lobby-fixtures';
import { SEAT_IDS, defaultName } from './lobby-model';
import { SUN_PALETTES, type SunMoment } from '../shared/palette';
import { applyPalette, uiPaletteAt } from './sun';
import type { LobbyModel, LobbySeat, LocalPlayer, UiFrame } from './types';

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
let state: SimState = fixtureForScreen(initial, params.has('late'));
let pending: InputSnapshot = idleSnapshot({ device });
// The second player of the screen: WASD to move through a menu, Space to confirm.
let pendingSecond: InputSnapshot = idleSnapshot({ device });
// How many of the players of the fixture sit at this screen: the others are remote ones.
const localCount = Number(
  params.get('locals') ?? (initial === 'offers' || initial === 'team' ? 2 : 1),
);
const session = params.get('role') === 'guest' ? ({ role: 'guest' } as const) : undefined;
const titleOptions = {
  calmMode: params.has('calm') || prefersCalmMode(),
  muted: params.has('muted'),
  volume: 10,
  autoFire: params.has('autoFire'),
  autoAim: params.has('autoAim'),
  classId: 'mage',
};
const blockedTab: FeedbackTransport = {
  send: () => Promise.resolve({ status: 'failed' }),
};
const transport = params.get('transport') === 'blocked' ? blockedTab : githubFormLink();
let feedback: FeedbackDialog | null = null;
// The lobby the harness plays the app of: it keeps the model and answers every gesture.
let lobby: LobbyModel | null = null;
let driven: PlayerId = 0;
const sunParam = params.get('sun');
const sunMoment = (Object.keys(SUN_PALETTES) as SunMoment[]).find((moment) => moment === sunParam);
const sunFraction = sunParam === null || sunParam === '' ? Number.NaN : Number(sunParam);
const sky =
  sunMoment !== undefined
    ? SUN_PALETTES[sunMoment]
    : Number.isNaN(sunFraction)
      ? null
      : uiPaletteAt(sunFraction);

function origin(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

function showLobby(model: LobbyModel): void {
  const opening = lobby === null;
  lobby = model;
  if (opening) {
    ui.showLobby(model);
  } else {
    ui.updateLobby(model);
  }
}

function patchSeat(playerId: PlayerId, patch: Partial<LobbySeat>): void {
  if (lobby !== null) {
    showLobby({
      ...lobby,
      seats: lobby.seats.map((seat) => (seat.playerId === playerId ? { ...seat, ...patch } : seat)),
    });
  }
}

const ui = createUi(
  root,
  {
    onStart() {
      console.info('[ui] onStart');
      open('game');
    },
    onRestart() {
      console.info('[ui] onRestart');
      open('title');
    },
    onQuit() {
      console.info('[ui] onQuit');
      open('title');
    },
    onChooseUpgrade(playerId, upgradeId) {
      console.info('[ui] onChooseUpgrade', playerId, upgradeId);
      const pendingUpgrades = state.pendingUpgrades.filter((offer) => offer.playerId !== playerId);
      if (current === 'offers' && pendingUpgrades.length > 0) {
        state = { ...state, pendingUpgrades };
      } else {
        open('game');
      }
    },
    onToggleCalmMode(enabled) {
      console.info('[ui] onToggleCalmMode', enabled);
      titleOptions.calmMode = enabled;
    },
    onToggleMute(muted) {
      console.info('[ui] onToggleMute', muted);
      titleOptions.muted = muted;
    },
    onSetVolume(volume) {
      console.info('[ui] onSetVolume', volume);
      titleOptions.volume = volume;
    },
    onToggleAutoFire(enabled) {
      console.info('[ui] onToggleAutoFire', enabled);
      titleOptions.autoFire = enabled;
    },
    onToggleAutoAim(enabled) {
      console.info('[ui] onToggleAutoAim', enabled);
      titleOptions.autoAim = enabled;
    },
    onFeedback(details) {
      console.info('[ui] onFeedback', details ?? '');
      openForm();
    },
    onPlayTogether: () => {
      console.info('[ui] onPlayTogether');
      showLobby(lobbyFixture('local-empty', origin()));
    },
    onChooseClass: (classId) => {
      console.info('[ui] onChooseClass', classId);
      titleOptions.classId = classId;
    },
    onJoinSeat: (deviceId) => {
      console.info('[ui] onJoinSeat', deviceId);
      const free = SEAT_IDS.find((id) => lobby?.seats.every((seat) => seat.playerId !== id));
      if (lobby !== null && free !== undefined) {
        const taken: LobbySeat = {
          playerId: free,
          name: defaultName(free),
          classId: LOBBY_CLASSES[0]?.id ?? 'mage',
          device: deviceId,
          remote: false,
          host: lobby.seats.length === 0,
        };
        showLobby({
          ...lobby,
          seats: [...lobby.seats, taken].sort((a, b) => a.playerId - b.playerId),
          canLaunch: true,
        });
      }
    },
    onLeaveSeat: (playerId) => {
      console.info('[ui] onLeaveSeat', playerId);
      if (lobby !== null) {
        const seats = lobby.seats
          .filter((seat) => seat.playerId !== playerId)
          .map((seat, index) => ({ ...seat, host: index === 0 }));
        showLobby({ ...lobby, seats, canLaunch: seats.length > 0 });
      }
    },
    onSeatClass: (playerId, classId) => {
      console.info('[ui] onSeatClass', playerId, classId);
      patchSeat(playerId, { classId });
    },
    onSeatName: (playerId, name) => {
      console.info('[ui] onSeatName', playerId, name);
      patchSeat(playerId, { name });
    },
    onGoOnline: () => {
      console.info('[ui] onGoOnline');
      showLobby(lobbyFixture('entry', origin()));
    },
    onCreateRoom: () => {
      console.info('[ui] onCreateRoom');
      showLobby(lobbyFixture('host', origin()));
    },
    onJoinRoom: (code) => {
      console.info('[ui] onJoinRoom', code);
      showLobby(
        code === ROOM_CODE ? lobbyFixture('guest', origin()) : lobbyFixture('error-full', origin()),
      );
    },
    onLaunch: () => {
      console.info('[ui] onLaunch');
      open('game');
    },
    onChooseStage: (setId) => {
      console.info('[ui] onChooseStage', setId);
      if (lobby !== null) {
        showLobby({ ...lobby, stageId: setId });
      } else {
        ui.showStagePicker({ stages: STAGE_CARDS, stageId: setId });
      }
    },
    onConfirmStage: () => {
      console.info('[ui] onConfirmStage');
      open('game');
    },
    onLeaveStagePicker: () => {
      console.info('[ui] onLeaveStagePicker');
      open('title');
    },
    onLeaveLobby() {
      console.info('[ui] onLeaveLobby');
      open('title');
    },
    onLeaveNotice() {
      console.info('[ui] onLeaveNotice');
      open('title');
    },
  },
  LOBBY_CLASSES,
);

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
  lobby = null;
  current = screen;
  state = fixtureForScreen(screen, params.has('late'));
  switch (screen) {
    case 'title':
      ui.showTitle({ ...titleOptions, device });
      break;
    case 'game':
    case 'team':
    case 'offers':
    case 'upgrade':
    case 'fusion':
    case 'relics':
    case 'volume':
      ui.showGame();
      break;
    case 'won':
    case 'lost':
    case 'teamWon':
    case 'teamLost':
      ui.update(state, { snapshot: pending, players: [] }, UI_FIXTURE_CONTENT);
      ui.showEnd(state, session);
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

const SECOND_KEYS: Record<string, keyof MenuIntents> = {
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'confirm',
};

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
    return;
  }
  const menuKey = MENU_KEYS[event.code];
  const secondKey = SECOND_KEYS[event.code];
  if (secondKey !== undefined) {
    pendingSecond = { ...pendingSecond, menu: { ...pendingSecond.menu, [secondKey]: true } };
  } else if (menuKey !== undefined) {
    pending = { ...pending, menu: { ...pending.menu, [menuKey]: true } };
  } else if (event.code === 'Tab') {
    const key = event.shiftKey ? 'previousTrap' : 'nextTrap';
    pending = { ...pending, gameplay: { ...pending.gameplay, [key]: true } };
  } else if (/^Digit[1-5]$/.test(event.code)) {
    const selectTrap = Number(event.code.slice(-1)) - 1;
    pending = { ...pending, gameplay: { ...pending.gameplay, selectTrap } };
  } else if (event.code === 'KeyJ') {
    padPressed = true;
  } else if (event.code === 'KeyP') {
    const local = lobby?.seats.filter((seat) => !seat.remote) ?? [];
    const next = local.find((seat) => seat.playerId > driven) ?? local[0];
    driven = next?.playerId ?? 0;
  } else if (event.code === 'KeyG') {
    device = device === 'gamepad' ? 'keyboardMouse' : 'gamepad';
  } else if (event.code === 'F6') {
    if (feedback === null) {
      openForm();
    }
  } else if (event.code === 'F7') {
    open('volume');
  } else if (event.code === 'F8') {
    open('relics');
  } else if (event.code === 'F9') {
    open('fusion');
  } else if (event.code === 'KeyV') {
    state = { ...state, events: [{ type: 'volumeChanged', volume: state.volume ?? 0 }] };
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
const notice = params.get('notice');
if (notice === 'desync' || notice === 'hostLeft' || notice === 'connectionLost') {
  ui.update(state, { snapshot: pending, players: [] }, UI_FIXTURE_CONTENT);
  ui.showNotice(notice, params.get('details') ?? '');
}
if (params.has('stagepicker')) {
  ui.showStagePicker({ stages: STAGE_CARDS, stageId: 'dome' });
}
const requestedLobby = params.get('lobby');
if (requestedLobby !== null) {
  const fixture = LOBBY_FIXTURES.find((name) => name === requestedLobby) ?? 'local-empty';
  showLobby(lobbyFixture(fixture, origin()));
}

// One snapshot per seat played from this screen: the keyboard drives one of them, the rest are idle.
function playersOf(snapshot: InputSnapshot): LocalPlayer[] {
  const seats = lobby?.seats.filter((seat) => !seat.remote) ?? [];
  if (seats.length === 0) {
    return [{ playerId: 0, snapshot }];
  }
  return seats.map((seat) => ({
    playerId: seat.playerId,
    snapshot: seat.playerId === driven ? snapshot : idleSnapshot({ device: 'gamepad' }),
  }));
}

// With `?pads=N`, the last N players of the screen play with a gamepad.
const pads = Number(params.get('pads') ?? 0);

function padSnapshot(index: number, count: number, snapshot: InputSnapshot): InputSnapshot {
  return index >= count - pads ? { ...snapshot, device: 'gamepad' } : snapshot;
}

// With `?devices`, the frame lists every device: the keyboard, a first pad, and a second one that
// presses A when J is pressed.
let padPressed = false;

function devicesOf(snapshot: InputSnapshot): Pick<UiFrame, 'devices'> {
  if (!params.has('devices')) {
    return {};
  }
  const pad = idleSnapshot({ device: 'gamepad' });
  const pressed = { ...pad, menu: { ...pad.menu, confirm: padPressed } };
  padPressed = false;
  return {
    devices: [
      { device: 'keyboardMouse', snapshot },
      { device: 'gamepad:0', snapshot: pad },
      { device: 'gamepad:1', snapshot: pressed },
    ],
  };
}

let ticks = 0;
const FIRE_EVERY_TICKS = 12;

window.setInterval(() => {
  ticks += 1;
  const player = state.players[0];
  const held = player?.weapons?.[0];
  if (
    current === 'volume' &&
    ticks % FIRE_EVERY_TICKS === 0 &&
    player !== undefined &&
    held !== undefined
  ) {
    state = {
      ...state,
      events: [
        { type: 'weaponFired', playerId: player.id, weaponId: held.id, x: player.x, y: player.y },
      ],
    };
  }
  const snapshot: InputSnapshot = { ...pending, device };
  const second: InputSnapshot = { ...pendingSecond, device };
  pending = idleSnapshot({ device });
  pendingSecond = idleSnapshot({ device });
  if (feedback === null) {
    const players =
      lobby === null
        ? state.players.slice(0, localCount).map((player, index) => ({
            playerId: player.id,
            snapshot: padSnapshot(index, localCount, index === 1 ? second : snapshot),
          }))
        : playersOf(snapshot);
    ui.update(state, { snapshot, players, ...devicesOf(snapshot) }, UI_FIXTURE_CONTENT);
    state = { ...state, events: [] };
  } else {
    feedback.update(snapshot);
  }
  if (sky !== null) {
    applyPalette(root, sky);
  }
}, TICK_MS);
