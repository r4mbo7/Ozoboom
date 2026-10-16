import type { GameContent } from '../data/types';
import type { InputDevice, InputSnapshot } from '../input/intents';
import { t } from '../shared/i18n';
import { beatPeriodMs } from '../shared/tempo';
import { setOf, setTempo } from '../sim/lineup';
import type { PlayerId, PlayerState, SimState, UpgradeOffer } from '../sim/state';
import { el, fillHint, icon, setFlag, setText, setVar } from './dom';
import {
  SIXTEENTHS_PER_BAR,
  type Card,
  type Celebrated,
  type Pearls,
  type WaitChip,
  type WeaponCard,
  cardFor,
  cardName,
  dealOf,
  offerHeading,
  offerKicker,
  pickOf,
  waitingFor,
} from './cards';
import { formatNumber } from './format';
import { playerLabel } from './hud-model';
import { classMark, familyIcon, medallion, weaponIcon } from './icons';
import { type Menu, createMenu } from './menu';
import { type MenuInput, createMenuInput } from './navigation';
import { promptsFor } from './prompts';
import type { UiFrame, UpgradeCue } from './types';
import { createWho, fillWho, whoColor } from './who';

export interface UpgradeOverlay {
  readonly element: HTMLElement;
  // The sparks of the menu, over everything: they outlive the menu that throws them.
  readonly effects: HTMLElement;
  // Shows the offer of each player of this screen side by side, each driven by that player's own
  // snapshot, and who the others are still waited for. Hides itself when nobody is choosing.
  update(state: SimState, frame: UiFrame, content: GameContent, now: number): void;
  hide(): void;
}

export interface UpgradeHost {
  // Nothing moves: no choice is held for a motion nobody sees.
  calm(): boolean;
  choose(playerId: PlayerId, upgradeId: string): void;
  cue(cue: UpgradeCue, variant: number): void;
  // Where the card a player took lands in the HUD, null when the HUD does not show that player.
  landing(playerId: PlayerId, weaponId: string | null): HTMLElement | null;
}

const MENU_GRACE_MS = 500;
// A dealt card sounds when it touches down, not when it leaves.
const DEAL_NOTE_MS = 70;
const SLAM_BEATS = 1;
const BURST_BEATS = 0.2;
const FLIGHT_BEATS = 0.8;
const FLIGHT_STAGGER_BEATS = 0.2;
const LIT_BEATS = 1;
const SHARDS = 24;
const STARS = 14;

// What the menu does later, at a time of its own clock: it has no timer, only its updates.
interface Later {
  at: number;
  run(): void;
}

function runDue(later: readonly Later[], now: number): Later[] {
  for (const step of later.filter((entry) => entry.at <= now)) {
    step.run();
  }
  return later.filter((entry) => entry.at > now);
}

function stripLabel({ steps, everyBars }: WeaponCard): string {
  if (steps === 'continuous') {
    return t('Joue en continu');
  }
  const fired = steps.flatMap((on, step) => (on ? [formatNumber(step + 1)] : [])).join(', ');
  return everyBars > 1
    ? t('Tire sur les doubles croches {steps}, une mesure sur {bars}', {
        steps: fired,
        bars: formatNumber(everyBars),
      })
    : t('Tire sur les doubles croches {steps}', { steps: fired });
}

function strip(card: WeaponCard): HTMLElement {
  const { steps } = card;
  const row = el('span', 'ui-card__steps');
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', stripLabel(card));
  row.dataset.mode = steps === 'continuous' ? 'continuous' : 'steps';
  const cells = steps === 'continuous' ? Array<boolean>(SIXTEENTHS_PER_BAR).fill(true) : steps;
  row.append(
    ...cells.map((on, step) => {
      const cell = el('span', 'ui-card__step');
      cell.dataset.on = String(on);
      cell.dataset.beat = String(step % 4 === 0);
      return cell;
    }),
  );
  return row;
}

function pearlRow(pearls: Pearls): HTMLElement {
  const row = el('span', 'ui-card__pearls');
  for (let rank = 1; rank <= pearls.max; rank += 1) {
    const pearl = el('span', 'ui-pearl');
    setFlag(pearl, 'on', rank < pearls.rank);
    setFlag(pearl, 'gain', rank === pearls.rank);
    row.append(pearl);
  }
  return row;
}

function card(model: Card): HTMLButtonElement {
  const button = el('button', 'ui-card');
  button.type = 'button';
  button.dataset.id = model.id;
  button.dataset.kind = model.kind;
  button.dataset.tint = model.tint;
  if (model.kind === 'upgrade') {
    button.dataset.family = model.family;
  }
  const glyph =
    model.kind === 'upgrade' ? familyIcon(model.family) : weaponIcon(model.weapon.effect);
  const familyRow = el('span', 'ui-card__family');
  familyRow.append(el('span', 'ui-card__label', model.label));
  if (model.rarityLabel !== null) {
    familyRow.append(el('span', 'ui-card__rarity', model.rarityLabel));
  }
  const rank = el('span', 'ui-card__rank');
  if (model.kind !== 'fusion' && model.pearls !== null) {
    rank.setAttribute('role', 'img');
    rank.setAttribute('aria-label', model.pearls.label);
    rank.append(pearlRow(model.pearls));
  }
  rank.append(
    el(
      'span',
      'ui-card__rank-text',
      model.kind === 'fusion' ? t('Remplace {weapon}', { weapon: model.replaces }) : model.rank,
    ),
  );
  const foot = el('span', 'ui-card__foot');
  foot.append(rank, el('span', 'ui-card__cta', t('Choisir')));
  button.append(
    icon('ui-card__medal', medallion(glyph), '0 0 84 84'),
    familyRow,
    el('span', 'ui-card__name', model.name),
  );
  if (model.kind === 'fusion') {
    button.append(el('span', 'ui-card__recipe', t('B2B : {recipe}', { recipe: model.recipe })));
  }
  button.append(el('span', 'ui-card__desc', model.description));
  if (model.kind === 'weapon') {
    button.append(strip(model));
  }
  button.append(foot);
  return button;
}

function centerOf(node: Element): { x: number; y: number } {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

// Where a card sits once nothing moves it.
function restOf(button: HTMLElement): { x: number; y: number } {
  const at = centerOf(button);
  const shift = new DOMMatrix(getComputedStyle(button).transform);
  return { x: at.x - shift.e, y: at.y - shift.f };
}

function between(low: number, high: number): number {
  return low + Math.random() * (high - low);
}

// A handful of sparks around a point: each leaves when its animation ends, the group with the last.
function sparksAt(layer: HTMLElement, at: { x: number; y: number }): HTMLElement {
  const group = el('span', 'ui-sparks__group');
  group.style.left = `${at.x.toFixed(1)}px`;
  group.style.top = `${at.y.toFixed(1)}px`;
  group.addEventListener('animationend', (event) => {
    if (event.target instanceof Element && event.target !== group) {
      event.target.remove();
    }
    if (group.childElementCount === 0) {
      group.remove();
    }
  });
  layer.append(group);
  return group;
}

// The chosen card throws a ring and shards of its colour.
function burst(layer: HTMLElement, button: HTMLElement): void {
  const group = sparksAt(layer, centerOf(button));
  const style = getComputedStyle(button);
  setVar(
    group,
    '--spark',
    style.getPropertyValue(button.dataset.tint === 'legendary' ? '--tint' : '--family'),
  );
  group.append(el('span', 'ui-spark ui-spark--ring'));
  for (let index = 0; index < SHARDS; index += 1) {
    const shard = el('span', 'ui-spark ui-spark--shard');
    const angle = between(0, 2 * Math.PI);
    const reach = between(60, 210);
    shard.dataset.shape = String(index % 3);
    setFlag(shard, 'core', index % 4 === 0);
    setVar(shard, '--dx', `${(Math.cos(angle) * reach).toFixed(0)}px`);
    setVar(shard, '--dy', `${(Math.sin(angle) * reach + 40).toFixed(0)}px`);
    setVar(shard, '--turn', `${between(-2, 2).toFixed(2)}turn`);
    setVar(shard, '--size', `${between(8, 18).toFixed(0)}px`);
    setVar(shard, '--life', between(1, 1.9).toFixed(2));
    group.append(shard);
  }
}

// A legendary card lets stars go as it lands.
function stars(layer: HTMLElement, button: HTMLElement): void {
  const box = button.getBoundingClientRect();
  const group = sparksAt(layer, centerOf(button));
  for (let index = 0; index < STARS; index += 1) {
    const star = el('span', 'ui-spark ui-spark--star');
    setFlag(star, 'core', index % 2 === 0);
    setVar(star, '--x', `${between(-box.width / 2, box.width / 2).toFixed(0)}px`);
    setVar(star, '--y', `${between(-box.height / 2, box.height / 2).toFixed(0)}px`);
    setVar(star, '--dy', `${between(-70, -25).toFixed(0)}px`);
    setVar(star, '--size', `${between(8, 16).toFixed(0)}px`);
    setVar(star, '--life', between(1.5, 3.2).toFixed(2));
    setVar(star, '--wait', (index * 0.07).toFixed(2));
    group.append(star);
  }
}

// The card a player took, until the menu closes on it.
interface Taken {
  button: HTMLButtonElement;
  // Set when the card is a circus weapon, which has its slot in the HUD.
  weaponId: string | null;
}

// The offer of one player of this screen. It keeps its place once the choice is made, until the
// others have chosen too.
interface Panel {
  readonly element: HTMLElement;
  readonly input: MenuInput;
  readonly visible: boolean;
  readonly done: boolean;
  readonly settled: boolean;
  readonly taken: Taken | null;
  update(
    offer: UpgradeOffer | undefined,
    player: PlayerState | undefined,
    content: GameContent,
    snapshot: InputSnapshot,
    team: boolean,
    now: number,
    beatMs: number,
  ): void;
  reset(): void;
}

function createPanel(playerId: PlayerId, host: UpgradeHost, effects: HTMLElement): Panel {
  const element = el('div', 'ui-upgrade__body ui-offer');
  element.hidden = true;
  const who = createWho();
  const kicker = el('p', 'ui-kicker');
  const heading = el('h2', 'ui-heading', t('Choisis ton amélioration'));
  const cards = el('div', 'ui-cards');
  const hint = el('p', 'ui-hint');
  element.append(who, kicker, heading, cards, hint);

  const input = createMenuInput();
  let current: UpgradeOffer | null = null;
  let models: readonly Card[] = [];
  let chosen: string | null = null;
  let opensAt = 0;
  let device: InputDevice | null = null;
  let buttons: readonly HTMLButtonElement[] = [];
  let later: Later[] = [];
  let beatMs = 0;
  let team = false;
  let clock = 0;

  const menu: Menu = createMenu((index) => {
    const upgradeId = current?.options[index];
    if (current !== null && upgradeId !== undefined && chosen === null) {
      choose(upgradeId);
    }
  });

  function chosenButton(): HTMLButtonElement | undefined {
    return buttons.find((button) => button.dataset.id === chosen);
  }

  function choose(upgradeId: string): void {
    chosen = upgradeId;
    mark();
    host.cue('upgradeChosen', 0);
    const picked = chosenButton();
    if (host.calm() || picked === undefined) {
      host.choose(playerId, upgradeId);
      return;
    }
    const at = buttons.indexOf(picked);
    buttons.forEach((button, index) => {
      if (button !== picked) {
        button.dataset.dropped = index < at ? 'left' : 'right';
      }
    });
    picked.dataset.slammed = '';
    later.push(
      {
        at: clock + BURST_BEATS * beatMs,
        run() {
          burst(effects, picked);
        },
      },
      {
        at: clock + SLAM_BEATS * beatMs,
        run() {
          host.choose(playerId, upgradeId);
          if (team) {
            wait(picked);
          }
        },
      },
    );
  }

  // While the others choose, the chosen card waits alone in the middle of its panel.
  function wait(picked: HTMLElement): void {
    const from = restOf(picked);
    const to = centerOf(cards);
    setVar(picked, '--wait-x', `${(to.x - from.x).toFixed(1)}px`);
    setVar(picked, '--wait-y', `${(to.y - from.y).toFixed(1)}px`);
  }

  function mark(): void {
    element.dataset.state = chosen !== null ? 'chosen' : clock < opensAt ? 'dealing' : 'choosing';
    for (const button of buttons) {
      const picked = button.dataset.id === chosen;
      setFlag(button, 'chosen', picked);
      const cta = button.querySelector('.ui-card__cta');
      if (cta instanceof HTMLElement) {
        setText(cta, picked ? t('Choisi') : t('Choisir'));
      }
    }
  }

  function fillHints(next: InputDevice): void {
    if (next === device) {
      return;
    }
    device = next;
    const prompts = promptsFor(next);
    fillHint(
      hint,
      [
        { keys: prompts.navigateRow, label: t('choisir'), screen: 'wide' },
        { keys: prompts.navigate, label: t('choisir'), screen: 'narrow' },
        { keys: [prompts.confirm], label: t('valider') },
      ],
      prompts.style,
    );
  }

  function celebrate(button: HTMLElement, rarity: Celebrated): void {
    host.cue(rarity === 'legendary' ? 'cardLegendary' : 'cardRare', 0);
    if (host.calm()) {
      return;
    }
    button.dataset.shine = '';
    if (rarity === 'legendary') {
      stars(effects, button);
    }
  }

  function deal(): void {
    opensAt = clock + MENU_GRACE_MS;
    later = dealOf(models.map((model) => model.tint)).map((dealt, turn) => {
      const button = buttons[dealt.index];
      if (button !== undefined) {
        button.dataset.dealt = '';
        setVar(button, '--deal', `${String(dealt.delayMs)}ms`);
        setVar(button, '--tilt', `${String((dealt.index - (buttons.length - 1) / 2) * 5)}deg`);
      }
      return {
        at: clock + dealt.delayMs + DEAL_NOTE_MS,
        run() {
          host.cue('cardDealt', turn);
          if (button !== undefined && dealt.celebrated !== null) {
            celebrate(button, dealt.celebrated);
          }
        },
      };
    });
    later.push({
      at: opensAt,
      run() {
        menu.setItems(buttons);
        mark();
        host.cue('cardsReady', 0);
      },
    });
  }

  function reset(): void {
    current = null;
    chosen = null;
    later = [];
    element.hidden = true;
  }

  return {
    element,
    input,
    get visible() {
      return current !== null;
    },
    get done() {
      return chosen !== null;
    },
    get settled() {
      return current === null || element.dataset.state === 'choosing';
    },
    get taken() {
      const button = chosenButton();
      const model = models.find((entry) => entry.id === chosen);
      return button === undefined || model === undefined
        ? null
        : { button, weaponId: model.kind === 'upgrade' ? null : model.id };
    },
    update(offer, player, content, snapshot, inTeam, now, beat) {
      clock = now;
      beatMs = beat;
      team = inTeam;
      const edges = input.edges(snapshot.menu, snapshot.gameplay.move);
      later = runDue(later, now);
      if (offer === undefined) {
        if (chosen === null) {
          reset();
        }
        return;
      }
      fillHints(snapshot.device);
      if (offer !== current) {
        current = offer;
        chosen = null;
        input.open();
        setText(kicker, offerKicker(offer, player));
        models = offer.options.map((id) => cardFor(id, offer, player, content));
        buttons = models.map(card);
        cards.dataset.count = String(buttons.length);
        cards.dataset.offer = offer.kind ?? 'levelUp';
        setText(heading, offerHeading(offer));
        cards.replaceChildren(...buttons);
        deal();
        mark();
      }
      element.hidden = false;
      who.hidden = !team;
      if (team && player !== undefined) {
        fillWho(who, player);
        element.style.setProperty('--who', whoColor(player.classId));
      }
      if (chosen === null && now >= opensAt) {
        menu.handle(edges);
      }
    },
    reset,
  };
}

function chip(model: WaitChip): HTMLElement {
  const node = el('span', 'ui-offers__chip');
  if (model.classId !== null) {
    node.dataset.done = '';
    node.style.setProperty('--who', whoColor(model.classId));
    node.append(icon('ui-offers__mark', classMark(model.classId)));
  }
  node.append(model.text);
  return node;
}

export function createUpgradeOverlay(host: UpgradeHost): UpgradeOverlay {
  const element = el('section', 'ui-screen ui-overlay ui-upgrade');
  element.setAttribute('aria-label', t('Choix d’amélioration'));
  element.hidden = true;
  const effects = el('div', 'ui-screen ui-sparks');
  effects.setAttribute('aria-hidden', 'true');
  const body = el('div', 'ui-offers');
  const panelsRow = el('div', 'ui-offers__panels');
  const remoteRow = el('div', 'ui-offers__remote');
  const wait = el('p', 'ui-offers__wait');
  wait.setAttribute('role', 'status');
  body.append(panelsRow, remoteRow, wait);
  element.append(body);

  const panels = new Map<PlayerId, Panel>();
  // Every panel is dealt on the same notes: a cue asked twice in a frame sounds once.
  const sounded = new Set<string>();
  const heard: UpgradeHost = {
    ...host,
    cue(cue, variant) {
      const key = `${cue}:${String(variant)}`;
      if (!sounded.has(key)) {
        sounded.add(key);
        host.cue(cue, variant);
      }
    },
  };
  // The card each player of another screen took since the menu opened.
  const picked = new Map<PlayerId, string>();
  let later: Later[] = [];
  let lit: HTMLElement[] = [];
  let closesAt: number | null = null;

  function panelOf(playerId: PlayerId): Panel {
    let panel = panels.get(playerId);
    if (panel === undefined) {
      panel = createPanel(playerId, heard, effects);
      panels.set(playerId, panel);
      panelsRow.append(panel.element);
    }
    return panel;
  }

  function shut(): void {
    element.hidden = true;
    element.inert = false;
    delete element.dataset.leaving;
    closesAt = null;
    picked.clear();
    for (const panel of panels.values()) {
      panel.reset();
    }
  }

  function hide(): void {
    shut();
    later = [];
    for (const spot of lit) {
      delete spot.dataset.landed;
    }
    lit = [];
    effects.replaceChildren();
  }

  function land(spot: HTMLElement, now: number, beatMs: number): void {
    heard.cue('cardLanded', 0);
    spot.dataset.landed = '';
    lit.push(spot);
    later.push({
      at: now + LIT_BEATS * beatMs,
      run() {
        delete spot.dataset.landed;
        lit = lit.filter((other) => other !== spot);
      },
    });
  }

  // The menu closes over the game that resumes: every chosen card flies to its place in the HUD.
  function close(now: number, beatMs: number): void {
    const flights = [...panels].flatMap(([playerId, panel]) => {
      const { taken } = panel;
      const spot = taken === null ? null : host.landing(playerId, taken.weaponId);
      return taken === null || spot === null || spot.getBoundingClientRect().width === 0
        ? []
        : [{ button: taken.button, spot }];
    });
    if (flights.length === 0) {
      shut();
      return;
    }
    heard.cue('cardFlight', 0);
    if (host.calm()) {
      for (const flight of flights) {
        land(flight.spot, now, beatMs);
      }
      shut();
      return;
    }
    element.dataset.leaving = '';
    element.inert = true;
    flights.forEach(({ button, spot }, turn) => {
      const from = restOf(button);
      const to = centerOf(spot);
      const delay = turn * FLIGHT_STAGGER_BEATS * beatMs;
      setVar(button, '--fly-x', `${(to.x - from.x).toFixed(1)}px`);
      setVar(button, '--fly-y', `${(to.y - from.y).toFixed(1)}px`);
      setVar(button, '--fly-wait', `${delay.toFixed(0)}ms`);
      button.dataset.flying = '';
      later.push({
        at: now + delay + FLIGHT_BEATS * beatMs,
        run() {
          land(spot, now + delay + FLIGHT_BEATS * beatMs, beatMs);
        },
      });
    });
    closesAt = now + ((flights.length - 1) * FLIGHT_STAGGER_BEATS + FLIGHT_BEATS) * beatMs;
  }

  // A chip that has not changed keeps its node: replacing it would replay its entrance.
  function updateChips(chips: readonly WaitChip[]): void {
    chips.forEach((model, index) => {
      const key = `${model.classId ?? ''}|${model.text}`;
      const old = remoteRow.children[index];
      if (!(old instanceof HTMLElement) || old.dataset.key !== key) {
        const node = chip(model);
        node.dataset.key = key;
        if (old === undefined) {
          remoteRow.append(node);
        } else {
          old.replaceWith(node);
        }
      }
    });
    while (remoteRow.children.length > chips.length) {
      remoteRow.lastElementChild?.remove();
    }
    remoteRow.hidden = chips.length === 0;
  }

  return {
    element,
    effects,
    update(state, frame, content, now) {
      sounded.clear();
      const beatMs = beatPeriodMs(setTempo(setOf(content, state.setId)).bpm);
      const beat = `${beatMs.toFixed(1)}ms`;
      setVar(element, '--beat', beat);
      setVar(effects, '--beat', beat);
      later = runDue(later, now);

      const offers = state.status === 'choosingUpgrade' ? state.pendingUpgrades : [];
      if (closesAt !== null && (offers.length > 0 || now >= closesAt)) {
        shut();
      }
      // A frame without players of its own still drives the one offer there is.
      const locals =
        frame.players.length > 0
          ? frame.players
          : offers.slice(0, 1).map((offer) => ({
              playerId: offer.playerId,
              snapshot: frame.snapshot,
            }));
      const team = state.players.length > 1;
      const isLocal = (playerId: PlayerId) => locals.some((local) => local.playerId === playerId);

      if (closesAt === null) {
        for (const local of locals) {
          panelOf(local.playerId).update(
            offers.find((offer) => offer.playerId === local.playerId),
            state.players.find((player) => player.id === local.playerId),
            content,
            local.snapshot,
            team,
            now,
            beatMs,
          );
        }
      }
      if (offers.length === 0) {
        if (closesAt === null && !element.hidden) {
          close(now, beatMs);
        }
        return;
      }

      for (const event of state.events) {
        const pick = pickOf(event);
        if (pick !== null && !isLocal(pick.playerId)) {
          picked.set(pick.playerId, cardName(pick.cardId, content));
          heard.cue('mateChose', 0);
        }
      }
      const shown = locals.map((local) => panelOf(local.playerId)).filter((panel) => panel.visible);
      panelsRow.dataset.count = String(shown.length);
      setFlag(panelsRow, 'multi', shown.length > 1);
      setFlag(
        element,
        'moving',
        shown.some((panel) => !panel.settled),
      );
      const choosing = (playerId: PlayerId) => offers.some((offer) => offer.playerId === playerId);
      const waiting = waitingFor(
        state.players
          .filter((player) => !isLocal(player.id) && (choosing(player.id) || picked.has(player.id)))
          .map((player) => ({
            name: playerLabel(player),
            classId: player.classId,
            picked: choosing(player.id) ? null : (picked.get(player.id) ?? null),
          })),
        shown.every((panel) => panel.done),
      );
      updateChips(waiting.chips);
      setText(wait, waiting.waiting ?? '');
      wait.hidden = waiting.waiting === null;
      element.hidden = false;
    },
    hide,
  };
}
