import type { DeviceId, InputDevice, MenuIntents } from '../input/intents';
import type { PlayerId } from '../sim/state';
import { type ClassInfo, type ClassStepper, createClassStepper } from './class-picker';
import { el, fillHint, setFlag, setText } from './dom';
import {
  NAME_LENGTH,
  type Row,
  SEAT_COUNT,
  SEAT_IDS,
  defaultName,
  deviceLabel,
  deviceOf,
  hasStageChoice,
  lobbyView,
  normalizeRoomCode,
  ownSeat,
  roomCodeFromHash,
  rowsOf,
  seatAt,
  seatName,
  seatRows,
  stepClass,
  stepRow,
} from './lobby-model';
import { type MenuInput, createMenuInput } from './navigation';
import { createStageCards, stepStage } from './stage';
import { onMouseMove } from './pointer';
import { promptsFor } from './prompts';
import type { LobbyModel, LobbySeat, UiFrame } from './types';

export interface LobbyActions {
  joinSeat(device: DeviceId): void;
  goOnline?(): void;
  leaveSeat(playerId: PlayerId): void;
  seatClass(playerId: PlayerId, classId: string): void;
  seatName(playerId: PlayerId, name: string): void;
  chooseStage(setId: string): void;
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

interface SeatCard {
  readonly element: HTMLLIElement;
  readonly field: HTMLElement;
  readonly input: HTMLInputElement;
  readonly stepper: ClassStepper;
  readonly tag: HTMLElement;
  readonly host: HTMLElement;
  readonly name: HTMLElement;
  readonly role: HTMLElement;
  readonly join: HTMLButtonElement;
  readonly wait: HTMLElement;
}

const JOIN_TEXT = 'Appuie sur Entrée ou sur A pour rejoindre';

function button(label: string, className = 'ui-button'): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  node.tabIndex = -1;
  return node;
}

// A click a keyboard or a pad makes (no pointer) already went through the cursor.
function onPointerClick(node: HTMLElement, action: () => void): void {
  node.addEventListener('click', (event) => {
    if (event.detail !== 0) {
      action();
    }
  });
}

export function createLobby(actions: LobbyActions, classes: readonly ClassInfo[]): LobbyScreen {
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
  element.setAttribute('aria-label', 'Salon');

  const heading = el('h2', 'ui-lobby__title');
  const lead = el('p', 'ui-lobby__lead');
  const header = el('header', 'ui-lobby__header');
  header.append(el('p', 'ui-kicker', 'À plusieurs'), heading, lead);

  const error = el('p', 'ui-lobby__error');
  error.setAttribute('role', 'alert');

  const createButton = button('Créer un salon', 'ui-button ui-button--primary');
  const codeInput = el('input', 'ui-lobby__input ui-lobby__input--code');
  codeInput.type = 'text';
  codeInput.autocomplete = 'off';
  codeInput.spellcheck = false;
  codeInput.setAttribute('autocapitalize', 'characters');
  codeInput.setAttribute('aria-label', 'Code du salon');
  codeInput.placeholder = 'Colle le code ici';
  const codeField = el('div', 'ui-lobby__field');
  codeField.append(el('span', 'ui-field__label', 'Code du salon'), codeInput);
  const joinButton = button('Rejoindre');
  const entry = el('div', 'ui-panel ui-lobby__entry');
  entry.append(
    createButton,
    el('p', 'ui-lobby__or', 'ou rejoins le salon d’un ami'),
    codeField,
    joinButton,
  );

  const codeText = el('p', 'ui-lobby__code');
  const linkText = el('p', 'ui-lobby__link');
  const copyButton = button('Copier le lien');
  const copyStatus = el('p', 'ui-lobby__copy');
  copyStatus.setAttribute('role', 'status');
  const share = el('div', 'ui-panel ui-lobby__share');
  const shareText = el('div', 'ui-lobby__sharetext');
  shareText.append(el('p', 'ui-panel__label', 'Code du salon'), codeText, linkText, copyStatus);
  share.append(shareText, copyButton);

  const seatList = el('ol', 'ui-lobby__seats');
  const cards: SeatCard[] = [];
  for (const playerId of SEAT_IDS) {
    const card = createSeat(playerId);
    cards.push(card);
    seatList.append(card.element);
  }

  function createSeat(playerId: PlayerId): SeatCard {
    const item = el('li', 'ui-seat');
    const number = el('span', 'ui-seat__number', String(playerId + 1));
    number.setAttribute('aria-hidden', 'true');
    const tag = el('p', 'ui-seat__tag');
    const host = el('p', 'ui-seat__host', 'Lance le set');
    const who = el('div', 'ui-seat__who');
    who.append(tag, host);
    const head = el('div', 'ui-seat__head');
    head.append(number, who);

    const input = el('input', 'ui-lobby__input');
    input.type = 'text';
    input.maxLength = NAME_LENGTH;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = defaultName(playerId);
    input.setAttribute('aria-label', `Nom du joueur ${String(playerId + 1)}`);
    const field = el('div', 'ui-lobby__field');
    field.append(el('span', 'ui-field__label', 'Nom'), input);
    const name = el('p', 'ui-seat__name');

    const stepper = createClassStepper(classes, (side) => {
      const seat = seatAt(model, playerId);
      const next = seat === null ? null : stepClass(classes, seat.classId, side);
      if (next !== null) {
        actions.seatClass(playerId, next);
      }
    });
    const role = el('p', 'ui-seat__role');
    const join = button(JOIN_TEXT, 'ui-seat__join');
    const wait = el('p', 'ui-seat__wait', 'En attente d’un joueur');
    item.append(head, join, wait, field, name, stepper.element, role);

    input.addEventListener('input', () => {
      actions.seatName(playerId, seatName(input.value, playerId));
    });
    onPointerClick(join, joinWithKeyboard);
    return { element: item, field, input, stepper, tag, host, name, role, join, wait };
  }

  const stageLabel = el('p', 'ui-panel__label');
  const stageCards = createStageCards('Scène', (setId) => {
    actions.chooseStage(setId);
  });
  const stagePanel = el('div', 'ui-lobby__stage');
  stagePanel.append(stageLabel, stageCards.element);

  const onlineButton = button('Jouer en ligne');
  const launchButton = button('Lancer le set', 'ui-button ui-button--primary');
  const waiting = el('p', 'ui-lobby__waiting', 'En attente de l’hôte');
  waiting.setAttribute('role', 'status');
  const leaveButton = button('Retour au titre');
  const footer = el('div', 'ui-lobby__actions');
  footer.append(launchButton, waiting, onlineButton, leaveButton);
  const hint = el('p', 'ui-hint');

  const body = el('div', 'ui-lobby__body');
  body.append(header, error, entry, share, seatList, stagePanel, footer, hint);
  element.append(body);

  const inputs = [codeInput, ...cards.map((card) => card.input)];

  function typing(): boolean {
    return inputs.some((input) => input === document.activeElement);
  }

  function blurInputs(): void {
    for (const input of inputs) {
      if (input === document.activeElement) {
        input.blur();
      }
    }
  }

  function joinWithKeyboard(): void {
    if (!model.seats.some((seat) => seat.device === 'keyboardMouse')) {
      actions.joinSeat('keyboardMouse');
    }
  }

  function joinNow(): void {
    const code = normalizeRoomCode(codeInput.value);
    if (code !== '') {
      actions.joinRoom(code);
    }
  }

  function launchNow(): void {
    if (model.canLaunch) {
      actions.launch();
    }
  }

  async function copyLink(): Promise<void> {
    const link = model.link ?? '';
    try {
      await navigator.clipboard.writeText(link);
      setText(copyStatus, 'Lien copié, envoie-le à tes amis.');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(linkText);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setText(copyStatus, 'Lien sélectionné : copie-le avec Ctrl+C.');
    }
  }

  function copyNow(): void {
    void copyLink();
  }

  onPointerClick(createButton, () => {
    actions.createRoom();
  });
  onPointerClick(joinButton, joinNow);
  onPointerClick(copyButton, copyNow);
  onPointerClick(launchButton, launchNow);
  onPointerClick(onlineButton, () => {
    actions.goOnline?.();
  });
  onPointerClick(leaveButton, () => {
    actions.leave();
  });

  codeInput.addEventListener('input', () => {
    const code = normalizeRoomCode(codeInput.value);
    if (code !== codeInput.value) {
      codeInput.value = code;
    }
  });
  codeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      codeInput.blur();
      joinNow();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      codeInput.blur();
    }
  });
  for (const card of cards) {
    card.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        card.input.blur();
      }
    });
  }

  const linked = roomCodeFromHash(window.location.hash);
  if (linked !== '') {
    codeInput.value = linked;
  }

  // Online, one cursor for the one device of this screen; locally, one cursor per seat.
  let cursor = 0;
  let cursorView = lobbyView(model);
  const seatCursors = new Map<PlayerId, number>();
  let activeSeat: PlayerId | null = null;
  const seatInputs = new Map<PlayerId, MenuInput>();
  const deviceInputs = new Map<DeviceId, MenuInput>();

  function rowElement(row: Row, seat: LobbySeat | null): HTMLElement | null {
    const card = seat === null ? undefined : cards[seat.playerId];
    switch (row) {
      case 'create':
        return createButton;
      case 'code':
        return codeField;
      case 'join':
        return joinButton;
      case 'copy':
        return copyButton;
      case 'name':
        return card?.field ?? null;
      case 'class':
        return card?.stepper.element ?? null;
      case 'stage':
        return stageCards.element;
      case 'launch':
        return launchButton;
      case 'online':
        return onlineButton;
      case 'leave':
        return leaveButton;
    }
  }

  function paintCursors(): void {
    const marked: (HTMLElement | null)[] = [];
    const typing = model.seats.find(
      (seat) => cards[seat.playerId]?.input === document.activeElement,
    );
    const lead = typing?.playerId ?? activeSeat ?? model.seats[0]?.playerId;
    if (model.mode === 'local') {
      for (const seat of model.seats) {
        const row = rowsOfSeat(seat)[seatCursors.get(seat.playerId) ?? 0];
        marked.push(row === undefined ? null : rowElement(row, seat));
      }
    } else {
      const row = rowsOf(model)[cursor];
      marked.push(row === undefined ? null : rowElement(row, ownSeat(model)));
    }
    const lit = new Set(marked);
    const all: HTMLElement[] = [
      createButton,
      codeField,
      joinButton,
      copyButton,
      stageCards.element,
      launchButton,
      onlineButton,
      leaveButton,
      ...cards.flatMap((card) => [card.field, card.stepper.element]),
    ];
    for (const node of all) {
      if (lit.has(node)) {
        node.setAttribute('aria-current', 'true');
      } else {
        node.removeAttribute('aria-current');
      }
      const seat = model.seats.find(
        (candidate) =>
          cards[candidate.playerId]?.field === node ||
          cards[candidate.playerId]?.stepper.element === node,
      );
      setFlag(
        node,
        'quiet',
        model.mode === 'local' &&
          model.seats.length > 1 &&
          seat !== undefined &&
          seat.playerId !== lead,
      );
    }
  }

  function hoverRow(node: HTMLElement, row: Row): void {
    onMouseMove(node, () => {
      if (model.mode === 'online') {
        const index = rowsOf(model).indexOf(row);
        if (index >= 0 && index !== cursor) {
          cursor = index;
          paintCursors();
        }
      }
    });
  }
  const hovered: [HTMLElement, Row][] = [
    [createButton, 'create'],
    [codeField, 'code'],
    [joinButton, 'join'],
    [copyButton, 'copy'],
    [launchButton, 'launch'],
    [leaveButton, 'leave'],
  ];
  for (const [node, row] of hovered) {
    hoverRow(node, row);
  }

  function activate(row: Row, seat: LobbySeat | null): void {
    switch (row) {
      case 'create':
        actions.createRoom();
        break;
      case 'code':
        codeInput.focus();
        break;
      case 'join':
        joinNow();
        break;
      case 'copy':
        copyNow();
        break;
      case 'name':
        if (seat !== null) {
          const input = cards[seat.playerId]?.input;
          input?.focus();
          input?.select();
        }
        break;
      case 'class':
        if (seat !== null) {
          const next = stepClass(classes, seat.classId, 1);
          if (next !== null) {
            actions.seatClass(seat.playerId, next);
          }
        }
        break;
      case 'stage':
        stepNow(1);
        break;
      case 'launch':
        launchNow();
        break;
      case 'online':
        actions.goOnline?.();
        break;
      case 'leave':
        actions.leave();
        break;
    }
  }

  function stepNow(direction: -1 | 1): void {
    const next = stepStage(model.stages ?? [], model.stageId ?? '', direction);
    if (next !== null) {
      actions.chooseStage(next);
    }
  }

  function side(seat: LobbySeat | null, row: Row | undefined, direction: -1 | 1): void {
    if (row === 'stage') {
      stepNow(direction);
      return;
    }
    if (seat === null || row !== 'class') {
      return;
    }
    const next = stepClass(classes, seat.classId, direction);
    if (next !== null) {
      actions.seatClass(seat.playerId, next);
    }
  }

  function updateOnline(edges: MenuIntents): void {
    const rows = rowsOf(model);
    const step = stepRow(rows.length, Math.min(cursor, rows.length - 1), edges);
    const row = rows[step.index];
    if (step.side !== 0) {
      side(ownSeat(model), row, step.side);
    }
    if (step.index !== cursor) {
      cursor = step.index;
    }
    if (step.back) {
      actions.leave();
    } else if (step.confirmed && row !== undefined) {
      activate(row, ownSeat(model));
    }
    paintCursors();
  }

  // Made when the seat shows, so a key pressed after that counts, and one still held from before
  // waits for its release.
  function seatInput(playerId: PlayerId): MenuInput {
    let input = seatInputs.get(playerId);
    if (input === undefined) {
      input = createMenuInput();
      input.open();
      seatInputs.set(playerId, input);
    }
    return input;
  }

  function rowsOfSeat(seat: LobbySeat): readonly Row[] {
    return seatRows(seat, model).filter(
      (row) => row !== 'online' || actions.goOnline !== undefined,
    );
  }

  function updateLocal(frame: UiFrame, edges: MenuIntents): void {
    let acted = false;
    for (const seat of model.seats) {
      const player = frame.players.find((entry) => entry.playerId === seat.playerId);
      if (seat.remote || player === undefined) {
        continue;
      }
      const input = seatInput(seat.playerId);
      const own = input.edges(player.snapshot.menu, player.snapshot.gameplay.move);
      const rows = rowsOfSeat(seat);
      const step = stepRow(rows.length, seatCursors.get(seat.playerId) ?? 0, own);
      const row = rows[step.index];
      seatCursors.set(seat.playerId, step.index);
      if (Object.values(own).some(Boolean)) {
        activeSeat = seat.playerId;
      }
      if (step.side !== 0) {
        side(seat, rows[step.index], step.side);
      }
      if (step.back) {
        acted = true;
        actions.leaveSeat(seat.playerId);
      } else if (step.confirmed && row !== undefined) {
        acted = true;
        activate(row, seat);
      }
    }
    if (!acted && edges.back && model.seats.length === 0) {
      actions.leave();
    } else if (!acted && frame.devices !== undefined) {
      for (const { device: id, snapshot } of frame.devices) {
        let input = deviceInputs.get(id);
        if (input === undefined) {
          input = createMenuInput();
          input.open();
          deviceInputs.set(id, input);
        }
        const pressed = input.edges(snapshot.menu, snapshot.gameplay.move).confirm;
        if (
          pressed &&
          model.seats.length < SEAT_COUNT &&
          !model.seats.some((seat) => seat.device === id)
        ) {
          actions.joinSeat(id);
          break;
        }
      }
    } else if (!acted && frame.devices === undefined && edges.confirm) {
      const taker = deviceOf(frame.snapshot.device);
      if (
        taker !== null &&
        model.seats.length < SEAT_COUNT &&
        !model.seats.some((seat) => seat.device === taker)
      ) {
        actions.joinSeat(taker);
      }
    }
    paintCursors();
  }

  function paintHint(): void {
    if (device === null) {
      return;
    }
    const prompts = promptsFor(device);
    if (model.mode === 'local') {
      fillHint(
        hint,
        [
          { keys: ['Entrée', 'A'], label: 'rejoindre' },
          { keys: prompts.navigateRow, label: hasStageChoice(model) ? 'classe, scène' : 'classe' },
          { keys: [prompts.confirm], label: 'valider' },
          { keys: ['Échap', 'B'], label: 'quitter sa place' },
        ],
        'key',
      );
      return;
    }
    fillHint(
      hint,
      [
        { keys: prompts.navigate, label: 'naviguer' },
        ...(lobbyView(model) === 'entry'
          ? []
          : [
              {
                keys: prompts.navigateRow,
                label: hasStageChoice(model) ? 'classe, scène' : 'classe',
              },
            ]),
        { keys: [prompts.confirm], label: 'valider' },
        { keys: [prompts.back], label: 'quitter' },
      ],
      prompts.style,
    );
  }

  function seatTag(seat: LobbySeat): string {
    if (model.mode === 'local') {
      return deviceLabel(seat.device);
    }
    if (seat.remote) {
      return seat.host ? 'Hôte' : 'Invité';
    }
    return seat.host ? 'Toi · hôte' : 'Toi';
  }

  function paintSeat(card: SeatCard, playerId: PlayerId): void {
    const seat = seatAt(model, playerId);
    const view = lobbyView(model);
    const editable = seat !== null && !seat.remote;
    card.element.dataset.state = seat === null ? 'empty' : 'taken';
    setFlag(card.element, 'own', editable);
    card.join.hidden = !(seat === null && view === 'local');
    card.wait.hidden = !(seat === null && view !== 'local');
    card.field.hidden = !editable;
    card.name.hidden = seat === null || editable;
    card.stepper.element.hidden = seat === null;
    card.role.hidden = seat === null;
    card.tag.hidden = seat === null;
    card.host.hidden = seat === null || !seat.host || view !== 'local';
    card.stepper.element.toggleAttribute('data-readonly', !editable);
    if (seat === null) {
      return;
    }
    setText(card.tag, seatTag(seat));
    setText(card.name, seat.name);
    if (document.activeElement !== card.input && card.input.value !== seat.name) {
      card.input.value = seat.name;
    }
    card.stepper.set(seat.classId);
    setText(card.role, classes.find((info) => info.id === seat.classId)?.role ?? '');
  }

  function paint(): void {
    const view = lobbyView(model);
    setText(heading, model.mode === 'online' ? 'Salon en ligne' : 'Salon local');
    const own = ownSeat(model);
    const hosting = view === 'room' && own?.host === true;
    setText(
      lead,
      view === 'local'
        ? 'Chacun prend une place avec son clavier ou sa manette.'
        : view === 'entry'
          ? 'Crée un salon pour inviter tes amis, ou rejoins le leur avec son code.'
          : hosting
            ? 'Envoie le code ou le lien à tes amis, puis lance le set.'
            : `Tu as rejoint le salon ${model.code ?? ''}.`,
    );
    setText(error, model.error ?? '');
    error.hidden = model.error === null;
    entry.hidden = view !== 'entry';
    share.hidden = !hosting;
    seatList.hidden = view === 'entry';
    setText(codeText, model.code ?? '');
    setText(linkText, model.link ?? '');
    SEAT_IDS.forEach((playerId) => {
      const card = cards[playerId];
      if (card !== undefined) {
        paintSeat(card, playerId);
      }
    });

    const stages = model.stages ?? [];
    const guest = view === 'room' && !hosting;
    stageCards.set(stages, model.stageId ?? '');
    stageCards.setReadonly(guest);
    stagePanel.hidden = view === 'entry' || stages.length < 2;
    setText(stageLabel, guest ? 'L’hôte choisit la scène' : 'Scène');
    launchButton.hidden = guest || view === 'entry';
    onlineButton.hidden = view !== 'local' || actions.goOnline === undefined;
    launchButton.setAttribute('aria-disabled', String(!model.canLaunch));
    waiting.hidden = !guest;
    setText(leaveButton, view === 'room' ? 'Quitter le salon' : 'Retour au titre');

    if (view !== cursorView) {
      cursorView = view;
      cursor = 0;
    }
    cursor = Math.min(cursor, Math.max(rowsOf(model).length - 1, 0));
    for (const playerId of [...seatCursors.keys()]) {
      if (seatAt(model, playerId) === null) {
        seatCursors.delete(playerId);
        seatInputs.delete(playerId);
      }
    }
    for (const seat of model.seats) {
      if (!seat.remote) {
        seatInput(seat.playerId);
      }
    }
    paintHint();
    paintCursors();
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
        paintHint();
      }
    },
    open() {
      cursor = 0;
      seatCursors.clear();
      seatInputs.clear();
      deviceInputs.clear();
      blurInputs();
      paintCursors();
    },
    update(frame, edges) {
      if (typing()) {
        if (edges.back || edges.up || edges.down) {
          blurInputs();
        }
        return;
      }
      if (lobbyView(model) === 'local') {
        updateLocal(frame, edges);
      } else {
        updateOnline(edges);
      }
    },
  };
}
