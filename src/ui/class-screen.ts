import type { TeaserDefinition } from '../data/types';
import type { DeviceId, InputDevice, MenuIntents } from '../input/intents';
import { defaultName, t } from '../shared/i18n';
import { PLAYER_IDS, type PlayerId } from '../sim/state';
import {
  type ClassInfo,
  ROW_CARDS,
  classColor,
  landscapeNotice,
  swatchPortrait,
} from './class-picker';
import { CLASS_TEASERS, classTeaser } from './teaser';
import { el, fillHint, goMark, onFontsLoaded, setText } from './dom';
import { spreadCards } from './class-cards';
import { launchDetail, launchLabel, nightOf } from './night';
import { PLAY } from './icons';
import { createEndlessToggle } from './endless';
import { createButtonRow } from './button-row';
import { NO_MENU_INTENTS } from './navigation';
import { type DrivenSeat, createClassCursors } from './class-cursors';
import { createSeatInputs, unplugged } from './seat-input';
import { createClassHero, createInvite, createSeatSheet } from './seat-sheet';
import type { Prompts } from './prompts';
import type { ClassPickerModel, CreatePortrait, PickerSeat, UiFrame } from './types';

export interface ClassPickerActions {
  // With no seat, on a touch screen.
  choose(classId: string): void;
  seatClass(playerId: PlayerId, classId: string): void;
  joinSeat(device: DeviceId): void;
  leaveSeat(playerId: PlayerId): void;
  handOverSeat(playerId: PlayerId, device: DeviceId): void;
  toggleEndless(enabled: boolean): void;
  confirm(): void;
  learn(): void;
  leave(): void;
}

export interface ClassPickerScreen {
  readonly element: HTMLElement;
  // The cards are picked, not the switch.
  open(): void;
  setModel(model: ClassPickerModel): void;
  setDevice(device: InputDevice): void;
  // With no seat the merged edges drive the one cursor; otherwise each seat its own.
  update(edges: MenuIntents, frame: UiFrame): void;
}

// A short article holds on to the word after it: « Le » never stands alone on the first line.
export function keepArticle(name: string): string {
  return name.replace(/^(\S{1,3}) /u, '$1\u00a0');
}

// The one player of a touch screen has no seat: the merged input drives their cursor.
function unseated(model: ClassPickerModel): PickerSeat {
  return { playerId: 0, classId: model.classId, device: null };
}

// Two players read their sheets side by side over the grid; three or four, on both sides of it,
// each in the corner of their number. The invite takes the place of the next one to join.
function slotOf(seats: readonly PickerSeat[], playerId: PlayerId): string {
  const order = seats.findIndex((seat) => seat.playerId === playerId);
  return `s${String(seats.length > 2 ? playerId : order)}`;
}

function inviteSlot(seats: readonly PickerSeat[]): string {
  if (seats.length < 2) {
    return 's1';
  }
  const free = PLAYER_IDS.find((id) => seats.every((seat) => seat.playerId !== id));
  return seats.length === 2 ? 's2' : `s${String(free ?? 3)}`;
}

export function createClassPicker(
  prompts: Prompts,
  classes: readonly ClassInfo[],
  portrait: CreatePortrait,
  actions: ClassPickerActions,
  now: () => number,
  teasers: readonly TeaserDefinition[] = CLASS_TEASERS,
): ClassPickerScreen {
  let model: ClassPickerModel = {
    classId: classes[0]?.id ?? '',
    stage: null,
    endless: false,
    seats: [],
  };
  let device: InputDevice | null = null;
  // The press on a button came from the first seat's cursor, not from the mouse.
  let cursorPress = false;
  // Opened while hidden: the first model it shows after lays it out.
  let layOutDue = false;

  const element = el('section', 'ui-screen ui-classpicker');
  element.setAttribute('aria-label', t('Character choice'));
  const grid = classes.length > ROW_CARDS;
  const many = classes.length + teasers.length > ROW_CARDS;
  element.toggleAttribute('data-many', many);
  const header = el('header', 'ui-lobby__header');
  header.append(el('h2', 'ui-lobby__title', t('Pick your character')));

  const hero = createClassHero(classes, portrait);
  const sheets = PLAYER_IDS.map((playerId) => createSeatSheet(playerId, classes, portrait));
  // Never seen: a disc stands in for their portraits.
  const heroTwin = createClassHero(classes, () => swatchPortrait(classes));
  const sheetTwin = createSeatSheet(0, classes, () => swatchPortrait(classes));
  sheetTwin.element.dataset.slot = 's0';
  const invite = createInvite();

  const row = el('div', 'ui-classcards');
  row.setAttribute('aria-label', t('Classes'));
  const endless = createEndlessToggle((enabled) => {
    actions.toggleEndless(enabled);
  });
  const goes = classes.map(() => goMark(PLAY));
  const cards = classes.map((entry, index) => {
    const card = el('button', 'ui-classcard');
    card.type = 'button';
    card.tabIndex = -1;
    card.style.setProperty('--class-color', classColor(entry));
    const thumb = portrait();
    thumb.setClass(entry.id);
    const frame = el('span', 'ui-classcard__portrait');
    frame.append(thumb.element);
    card.append(frame, el('span', 'ui-classcard__name', keepArticle(t(entry.name))));
    const go = goes[index];
    if (go !== undefined) {
      card.append(go.element);
    }
    card.addEventListener('click', (event) => {
      event.stopPropagation();
      if (model.seats.length > 0) {
        cursors.click(model.seats, entry.id);
        paint();
      } else if (entry.id === model.classId) {
        actions.confirm();
      } else {
        actions.choose(entry.id);
      }
    });
    return card;
  });
  row.append(...cards, ...teasers.map(classTeaser));
  // Its border box, which the padding leaves alone, measured on the next frame, once laid out.
  if (many && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      requestAnimationFrame(() => {
        spreadCards(row);
      });
    }).observe(row, { box: 'border-box' });
  }

  const confirm = el('button', 'ui-button ui-button--primary ui-launch');
  confirm.type = 'button';
  confirm.tabIndex = -1;
  const confirmText = el('span', 'ui-launch__label');
  const confirmMore = el('span', 'ui-launch__detail');
  confirm.append(confirmText, confirmMore);
  const learn = el('button', 'ui-button', t('Learn to play'));
  learn.type = 'button';
  learn.tabIndex = -1;
  const back = el('button', 'ui-button');
  back.type = 'button';
  back.tabIndex = -1;
  confirm.addEventListener('click', () => {
    if (model.seats.length === 0) {
      actions.confirm();
    } else {
      cursors.pressLaunch(model.seats, cursorPress ? 'cursor' : 'mouse');
      paint();
    }
  });
  learn.addEventListener('click', () => {
    actions.learn();
  });
  back.addEventListener('click', () => {
    actions.leave();
  });
  const buttons = createButtonRow(row, [endless.toggle.button, confirm, learn, back]);
  const footer = el('div', 'ui-lobby__actions');
  // In the row of the buttons: the picker already fills the height of a laptop screen.
  footer.append(endless.toggle.button, confirm, learn, back);
  const hint = el('p', 'ui-hint');
  // The sheets of the players together: laid out by the picks, or stacked in a column of their own.
  const seatsBox = el('div', 'ui-picks__seats');
  const picks = el('div', 'ui-picks');
  picks.append(hero.element, seatsBox, invite.element, row);
  const body = el('div', 'ui-lobby__body');
  body.append(header, landscapeNotice(), picks, footer, hint);
  element.append(body);
  // On the next frame, as the cards: a sheet changes width with the screen, and a sheet joins.
  if (typeof ResizeObserver !== 'undefined') {
    const rooms = new ResizeObserver(() => {
      requestAnimationFrame(keepSheetRooms);
    });
    for (const part of [hero.element, ...sheets.map((seatSheet) => seatSheet.element)]) {
      rooms.observe(part);
    }
  }
  // Cards and sheets laid in a fallback face hold names its own face wraps otherwise once it loads.
  onFontsLoaded(() => {
    if (element.offsetWidth > 0) {
      layOut();
    }
  });

  const inputs = createSeatInputs(now);
  // A click of the mouse takes the lone seat back from a pad, as a key does, before the click acts.
  element.addEventListener(
    'pointerdown',
    (event) => {
      const alone = model.seats.length === 1 ? model.seats[0] : undefined;
      if (
        event.pointerType !== 'mouse' ||
        alone === undefined ||
        alone.device === 'keyboardMouse'
      ) {
        return;
      }
      inputs.handOver(alone.playerId, 'keyboardMouse');
      actions.handOverSeat(alone.playerId, 'keyboardMouse');
    },
    { capture: true },
  );
  const cursors = createClassCursors(
    classes,
    {
      columns() {
        const top = cards[0]?.offsetTop;
        return Math.max(1, cards.filter((card) => card.offsetTop === top).length);
      },
      inButtons: () => buttons.focused !== null,
      buttons(edges) {
        const focused = buttons.focused;
        cursorPress = true;
        const taken = buttons.handle(edges);
        cursorPress = false;
        if (buttons.focused !== focused) {
          paintHint();
        }
        return taken;
      },
    },
    {
      pick(playerId, classId) {
        if (model.seats.length === 0) {
          actions.choose(classId);
        } else {
          actions.seatClass(playerId, classId);
        }
        if (model.seats.length < 2) {
          cards[classes.findIndex((entry) => entry.id === classId)]?.scrollIntoView({
            block: 'nearest',
          });
        }
      },
      leaveSeat(playerId) {
        actions.leaveSeat(playerId);
      },
      launch() {
        actions.confirm();
      },
      back() {
        actions.leave();
      },
    },
  );

  // Its first frame shows the cards and sheets at their size: measured in the task that shows the
  // screen, not by the resize observers a frame later.
  function layOut(): void {
    keepSheetRooms();
    if (many) {
      spreadCards(row);
    }
  }

  function together(): boolean {
    return model.seats.length > 1;
  }

  // Never on a touch screen, which has no device of its own to join with.
  function joinable(): boolean {
    return device !== 'touch' && model.seats.length < PLAYER_IDS.length;
  }

  function paintHint(): void {
    if (device === null) {
      return;
    }
    const shown = prompts.for(device);
    fillHint(
      hint,
      [
        {
          keys: grid ? [...new Set([...shown.navigateRow, ...shown.navigate])] : shown.navigateRow,
          label: t('choose'),
        },
        {
          keys: [shown.confirm],
          label: confirmLabel(),
        },
        { keys: [shown.back], label: t('back') },
      ],
      shown.style,
    );
  }

  function confirmLabel(): string {
    const focused = buttons.focused;
    if (focused === endless.toggle.button) {
      return t('change');
    }
    if (focused === learn) {
      return t('learn');
    }
    if (focused === back) {
      return t('confirm');
    }
    return together() && (focused === null || focused === confirm) ? t('ready') : t('start');
  }

  function paintHero(classId: string): void {
    const chosen = classes.find((entry) => entry.id === classId);
    if (chosen === undefined) {
      return;
    }
    element.style.setProperty('--class-color', classColor(chosen));
    hero.show(chosen);
  }

  // A twin standing where its sheet stands, unstretched, shows each class in turn.
  function tallest(
    twin: HTMLElement,
    kept: HTMLElement,
    place: HTMLElement,
    show: (info: ClassInfo) => void,
  ): string {
    twin.style.alignSelf = 'start';
    place.prepend(twin);
    const heights = classes.map((info) => {
      show(info);
      return kept.getBoundingClientRect().height;
    });
    twin.remove();
    return `${String(Math.max(0, ...heights))}px`;
  }

  // Every sheet is as tall as its tallest class at its width: no cursor move resizes the cards.
  function keepSheetRooms(): void {
    if (!hero.element.hidden) {
      hero.info.style.minHeight = tallest(heroTwin.element, heroTwin.info, picks, (info) => {
        heroTwin.show(info);
      });
    }
    if (together()) {
      const room = tallest(sheetTwin.element, sheetTwin.element, seatsBox, (info) => {
        sheetTwin.show(info, false);
      });
      for (const seatSheet of sheets) {
        seatSheet.element.style.minHeight = room;
      }
    }
  }

  // Only the sheets of the seats taken are on the page: alone, it reads as it always did.
  function paintSheets(): void {
    const { seats } = model;
    for (const [playerId, seatSheet] of sheets.entries()) {
      const seat = seats.find((one) => one.playerId === playerId);
      const chosen = classes.find((entry) => entry.id === seat?.classId);
      if (!together() || seat === undefined || chosen === undefined) {
        seatSheet.element.remove();
        continue;
      }
      if (!seatSheet.element.isConnected) {
        seatsBox.append(seatSheet.element);
      }
      seatSheet.element.dataset.slot = slotOf(seats, seat.playerId);
      seatSheet.show(chosen, cursors.isReady(seat.playerId));
    }
    paintInvite();
  }

  function paintInvite(): void {
    invite.element.hidden = !joinable();
    invite.element.dataset.slot = inviteSlot(model.seats);
  }

  // Alone, the cards are radios. Together, each card under a cursor wears its seat's ring and
  // number, and is out of reach of the others.
  function paintCards(): void {
    const several = together();
    row.setAttribute('role', several ? 'group' : 'radiogroup');
    const shown = model.seats[0]?.classId ?? model.classId;
    classes.forEach((entry, index) => {
      const card = cards[index];
      if (card === undefined) {
        return;
      }
      const holder = several ? model.seats.find((seat) => seat.classId === entry.id) : undefined;
      if (several) {
        card.removeAttribute('role');
        card.removeAttribute('aria-checked');
      } else {
        card.setAttribute('role', 'radio');
        card.setAttribute('aria-checked', String(entry.id === shown));
      }
      if (holder === undefined) {
        delete card.dataset.seat;
        card.removeAttribute('aria-disabled');
        card.removeAttribute('aria-label');
      } else {
        card.dataset.seat = String(holder.playerId + 1);
        card.setAttribute('aria-disabled', 'true');
        card.setAttribute('aria-label', `${t(entry.name)}, ${defaultName(holder.playerId)}`);
      }
      card.toggleAttribute('data-ready', holder !== undefined && cursors.isReady(holder.playerId));
    });
  }

  function paintLaunch(): void {
    const { stage } = model;
    const oneScene = stage === null;
    const night = oneScene ? 'stage' : nightOf(stage);
    const waiting = cursors.waiting(model.seats);
    setText(
      confirmText,
      waiting === null
        ? launchLabel(night)
        : t('Waiting for {name}', { name: defaultName(waiting.playerId) }),
    );
    setText(
      confirmMore,
      oneScene || waiting !== null ? '' : launchDetail(night, stage.stages, stage.stageId),
    );
    confirm.setAttribute(
      'aria-disabled',
      String(
        waiting !== null &&
          cursors.presser(model.seats, 'cursor') === null &&
          cursors.presser(model.seats, 'mouse') === null,
      ),
    );
    for (const go of goes) {
      go.set(launchLabel(night));
    }
    // The tutorial takes the place of the endless switch, which the scene screen asks for.
    endless.set(model.endless, oneScene);
    learn.hidden = oneScene || together();
    setText(back, oneScene ? t('Back to the title') : t('Back to the stage'));
  }

  function paint(): void {
    element.dataset.seats = String(model.seats.length);
    element.toggleAttribute('data-together', together());
    hero.element.hidden = together();
    paintHero(model.seats[0]?.classId ?? model.classId);
    paintSheets();
    paintCards();
    paintLaunch();
    paintHint();
  }

  function drive(driven: readonly DrivenSeat[]): void {
    if (cursors.update(driven)) {
      paint();
    }
  }

  paint();

  return {
    element,
    open() {
      buttons.reset();
      inputs.clear();
      cursors.open();
      paint();
      layOutDue = true;
    },
    setModel(next) {
      model = next;
      inputs.keep(next.seats);
      cursors.follow(next.seats);
      paint();
      if (layOutDue && element.offsetWidth > 0) {
        layOutDue = false;
        layOut();
      }
    },
    setDevice(next) {
      if (next !== device) {
        device = next;
        paintInvite();
        paintHint();
      }
    },
    update(edges, frame) {
      const gone = unplugged(frame.devices, model.seats);
      if (gone !== null) {
        actions.leaveSeat(gone);
        return;
      }
      const newcomer = inputs.newcomer(frame.devices, model.seats);
      invite.hold(inputs.holdToJoin());
      const alone = model.seats[0];
      if (newcomer?.does === 'takeOver' && alone !== undefined) {
        inputs.handOver(alone.playerId, newcomer.device);
        actions.handOverSeat(alone.playerId, newcomer.device);
        drive(model.seats.map((seat) => ({ seat, edges: newcomer.edges })));
        return;
      }
      if (newcomer?.does === 'join' && joinable()) {
        actions.joinSeat(newcomer.device);
        return;
      }
      if (newcomer?.does === 'knock') {
        invite.knock();
      }
      drive(
        model.seats.length === 0
          ? [{ seat: unseated(model), edges }]
          : model.seats.map((seat) => {
              const own = frame.players.find((player) => player.playerId === seat.playerId);
              return {
                seat,
                edges:
                  own === undefined ? NO_MENU_INTENTS : inputs.edges(seat.playerId, own.snapshot),
              };
            }),
      );
    },
  };
}
