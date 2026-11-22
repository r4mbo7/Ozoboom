import type { GameContent, WeaponEffect } from '../data/types';
import { weaponGlyph } from '../data/weapon-glyphs';
import { t, tn } from '../shared/i18n';
import { setOf, setTempo } from '../sim/lineup';
import type { PlayerState } from '../sim/state';
import { el, icon } from './dom';
import { titlesOf } from './end-titles';
import { formatNumber } from './format';
import { gearSlots, playerLabel } from './hud-model';
import { CARDS, TURN, classMark, familyIcon } from './icons';
import { statsSheetOf } from './stats-model';
import type { StatsSheet } from './stats-model';
import { createStatsSheet } from './stats-sheet';
import { whoColor } from './who';

export interface PlayerCard {
  readonly seat: HTMLLIElement;
  readonly card: HTMLButtonElement;
}

interface Build {
  weapons: { name: string; effect: WeaponEffect; level: number }[];
  cards: number;
  relics: string[];
}

// One card per player: who they are and the title they earned; turned over, what they did and
// built; turned again, what their stats came to on the stage played. With no content to read
// them, two faces only.
export function playerCards(
  players: readonly PlayerState[],
  content: GameContent | null,
  setId: string,
): PlayerCard[] {
  const titles = titlesOf(players);
  return players.map((player, index) => {
    const seat = el('li', 'ui-end__seat');
    seat.style.setProperty('--deal', String(index));
    const card = el('button', 'ui-end-card');
    card.type = 'button';
    card.dataset.downed = String(player.downed);
    card.style.setProperty('--who', whoColor(player.classId));
    const build = content === null ? null : buildOf(player, content);
    const sheet =
      content === null
        ? null
        : statsSheetOf(player, content, setTempo(setOf(content, setId)).ticksPerBeat);
    const count = sheet === null ? 2 : 3;
    card.append(
      frontOf(player, content, titles[index] ?? null, build, dotsOf(0, count)),
      backOf(player, build, players.length > 1, dotsOf(1, count)),
      ...(sheet === null ? [] : [statsOf(sheet, dotsOf(2, count))]),
    );
    seat.append(card);
    showFace(card, 0, 0);
    return { seat, card };
  });
}

// Each turn is half a turn more, the same way: the face it shows takes the side that comes to
// the viewer, so none ever reads mirrored.
export function turnCard(card: HTMLButtonElement): void {
  const shown = [...card.children].findIndex(
    (face) => face.getAttribute('data-face') === card.dataset.face,
  );
  showFace(card, shown + 1, Number(card.style.getPropertyValue('--turns')) + 1);
}

function showFace(card: HTMLButtonElement, index: number, turns: number): void {
  const faces = [...card.children];
  const shown = faces[index % faces.length];
  card.dataset.face = shown?.getAttribute('data-face') ?? '';
  card.style.setProperty('--turns', String(turns));
  shown?.setAttribute('data-side', String(turns % 2));
  for (const face of faces) {
    face.setAttribute('aria-hidden', String(face !== shown));
  }
  // The shown face stays the card's name: the turn it offers comes as a description.
  card.setAttribute('aria-description', seeing(faces[(index + 1) % faces.length]));
}

function seeing(face: Element | undefined): string {
  switch (face?.getAttribute('data-face')) {
    case 'feats':
      return t('See the feats');
    case 'stats':
      return t('See the stats');
    default:
      return t('See the card');
  }
}

function faceOf(name: string, className: string, dots: HTMLElement): HTMLElement {
  const face = el('span', className);
  face.setAttribute('data-face', name);
  face.append(dots);
  return face;
}

function dotsOf(shown: number, count: number): HTMLElement {
  const dots = el('span', 'ui-end-card__dots');
  dots.setAttribute('aria-hidden', 'true');
  dots.append(
    ...Array.from({ length: count }, (_, index) => {
      const dot = el('span', 'ui-end-card__dot');
      dot.toggleAttribute('data-on', index === shown);
      return dot;
    }),
  );
  return dots;
}

function statsOf(sheet: StatsSheet, dots: HTMLElement): HTMLElement {
  const face = faceOf('stats', 'ui-end-card__face ui-end-card__face--back', dots);
  const view = createStatsSheet('card');
  view.update(sheet);
  face.append(view.element);
  return face;
}

function frontOf(
  player: PlayerState,
  content: GameContent | null,
  title: ReturnType<typeof titlesOf>[number],
  build: Build | null,
  dots: HTMLElement,
): HTMLElement {
  const face = faceOf('front', 'ui-end-card__face', dots);
  const head = el('span', 'ui-end-card__head');
  head.append(
    icon('ui-end-card__mark', classMark(player.classId)),
    el('span', 'ui-end-card__state', player.downed ? t('Downed') : t('Standing')),
  );
  face.append(
    icon('ui-end-card__turn', TURN),
    head,
    el('span', 'ui-end-card__name', playerLabel(player)),
  );
  const className = content?.classes.find((entry) => entry.id === player.classId)?.name;
  if (className !== undefined) {
    face.append(el('span', 'ui-end-card__class', t(className)));
  }
  if (title !== null) {
    face.append(
      el('span', 'ui-end-card__title', title.title),
      el('span', 'ui-end-card__proof', title.proof),
    );
  }
  if (build !== null) {
    const icons = iconsOf(build);
    if (icons.childElementCount > 0) {
      face.append(icons);
    }
  }
  return face;
}

// Alone, nobody stands an ally up: the count is for a team only.
function backOf(
  player: PlayerState,
  build: Build | null,
  team: boolean,
  dots: HTMLElement,
): HTMLElement {
  const face = faceOf('feats', 'ui-end-card__face ui-end-card__face--back', dots);
  const tally = player.tally ?? { badVibes: 0, bosses: 0, revives: 0, vibes: 0 };
  const feats = el('span', 'ui-end-card__feats');
  feats.append(
    feat(t('Bad vibes'), tally.badVibes),
    feat(t('Bosses'), tally.bosses),
    ...(team ? [feat(t('Allies healed'), tally.revives)] : []),
    feat(t('Vibes'), Math.round(tally.vibes)),
  );
  face.append(el('span', 'ui-end-card__name', playerLabel(player)), feats);
  if (build === null) {
    return face;
  }
  const kit = el('span', 'ui-end-card__kit');
  kit.append(
    ...build.weapons.map((weapon) =>
      line(
        weaponGlyph(weapon.effect),
        weapon.name,
        t('lv. {level}', { level: formatNumber(weapon.level) }),
      ),
    ),
  );
  if (build.cards > 0) {
    kit.append(
      line(
        CARDS,
        tn(build.cards, '{count} card', '{count} cards', { count: formatNumber(build.cards) }),
      ),
    );
  }
  if (build.relics.length > 0) {
    kit.append(line(familyIcon('relic'), build.relics.join(', ')));
  }
  if (kit.childElementCount > 0) {
    face.append(kit);
  }
  return face;
}

function feat(label: string, count: number): HTMLElement {
  const item = el('span', 'ui-end-card__feat');
  item.append(el('span', '', label), el('strong', '', formatNumber(count)));
  return item;
}

function line(glyph: string, text: string, level?: string): HTMLElement {
  const item = el('span', 'ui-end-card__line');
  item.append(icon('ui-end-card__icon', glyph), el('span', 'ui-end-card__text', text));
  if (level !== undefined) {
    item.append(el('span', 'ui-end-card__level', level));
  }
  return item;
}

function buildOf(player: PlayerState, content: GameContent): Build {
  const weapons = gearSlots(player, content).flatMap((slot) =>
    slot.weapon === null
      ? []
      : [{ name: t(slot.weapon.name), effect: slot.weapon.effect, level: slot.level }],
  );
  const upgrades = player.upgrades.map(
    (id) => content.upgrades.find((upgrade) => upgrade.id === id) ?? null,
  );
  const relics = upgrades.flatMap((upgrade) =>
    upgrade?.family === 'relic' ? [t(upgrade.name)] : [],
  );
  return { weapons, cards: upgrades.length - relics.length, relics };
}

// The back of the card says it in words.
function iconsOf(build: Build): HTMLElement {
  const row = el('span', 'ui-end-card__build');
  row.setAttribute('aria-hidden', 'true');
  if (build.weapons.length > 0) {
    const group = el('span', 'ui-end-card__gear');
    group.append(
      ...build.weapons.map((weapon) => icon('ui-end-card__icon', weaponGlyph(weapon.effect))),
    );
    row.append(group);
  }
  if (build.cards > 0) {
    row.append(counted(CARDS, build.cards));
  }
  if (build.relics.length > 0) {
    row.append(counted(familyIcon('relic'), build.relics.length));
  }
  return row;
}

function counted(glyph: string, count: number): HTMLElement {
  const group = el('span', 'ui-end-card__count');
  group.append(icon('ui-end-card__icon', glyph), el('span', '', formatNumber(count)));
  return group;
}
