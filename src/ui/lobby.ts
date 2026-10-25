import type { DeviceId, InputDevice, MenuIntents } from '../input/intents';
import { t } from '../shared/i18n';
import { PLAYER_IDS, type PlayerId } from '../sim/state';
import { type ClassInfo, ROW_CARDS, landscapeNotice } from './class-picker';
import { openDiscord } from './discord';
import { el, fillHint, onPointerClick, setFlag, setText } from './dom';
import { type LobbyControls, createLobbyControls } from './lobby-controls';
import { type Row, lobbyHint, lobbyView, ownSeat, roomCodeFromHash, seatAt } from './lobby-model';
import {
  type EntryPanel,
  type LobbyFooter,
  type LobbyHeader,
  type SeatCard,
  type SharePanel,
  type StagePanel,
  createEntryPanel,
  createLobbyError,
  createLobbyFooter,
  createLobbyHeader,
  createSeatCard,
  createSharePanel,
  createStagePanel,
  paintSeatCard,
} from './lobby-panels';
import {
  type NightTabs,
  createNightTabs,
  launchDetail,
  launchLabel,
  nightLength,
  nightOf,
} from './night';
import { onMouseMove } from './pointer';
import type { Prompts } from './prompts';
import { showsStageChoice } from './teaser';
import type { CreatePortrait, LobbyModel, LobbySeat, Night, UiFrame } from './types';

export interface LobbyActions {
  joinSeat(device: DeviceId): void;
  leaveSeat(playerId: PlayerId): void;
  seatClass(playerId: PlayerId, classId: string): void;
  seatName(playerId: PlayerId, name: string): void;
  chooseStage(setId: string): void;
  chooseNight(night: Night): void;
  createRoom(): void;
  joinRoom(code: string): void;
  launch(): void;
  leave(): void;
}

export interface LobbyScreen {
  readonly element: HTMLElement;
  setModel(model: LobbyModel): void;
  setDevice(device: InputDevice): void;
  // A fresh opening: cursors back on top, and what is held waits for its release.
  open(): void;
  update(frame: UiFrame, edges: MenuIntents): void;
}

interface LobbyParts {
  readonly header: LobbyHeader;
  readonly error: HTMLElement;
  readonly entry: EntryPanel;
  readonly share: SharePanel;
  readonly seatList: HTMLElement;
  readonly cards: readonly SeatCard[];
  readonly stage: StagePanel;
  readonly nights: NightTabs;
  readonly footer: LobbyFooter;
  readonly hint: HTMLElement;
}

function lobbyBody(parts: LobbyParts): HTMLElement {
  const body = el('div', 'ui-lobby__body');
  body.append(
    parts.header.element,
    landscapeNotice(),
    parts.error,
    parts.entry.element,
    parts.share.element,
    parts.nights.element,
    parts.seatList,
    parts.stage.element,
    parts.footer.element,
    parts.hint,
  );
  return body;
}

function hostsRoom(model: LobbyModel): boolean {
  return lobbyView(model) === 'room' && ownSeat(model)?.host === true;
}

function waitsForHost(model: LobbyModel): boolean {
  return lobbyView(model) === 'room' && !hostsRoom(model);
}

function paintRoom(parts: LobbyParts, model: LobbyModel): void {
  const view = lobbyView(model);
  const hosting = hostsRoom(model);
  setText(parts.header.heading, model.mode === 'online' ? t('Salon en ligne') : t('Salon local'));
  setText(
    parts.header.lead,
    view === 'local'
      ? t('Chacun prend une place avec son clavier ou sa manette.')
      : view === 'entry'
        ? t('Crée un salon pour inviter tes amis, ou rejoins le leur avec son code.')
        : hosting
          ? t('Envoie le code ou le lien à tes amis, puis lance le set.')
          : t('Tu as rejoint le salon {code}.', { code: model.code ?? '' }),
  );
  setText(parts.error, model.error ?? '');
  parts.error.hidden = model.error === null;
  parts.entry.element.hidden = view !== 'entry';
  parts.share.element.hidden = !hosting;
  parts.seatList.hidden = view === 'entry';
  parts.share.show(model.code ?? '', model.link ?? '');
}

function paintStage(stage: StagePanel, model: LobbyModel): void {
  const stages = model.stages ?? [];
  const guest = waitsForHost(model);
  const night = nightOf(model);
  stage.cards.set(stages, model.stageId ?? '', night === 'festival');
  stage.cards.setReadonly(guest);
  stage.element.hidden = lobbyView(model) === 'entry' || !showsStageChoice(stages.length);
  setText(
    stage.label,
    guest ? t('L’hôte choisit la scène') : night === 'festival' ? t('Scène du départ') : t('Scène'),
  );
}

function paintLaunch(nights: NightTabs, footer: LobbyFooter, model: LobbyModel): void {
  const view = lobbyView(model);
  const stages = model.stages ?? [];
  const guest = waitsForHost(model);
  const night = nightOf(model);
  nights.set(night, nightLength(night, stages, model.stageId ?? ''));
  nights.element.hidden = view === 'entry';
  nights.setReadonly(guest);
  setText(footer.launchText, launchLabel(night));
  setText(footer.launchMore, launchDetail(night, stages, model.stageId ?? ''));
  footer.launch.hidden = guest || view === 'entry';
  footer.launch.setAttribute('aria-disabled', String(!model.canLaunch));
  footer.waiting.hidden = !guest;
  setText(footer.leave, view === 'room' ? t('Quitter le salon') : t('Retour au titre'));
}

function paintHint(
  parts: LobbyParts,
  model: LobbyModel,
  prompts: Prompts,
  device: InputDevice | null,
): void {
  if (device === null) {
    return;
  }
  const shown = prompts.for(device);
  parts.nights.setKeys(model.role === 'host' ? shown.tabs : [], shown.style);
  const hint = lobbyHint(model, shown);
  fillHint(parts.hint, hint.parts, hint.style);
}

function rowElement(parts: LobbyParts, row: Row, seat: LobbySeat | null): HTMLElement | null {
  const card = seat === null ? undefined : parts.cards[seat.playerId];
  switch (row) {
    case 'create':
      return parts.entry.create;
    case 'discord':
      return parts.entry.discord;
    case 'code':
      return parts.entry.codeField;
    case 'join':
      return parts.entry.join;
    case 'copy':
      return parts.share.copy;
    case 'name':
      return card?.field ?? null;
    case 'class':
      return card?.stepper.element ?? null;
    case 'stage':
      return parts.stage.cards.element;
    case 'launch':
      return parts.footer.launch;
    case 'leave':
      return parts.footer.leave;
  }
}

function hoverRows(parts: LobbyParts): [HTMLElement, Row][] {
  return [
    [parts.entry.create, 'create'],
    [parts.entry.discord, 'discord'],
    [parts.entry.codeField, 'code'],
    [parts.entry.join, 'join'],
    [parts.share.copy, 'copy'],
    [parts.footer.launch, 'launch'],
    [parts.footer.leave, 'leave'],
  ];
}

function markCurrent(node: HTMLElement, current: boolean): void {
  if (current) {
    node.setAttribute('aria-current', 'true');
  } else {
    node.removeAttribute('aria-current');
  }
}

function paintCursors(parts: LobbyParts, model: LobbyModel, controls: LobbyControls): void {
  const typing = model.seats.find(
    (seat) => parts.cards[seat.playerId]?.input === document.activeElement,
  );
  const marks = controls.marks(typing?.playerId);
  const lit = new Set(marks.lit.map(({ row, seat }) => rowElement(parts, row, seat)));
  for (const node of [...hoverRows(parts).map(([target]) => target), parts.stage.cards.element]) {
    markCurrent(node, lit.has(node));
  }
  for (const card of parts.cards) {
    for (const node of [card.field, card.stepper.element]) {
      markCurrent(node, lit.has(node));
      setFlag(node, 'quiet', marks.quiet.has(card.playerId));
    }
  }
}

function isTyping(inputs: readonly HTMLInputElement[]): boolean {
  return inputs.some((input) => input === document.activeElement);
}

function blurFocused(inputs: readonly HTMLInputElement[]): void {
  for (const input of inputs) {
    if (input === document.activeElement) {
      input.blur();
    }
  }
}

export function createLobby(
  prompts: Prompts,
  actions: LobbyActions,
  classes: readonly ClassInfo[],
  portrait: CreatePortrait,
): LobbyScreen {
  let model: LobbyModel = {
    mode: 'local',
    role: 'host',
    code: null,
    link: null,
    seats: [],
    canLaunch: false,
    error: null,
  };
  let device: InputDevice | null = null;

  const element = el('section', 'ui-screen ui-lobby');
  element.setAttribute('aria-label', t('Salon'));
  element.toggleAttribute('data-many', classes.length > ROW_CARDS);
  const header = createLobbyHeader();
  const error = createLobbyError();
  const entry = createEntryPanel(
    () => {
      actions.createRoom();
    },
    (code) => {
      actions.joinRoom(code);
    },
    roomCodeFromHash(window.location.hash),
  );
  const share = createSharePanel();
  const seatList = el('ol', 'ui-lobby__seats');
  const cards = PLAYER_IDS.map((playerId) =>
    createSeatCard(playerId, classes, portrait, {
      stepClass: (side) => {
        controls.stepChoice(seatAt(model, playerId), 'class', side);
      },
      rename: (name) => {
        actions.seatName(playerId, name);
      },
      join: joinWithKeyboard,
    }),
  );
  seatList.append(...cards.map((card) => card.element));
  const stage = createStagePanel((setId) => {
    actions.chooseStage(setId);
  });
  const nights = createNightTabs((night) => {
    if (model.role === 'host') {
      actions.chooseNight(night);
    }
  });
  const footer = createLobbyFooter();
  const hint = el('p', 'ui-hint');
  const parts: LobbyParts = {
    header,
    error,
    entry,
    share,
    seatList,
    cards,
    stage,
    nights,
    footer,
    hint,
  };
  element.append(lobbyBody(parts));
  const inputs = [entry.codeInput, ...cards.map((card) => card.input)];
  const controls = createLobbyControls({
    current: () => model,
    actions,
    classes,
    nights,
    activate,
  });

  function joinWithKeyboard(): void {
    if (!model.seats.some((seat) => seat.device === 'keyboardMouse')) {
      actions.joinSeat('keyboardMouse');
    }
  }

  function launchNow(): void {
    if (model.canLaunch) {
      actions.launch();
    }
  }

  function activate(row: Row, seat: LobbySeat | null): void {
    switch (row) {
      case 'create':
        actions.createRoom();
        break;
      case 'discord':
        openDiscord();
        break;
      case 'code':
        entry.codeInput.focus();
        break;
      case 'join':
        entry.submit();
        break;
      case 'copy':
        share.copyLink();
        break;
      case 'name':
        if (seat !== null) {
          const input = cards[seat.playerId]?.input;
          input?.focus();
          input?.select();
        }
        break;
      case 'class':
      case 'stage':
        controls.stepChoice(seat, row, 1);
        break;
      case 'launch':
        launchNow();
        break;
      case 'leave':
        actions.leave();
        break;
    }
  }

  function paint(): void {
    paintRoom(parts, model);
    for (const card of cards) {
      paintSeatCard(card, model, classes);
    }
    paintStage(stage, model);
    paintLaunch(nights, footer, model);
    controls.follow();
    paintHint(parts, model, prompts, device);
    paintCursors(parts, model, controls);
  }

  onPointerClick(footer.launch, launchNow);
  onPointerClick(footer.leave, () => {
    actions.leave();
  });
  for (const [node, row] of hoverRows(parts)) {
    onMouseMove(node, () => {
      if (controls.hover(row)) {
        paintCursors(parts, model, controls);
      }
    });
  }
  paint();

  return {
    element,
    setModel(next) {
      model = next;
      paint();
    },
    setDevice(next) {
      if (next !== device) {
        device = next;
        paintHint(parts, model, prompts, device);
      }
    },
    open() {
      controls.open();
      blurFocused(inputs);
      paintCursors(parts, model, controls);
    },
    update(frame, edges) {
      if (isTyping(inputs)) {
        if (edges.back || edges.up || edges.down) {
          blurFocused(inputs);
        }
        return;
      }
      controls.update(frame, edges);
      paintCursors(parts, model, controls);
    },
  };
}
