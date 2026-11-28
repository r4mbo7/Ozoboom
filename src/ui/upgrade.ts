import type { GameContent } from '../data/types';
import { weaponGlyph } from '../data/weapon-glyphs';
import type { InputDevice, InputSnapshot } from '../input/intents';
import { direction, t, tn } from '../shared/i18n';
import { beatPeriodMs, type Tempo } from '../shared/tempo';
import { weaponSlotCount } from '../sim/draw';
import { setOf, setTempo } from '../sim/lineup';
import type { PlayerId, PlayerState, SimState, UpgradeOffer } from '../sim/state';
import { el, fillHint, findAll, icon, onPointerClick, setFlag, setText, setVar } from './dom';
import { MENU_GRACE_MS } from './menu-grace';
import {
  SIXTEENTHS_PER_BAR,
  type Card,
  type Celebrated,
  type FusionCard,
  type Pearls,
  type UpgradeCard,
  type WaitChip,
  type WeaponCard,
  type WeaponPlace,
  cardFor,
  cardName,
  dealOf,
  offerHeading,
  offerKicker,
  pickOf,
  slideToMiddle,
  waitingFor,
  weaponPlaces,
} from './cards';
import { formatNumber } from './format';
import { playerLabel } from './hud-model';
import {
  DIE,
  STAR,
  classMark,
  medallion,
  roleIcon,
  FAN_SPAN,
  trapFanIcon,
  trapIcon,
  upgradeIcon,
} from './icons';
import { type Menu, createMenu } from './menu';
import { MARKS, namesIn } from './names-in';
import { type MenuInput, createMenuInput } from './navigation';
import { type OfferView, createOfferStats } from './offer-stats';
import type { Prompts } from './prompts';
import type { UiFrame, UpgradeCue } from './types';
import { placesKey, createPlaceRow } from './weapon-place';
import { createWho, fillWho, whoColor } from './who';

export interface UpgradeOverlay {
  readonly element: HTMLElement;
  // The sparks outlive the menu that throws them.
  readonly effects: HTMLElement;
  update(state: SimState, frame: UiFrame, content: GameContent, now: number): void;
  hide(): void;
}

export interface UpgradeHost {
  // Calm mode: no choice is held for a motion nobody sees.
  calm(): boolean;
  choose(playerId: PlayerId, upgradeId: string): void;
  // Spends one of the player's rerolls on other cards for the offer shown.
  reroll(playerId: PlayerId): void;
  cue(cue: UpgradeCue, variant: number): void;
  // null when the HUD does not show that player.
  landing(playerId: PlayerId, weaponId: string | null): HTMLElement | null;
  // The HUD's own places, showing these; null when the HUD does not show that player.
  offerPlaces(playerId: PlayerId, places: readonly WeaponPlace[] | null): HTMLElement | null;
  // null when nothing can draw the weapon: the card keeps its medallion.
  showWeapon(canvas: HTMLCanvasElement, weaponId: string, playerId: PlayerId): (() => void) | null;
  showTrap(
    canvas: HTMLCanvasElement,
    trapIds: readonly string[],
    playerId: PlayerId,
  ): (() => void) | null;
  readonly prompts: Prompts;
}

// Mirrors where ui.css lays a card's head as a tile, too small to play a weapon.
const TILE_HEADS = '(max-width: 720px) and (min-height: 521px)';
// A dealt card sounds when it touches down, not when it leaves.
const DEAL_NOTE_MS = 70;
const SLAM_BEATS = 1;
const BURST_BEATS = 0.2;
const FLIGHT_BEATS = 0.8;
const FLIGHT_STAGGER_BEATS = 0.2;
const LIT_BEATS = 1;
const SHARDS = 24;
const STARS = 14;

// The wait between the flights of several cards and how long each flies, so that the last lands at
// the end of `span`; with no span, their own beat.
function flightTimes(
  count: number,
  span: number,
  beatMs: number,
): { readonly stagger: number; readonly flight: number } {
  if (span <= 0 || count === 0) {
    return { stagger: FLIGHT_STAGGER_BEATS * beatMs, flight: FLIGHT_BEATS * beatMs };
  }
  const stagger = Math.min(FLIGHT_STAGGER_BEATS * beatMs, span / (2 * count));
  return { stagger, flight: span - (count - 1) * stagger };
}

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

function rhythmLabel({ steps, everyBars }: WeaponCard): string {
  if (steps === 'continuous') {
    return t('Plays non-stop');
  }
  const fired = steps.flatMap((on, step) => (on ? [formatNumber(step + 1)] : [])).join(', ');
  return everyBars > 1
    ? tn(
        everyBars,
        'Fires on sixteenths {steps}, one bar in {bars}',
        'Fires on sixteenths {steps}, one bar in {bars}',
        { steps: fired, bars: formatNumber(everyBars) },
      )
    : t('Fires on sixteenths {steps}', { steps: fired });
}

// The damage of one hit above each step that fires it; once over a strip that never stops.
function hitsOf(steps: WeaponCard['steps'], amount: string): HTMLElement[] {
  const columns =
    steps === 'continuous'
      ? ['1 / -1']
      : steps.flatMap((on, step) => (on ? [String(step + 1)] : []));
  return columns.map((column) => {
    const node = el('span', 'ui-card__hit', amount);
    node.style.gridColumn = column;
    return node;
  });
}

function strip(card: WeaponCard): HTMLElement {
  const { steps } = card;
  const amount = card.hit === null ? null : formatNumber(card.hit);
  const row = el('span', 'ui-card__steps');
  row.setAttribute('role', 'img');
  row.setAttribute(
    'aria-label',
    amount === null
      ? rhythmLabel(card)
      : t('{rhythm}, {damage} damage per hit', { rhythm: rhythmLabel(card), damage: amount }),
  );
  row.dataset.mode = steps === 'continuous' ? 'continuous' : 'steps';
  const cells = steps === 'continuous' ? Array<boolean>(SIXTEENTHS_PER_BAR).fill(true) : steps;
  row.append(
    ...cells.map((on, step) => {
      const cell = el('span', 'ui-card__step');
      cell.dataset.on = String(on);
      cell.dataset.beat = String(step % 4 === 0);
      return cell;
    }),
    ...(amount === null ? [] : hitsOf(steps, amount)),
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

function fusionLine(fusions: WeaponCard['fusions']): HTMLElement | null {
  const [first, second] = fusions;
  if (first === undefined) {
    return null;
  }
  return second === undefined
    ? namesIn(
        'ui-card__fuse',
        t('with {upgrade}, becomes {fusion}', { upgrade: MARKS[0], fusion: MARKS[1] }),
        [first.upgrade, first.name],
      )
    : namesIn(
        'ui-card__fuse',
        t('with {first} or {second}, it fuses', { first: MARKS[0], second: MARKS[1] }),
        [first.upgrade, second.upgrade],
      );
}

function roles(model: WeaponCard): HTMLElement {
  const row = el('span', 'ui-card__roles');
  for (const view of model.roles) {
    const chip = el('span', 'ui-role');
    chip.setAttribute('role', 'img');
    chip.setAttribute(
      'aria-label',
      view.fresh ? t('{role}, which your props don’t do yet', { role: view.label }) : view.label,
    );
    setFlag(chip, 'fresh', view.fresh);
    chip.append(
      icon('ui-role__icon', roleIcon(view.role)),
      el('span', 'ui-role__label', view.label),
    );
    if (view.fresh) {
      chip.append(icon('ui-role__star', STAR));
    }
    row.append(chip);
  }
  return row;
}

function levelsAndFusions(model: WeaponCard): HTMLElement {
  const row = el('span', 'ui-card__path');
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', model.pearls.label);
  row.dataset.fusions = String(model.fusions.length);
  for (let level = 1; level <= model.pearls.max; level += 1) {
    if (level > 1) {
      row.append(el('span', 'ui-path__bar'));
    }
    const node = el('span', 'ui-path__level', formatNumber(level));
    setFlag(node, 'held', level < model.pearls.rank);
    setFlag(node, 'gain', level === model.pearls.rank);
    row.append(node);
  }
  if (model.fusions.length > 0) {
    row.append(el('span', 'ui-path__plus', '+'));
  }
  for (const fusion of model.fusions) {
    row.append(icon('ui-path__fusion', medallion(weaponGlyph(fusion.weapon.effect)), '0 0 84 84'));
  }
  return row;
}

function rankOf(model: UpgradeCard | FusionCard): HTMLElement {
  const rank = el('span', 'ui-card__rank');
  if (model.kind === 'upgrade' && model.pearls !== null) {
    rank.setAttribute('role', 'img');
    rank.setAttribute('aria-label', model.pearls.label);
    rank.append(pearlRow(model.pearls));
  }
  rank.append(
    el(
      'span',
      'ui-card__rank-text',
      model.kind === 'fusion' ? t('Replaces {weapon}', { weapon: model.replaces }) : model.rank,
    ),
  );
  return rank;
}

// A new weapon is kept the whole run, as a festival bracelet: its card wears one, the name on its tag.
function band(name: HTMLElement): HTMLElement {
  const node = el('span', 'ui-card__band');
  const tag = el('span', 'ui-card__tag');
  // The tag sizes the name to its length, so that a long one stays on one line.
  setVar(tag, '--name-length', String(name.textContent.length));
  tag.append(name);
  node.append(tag, el('span', 'ui-card__knot'));
  return node;
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
  const glyph = model.kind === 'upgrade' ? upgradeGlyph(model) : weaponGlyph(model.weapon.effect);
  const familyRow = el('span', 'ui-card__family');
  familyRow.append(el('span', 'ui-card__label', model.label));
  if (model.rarityLabel !== null) {
    familyRow.append(el('span', 'ui-card__rarity', model.rarityLabel));
  }
  const foot = el('span', 'ui-card__foot');
  foot.append(
    model.kind === 'weapon' ? levelsAndFusions(model) : rankOf(model),
    el('span', 'ui-card__cta', t('Choose')),
  );
  const head = el('span', 'ui-card__head');
  if (model.kind !== 'upgrade' || model.gift !== undefined) {
    head.append(el('canvas', 'ui-card__scene'));
  }
  const span = isSurprise(model) ? FAN_SPAN : undefined;
  head.append(icon('ui-card__medal', medallion(glyph, span), '0 0 84 84'));
  const body = el('span', 'ui-card__body');
  const name = el('span', 'ui-card__name', model.name);
  if (model.kind === 'weapon' && model.adds) {
    button.dataset.adds = '';
    body.append(band(name));
  } else {
    body.append(familyRow, name);
  }
  if (model.kind === 'weapon' && model.roles.length > 0) {
    body.append(roles(model));
  }
  if (model.kind === 'fusion') {
    body.append(el('span', 'ui-card__recipe', t('B2B: {recipe}', { recipe: model.recipe })));
  }
  body.append(el('span', 'ui-card__desc', model.description));
  if (model.kind === 'weapon') {
    const line = fusionLine(model.fusions);
    if (line !== null) {
      body.append(line);
    }
  }
  body.append(foot);
  button.append(head, body);
  // Last, so that a layout with the head beside the title can set it back above the foot.
  if (model.kind === 'weapon') {
    button.append(strip(model));
  }
  return button;
}

// The card gives one of several traps, found when taken.
function isSurprise(model: Card): boolean {
  return model.kind === 'upgrade' && model.gift?.form === 'surprise';
}

// A card that gives a trap draws it, or every one it may give, fanned out.
function upgradeGlyph(model: UpgradeCard): string {
  const traps = model.gift?.traps ?? [];
  const [first] = traps;
  if (first === undefined) {
    return upgradeIcon(model.id, model.family, model.stat);
  }
  return isSurprise(model) ? trapFanIcon(traps.map((trap) => trap.effect)) : trapIcon(first.effect);
}

function centerOf(node: Element): { x: number; y: number } {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function restingCenterOf(button: HTMLElement): { x: number; y: number } {
  const at = centerOf(button);
  const shift = new DOMMatrix(getComputedStyle(button).transform);
  return { x: at.x - shift.e, y: at.y - shift.f };
}

function between(low: number, high: number): number {
  return low + Math.random() * (high - low);
}

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

interface Taken {
  button: HTMLButtonElement;
  // null unless a circus weapon, which has its slot in the HUD.
  weaponId: string | null;
}

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
    slots: number,
    snapshot: InputSnapshot,
    team: boolean,
    // The only offer of this screen: its cards are large enough to play their weapons.
    alone: boolean,
    now: number,
    // The stage's, which the panel's moves and the stats' rate count their beats in.
    tempo: Tempo,
  ): void;
  reset(): void;
}

function createPanel(playerId: PlayerId, host: UpgradeHost, effects: HTMLElement): Panel {
  const element = el('div', 'ui-upgrade__body ui-offer');
  element.hidden = true;
  const who = createWho();
  const kicker = el('p', 'ui-kicker');
  const heading = el('h2', 'ui-heading', t('Pick your upgrade'));
  const places = createPlaceRow('ui-places');
  places.element.hidden = true;
  const cards = el('div', 'ui-cards');
  const hint = el('p', 'ui-hint');
  const reroll = el('button', 'ui-reroll');
  reroll.type = 'button';
  reroll.hidden = true;
  const rerollCount = el('span', 'ui-reroll__count');
  reroll.append(
    icon('ui-reroll__die', DIE),
    el('span', 'ui-reroll__label', t('Reroll')),
    rerollCount,
  );
  const stats = createOfferStats(element, cards);
  // The reroll and the pill share the row of the hints: a phone has no height to spare for them.
  const foot = el('div', 'ui-offer__foot');
  foot.append(hint, reroll, stats.toggle);
  // Both views share one box, as tall as the taller: the heading above stays put when the panel turns.
  const room = el('div', 'ui-offer__views');
  room.append(cards, stats.element);
  element.append(who, kicker, heading, places.element, room, foot);

  const input = createMenuInput();
  let current: UpgradeOffer | null = null;
  let models: readonly Card[] = [];
  let chosen: string | null = null;
  let opensAt = 0;
  // The item focused when the panel turned to the stats: they preview it, the cards get it back.
  let held = 0;
  let hinted = '';
  let buttons: readonly HTMLButtonElement[] = [];
  let later: Later[] = [];
  let beatMs = 0;
  let team = false;
  let clock = 0;
  // The places last shown, null once given back to the HUD.
  let shownPlaces: string | null = null;
  // The chosen card waiting in the middle of its panel while the others choose.
  let waiting: HTMLElement | null = null;
  let playing = -1;
  let stops: (() => void)[] = [];
  let rerolls = 0;
  // Asked, until the sim deals the new offer.
  let rerolling = false;
  // The offer plays its weapons wherever the screen leaves them room: a phone turned changes that.
  let scenes = false;
  const tiles = window.matchMedia(TILE_HEADS);
  tiles.addEventListener('change', () => {
    if (scenes) {
      startScenes();
    }
  });

  // On a phone the reroll and the pill share the top row with the HUD's score panel, at its end: they
  // stop short of it, whatever its score or the language makes its width.
  let barPanel: Element | null = null;
  const barWatch =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          clearBar();
        });

  function clearBar(): void {
    if (barPanel === null) {
      foot.style.removeProperty('--bar-clear');
      return;
    }
    const panel = barPanel.getBoundingClientRect();
    const row = foot.getBoundingClientRect();
    const clear = direction() === 'rtl' ? panel.right - row.left : row.right - panel.left;
    foot.style.setProperty('--bar-clear', `${String(Math.max(0, Math.ceil(clear)))}px`);
  }

  function watchBar(panel: Element | null): void {
    if (panel === barPanel) {
      return;
    }
    barWatch?.disconnect();
    barPanel = panel;
    if (panel !== null) {
      barWatch?.observe(panel);
      barWatch?.observe(foot);
    }
    clearBar();
  }

  const menu: Menu = createMenu((index) => {
    if (index === buttons.length) {
      askReroll();
      return;
    }
    const upgradeId = current?.options[index];
    if (current !== null && upgradeId !== undefined && chosen === null) {
      choose(upgradeId);
    }
  });

  function askReroll(): void {
    if (current === null || chosen !== null || rerolling || rerolls < 1 || clock < opensAt) {
      return;
    }
    rerolling = true;
    host.reroll(playerId);
    mark();
  }

  function showRerolls(): void {
    reroll.hidden = rerolls < 1;
    setText(rerollCount, formatNumber(rerolls));
    reroll.setAttribute(
      'aria-label',
      tn(
        rerolls,
        'Reroll the cards, {count} reroll left',
        'Reroll the cards, {count} rerolls left',
        {
          count: formatNumber(rerolls),
        },
      ),
    );
  }

  function menuItems(): readonly HTMLElement[] {
    return reroll.hidden ? buttons : [...buttons, reroll];
  }

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
    const rtl = direction() === 'rtl';
    buttons.forEach((button, index) => {
      if (button !== picked) {
        button.dataset.dropped = index < at !== rtl ? 'left' : 'right';
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
            waiting = picked;
            wait();
          }
        },
      },
    );
  }

  // Measured again at every frame: the waiting line, the places given back to the HUD or a turned
  // phone move the panel after the pick.
  function wait(): void {
    if (waiting === null) {
      return;
    }
    const moved = new DOMMatrix(getComputedStyle(waiting).transform);
    const slide = slideToMiddle(
      waiting.getBoundingClientRect(),
      { x: moved.e, y: moved.f },
      cards.getBoundingClientRect(),
    );
    setVar(waiting, '--wait-x', `${slide.x.toFixed(1)}px`);
    setVar(waiting, '--wait-y', `${slide.y.toFixed(1)}px`);
  }

  function mark(): void {
    element.dataset.state = chosen !== null ? 'chosen' : clock < opensAt ? 'dealing' : 'choosing';
    setFlag(reroll, 'asked', rerolling);
    for (const button of buttons) {
      const picked = button.dataset.id === chosen;
      setFlag(button, 'chosen', picked);
      const cta = button.querySelector('.ui-card__cta');
      if (cta instanceof HTMLElement) {
        setText(cta, picked ? t('Chosen') : t('Choose'));
      }
    }
  }

  function fillHints(device: InputDevice): void {
    const key = `${device}|${stats.view}`;
    if (key === hinted) {
      return;
    }
    hinted = key;
    const shown = host.prompts.for(device);
    fillHint(
      hint,
      [
        { keys: shown.navigateRow, label: t('choose'), screen: 'wide' },
        { keys: shown.navigate, label: t('choose'), screen: 'narrow' },
        { keys: [shown.confirm], label: t('confirm') },
      ],
      shown.style,
    );
    stats.label(shown);
  }

  function show(next: OfferView): void {
    stats.show(next);
    if (next === 'stats') {
      // Their entrance is over: shown again, the cards would be dealt again.
      for (const button of buttons) {
        delete button.dataset.dealt;
        delete button.dataset.shine;
      }
    }
  }

  // The stats walk no card: another card is chosen back on the cards.
  function turn(): void {
    if (current === null || chosen !== null || clock < opensAt) {
      return;
    }
    if (stats.view === 'cards') {
      held = menu.index;
      show('stats');
    } else {
      menu.select(held);
      show('cards');
    }
  }

  onPointerClick(stats.toggle, turn);

  function stopScenes(): void {
    for (const stop of stops) {
      stop();
    }
    stops = [];
    for (const button of buttons) {
      button.querySelector('.ui-card__head')?.removeAttribute('data-live');
    }
  }

  function startScenes(): void {
    stopScenes();
    if (tiles.matches) {
      return;
    }
    buttons.forEach((button, index) => {
      const canvas = button.querySelector('canvas');
      const model = models[index];
      const stop = canvas === null || model === undefined ? null : showScene(canvas, model);
      if (stop !== null) {
        stops.push(stop);
        button.querySelector('.ui-card__head')?.setAttribute('data-live', '');
      }
    });
  }

  // A still picture of the surprise would name one trap: in calm mode, its fan says them all.
  function showScene(canvas: HTMLCanvasElement, model: Card): (() => void) | null {
    if (model.kind !== 'upgrade') {
      return host.showWeapon(canvas, model.id, playerId);
    }
    const { gift } = model;
    return gift === undefined || (gift.form === 'surprise' && host.calm())
      ? null
      : host.showTrap(
          canvas,
          gift.traps.map((trap) => trap.id),
          playerId,
        );
  }

  function walkStrips(): void {
    const sixteenth = beatMs / 4;
    const at = host.calm() || sixteenth <= 0 ? -1 : Math.floor(clock / sixteenth);
    if (at === playing) {
      return;
    }
    playing = at;
    const step = at < 0 ? -1 : at % SIXTEENTHS_PER_BAR;
    const bar = Math.floor(at / SIXTEENTHS_PER_BAR);
    models.forEach((model, index) => {
      const card = buttons[index];
      if (model.kind !== 'weapon' || card === undefined) {
        return;
      }
      const fires = bar % model.everyBars === 0;
      findAll(card, '.ui-card__step', HTMLElement).forEach((cell, position) => {
        setFlag(cell, 'now', position === step);
        setFlag(cell, 'hit', position === step && fires && cell.dataset.on === 'true');
      });
    });
  }

  // A touch takes the card it touches: nothing is focused there, so no place waits for it.
  function fillPlaces(
    player: PlayerState | undefined,
    content: GameContent,
    slots: number,
    focused: Card | undefined,
  ): void {
    const views = models.some((model) => model.kind !== 'upgrade')
      ? weaponPlaces(player, content, slots, focused)
      : null;
    const key = views === null ? '' : placesKey(views);
    if (key === shownPlaces) {
      return;
    }
    shownPlaces = key;
    // The HUD's bar shows them over the veil, where the chosen card lands; else the offer's own row.
    const bar = host.offerPlaces(playerId, views);
    const own = views !== null && bar === null;
    setFlag(element, 'bar', bar !== null);
    watchBar(bar?.closest('.ui-hud__status') ?? null);
    setFlag(element, 'places', own);
    places.element.hidden = !own;
    if (own) {
      places.show(views);
    }
    aimFlight(bar ?? places.element, focused);
  }

  function givePlacesBack(): void {
    if (shownPlaces !== null) {
      shownPlaces = null;
      host.offerPlaces(playerId, null);
      delete element.dataset.bar;
      watchBar(null);
    }
  }

  // The new weapon of the focused card flies from its head to the place it would take.
  function aimFlight(row: HTMLElement, focused: Card | undefined): void {
    const ring = row.querySelector('[data-state="ghost"] .ui-place__ring');
    const head =
      focused === undefined
        ? null
        : buttons[models.indexOf(focused)]?.querySelector('.ui-card__head');
    if (!(ring instanceof HTMLElement) || !(head instanceof HTMLElement)) {
      return;
    }
    const from = centerOf(head);
    const to = centerOf(ring);
    const x = from.x - to.x;
    const y = from.y - to.y;
    // It comes down on its place from beside the row of places, never across their labels.
    const side = direction() === 'rtl' ? 1 : -1;
    const arcX = side * Math.max(side * x * 0.5, 0) + side * 80;
    setVar(ring, '--from-x', `${x.toFixed(1)}px`);
    setVar(ring, '--from-y', `${y.toFixed(1)}px`);
    setVar(ring, '--arc-x', `${arcX.toFixed(1)}px`);
    setVar(ring, '--arc-y', `${(y * 0.3).toFixed(1)}px`);
    setVar(ring, '--near-x', `${String(side * 36)}px`);
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
    const side = direction() === 'rtl' ? -1 : 1;
    later = dealOf(models.map((model) => model.tint)).map((dealt, turn) => {
      const button = buttons[dealt.index];
      if (button !== undefined) {
        button.dataset.dealt = '';
        setVar(button, '--deal', `${String(dealt.delayMs)}ms`);
        setVar(
          button,
          '--tilt',
          `${String(side * (dealt.index - (buttons.length - 1) / 2) * 5)}deg`,
        );
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
        menu.setItems(menuItems());
        mark();
        host.cue('cardsReady', 0);
      },
    });
  }

  function reset(): void {
    givePlacesBack();
    stopScenes();
    scenes = false;
    current = null;
    chosen = null;
    waiting = null;
    rerolling = false;
    later = [];
    show('cards');
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
    update(offer, player, content, slots, snapshot, inTeam, alone, now, tempo) {
      clock = now;
      beatMs = beatPeriodMs(tempo.bpm);
      team = inTeam;
      const edges = input.edges(snapshot.menu, snapshot.gameplay.move);
      later = runDue(later, now);
      wait();
      if (offer === undefined) {
        // Before the chosen card flies: it lands on the HUD's place of its weapon.
        givePlacesBack();
        if (chosen === null) {
          reset();
        }
        return;
      }
      if (offer !== current) {
        current = offer;
        chosen = null;
        waiting = null;
        rerolling = false;
        shownPlaces = null;
        playing = -1;
        input.open();
        setText(kicker, offerKicker(offer, player));
        models = offer.options.map((id) => cardFor(id, offer, player, content));
        buttons = models.map(card);
        cards.dataset.count = String(buttons.length);
        cards.dataset.offer = offer.kind ?? 'levelUp';
        setText(heading, offerHeading(offer));
        cards.replaceChildren(...buttons);
        stats.deal(models);
        scenes = alone;
        if (scenes) {
          startScenes();
        }
        show('cards');
        deal();
        mark();
      }
      // An offer with no other card to draw has no reroll left to offer.
      const usable = offer.drawnOut === true ? 0 : (player?.rerolls ?? 0);
      if (offer.drawnOut === true && rerolling) {
        rerolling = false;
        mark();
      }
      if (usable !== rerolls) {
        rerolls = usable;
        showRerolls();
        if (now >= opensAt) {
          menu.setItems(menuItems());
        }
      }
      element.hidden = false;
      who.hidden = !team;
      if (team && player !== undefined) {
        fillWho(who, player);
        element.style.setProperty('--who', whoColor(player.classId));
      }
      if (chosen === null && now >= opensAt) {
        if (edges.next || edges.previous) {
          turn();
        }
        if (stats.view === 'cards') {
          menu.handle(edges);
        }
      }
      fillHints(snapshot.device);
      walkStrips();
      const focusing = snapshot.device !== 'touch' && chosen === null && now >= opensAt;
      const focused = focusing ? menu.index : -1;
      fillPlaces(player, content, slots, models[focused]);
      // Filled behind the cards too, so that the box already has the stats' height.
      if (player !== undefined) {
        const previewed =
          snapshot.device === 'touch' ? -1 : stats.view === 'stats' ? held : menu.index;
        stats.fill(offer, player, content, tempo.ticksPerBeat, previewed);
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

// The boss's farewell, drawn by the renderer over the frozen game, plays before its relic cards come.
const RELIC_HOLD_BEATS = 5;

export function createUpgradeOverlay(host: UpgradeHost): UpgradeOverlay {
  const element = el('section', 'ui-screen ui-overlay ui-upgrade');
  element.setAttribute('aria-label', t('Upgrade choice'));
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
  const picked = new Map<PlayerId, string>();
  let later: Later[] = [];
  let lit: HTMLElement[] = [];
  let closesAt: number | null = null;
  let heldUntil = Number.NEGATIVE_INFINITY;

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
    heldUntil = Number.NEGATIVE_INFINITY;
    for (const spot of lit) {
      delete spot.dataset.landed;
    }
    lit = [];
    effects.replaceChildren();
  }

  // Each card lands with its own sound, even when a slow frame lands two at once.
  function land(spot: HTMLElement, now: number, beatMs: number): void {
    host.cue('cardLanded', 0);
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

  // When the game waits for the beat it resumes on, the veil lifts until then and the last card lands
  // on it; else the veil goes at once and the cards fly their own beat.
  function close(now: number, beatMs: number, resumesAt: number | null): void {
    const flights = [...panels].flatMap(([playerId, panel]) => {
      const { taken } = panel;
      const spot = taken === null ? null : host.landing(playerId, taken.weaponId);
      return taken === null || spot === null || spot.getBoundingClientRect().width === 0
        ? []
        : [{ button: taken.button, spot }];
    });
    const calm = host.calm();
    const span = resumesAt === null || calm ? 0 : Math.max(0, resumesAt - now);
    if (flights.length === 0 && span === 0) {
      shut();
      return;
    }
    if (flights.length > 0) {
      heard.cue('cardFlight', 0);
    }
    if (calm) {
      for (const flight of flights) {
        land(flight.spot, now, beatMs);
      }
      shut();
      return;
    }
    element.dataset.leaving = '';
    element.inert = true;
    setVar(element, '--lift', `${span.toFixed(0)}ms`);
    const { stagger, flight } = flightTimes(flights.length, span, beatMs);
    flights.forEach(({ button, spot }, turn) => {
      const from = restingCenterOf(button);
      const to = centerOf(spot);
      const delay = turn * stagger;
      setVar(button, '--fly-x', `${(to.x - from.x).toFixed(1)}px`);
      setVar(button, '--fly-y', `${(to.y - from.y).toFixed(1)}px`);
      setVar(button, '--fly-wait', `${delay.toFixed(0)}ms`);
      setVar(button, '--fly-time', `${flight.toFixed(0)}ms`);
      button.dataset.flying = '';
      later.push({
        at: now + delay + flight,
        run() {
          land(spot, now + delay + flight, beatMs);
        },
      });
    });
    // The last card lands on the beat when the game waits for one.
    closesAt = now + (span > 0 ? span : (flights.length - 1) * stagger + flight);
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
      const set = setOf(content, state.setId);
      const tempo = setTempo(set);
      const beatMs = beatPeriodMs(tempo.bpm);
      const slots = weaponSlotCount(set);
      const beat = `${beatMs.toFixed(1)}ms`;
      setVar(element, '--beat', beat);
      setVar(effects, '--beat', beat);
      later = runDue(later, now);

      if (state.events.some((event) => event.type === 'relicOffered')) {
        heldUntil = now + RELIC_HOLD_BEATS * beatMs;
      }
      const offers =
        state.status === 'choosingUpgrade' && now >= heldUntil ? state.pendingUpgrades : [];
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
            slots,
            local.snapshot,
            team,
            locals.length === 1,
            now,
            tempo,
          );
        }
      }
      if (offers.length === 0) {
        if (closesAt === null && !element.hidden) {
          close(now, beatMs, frame.resumesAt ?? null);
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
