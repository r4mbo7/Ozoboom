import type { GameContent, WeaponEffect } from '../data/types';
import { weaponGlyph } from '../data/weapon-glyphs';
import { t, tn } from '../shared/i18n';
import type { PlayerState } from '../sim/state';
import { el, icon } from './dom';
import { titlesOf } from './end-titles';
import { formatNumber } from './format';
import { gearSlots, playerLabel } from './hud-model';
import { CARDS, TURN, classMark, familyIcon } from './icons';
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

// One card per player: who they are and the title they earned; turned over, what they did and built.
export function playerCards(
  players: readonly PlayerState[],
  content: GameContent | null,
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
    const front = frontOf(player, content, titles[index] ?? null, build);
    const back = backOf(player, build, players.length > 1);
    card.append(front, back);
    seat.append(card);
    showSide(card, false);
    return { seat, card };
  });
}

export function turnCard(card: HTMLButtonElement): void {
  showSide(card, card.getAttribute('aria-pressed') !== 'true');
}

function showSide(card: HTMLButtonElement, back: boolean): void {
  card.setAttribute('aria-pressed', String(back));
  const [front, behind] = card.children;
  front?.setAttribute('aria-hidden', String(back));
  behind?.setAttribute('aria-hidden', String(!back));
}

function frontOf(
  player: PlayerState,
  content: GameContent | null,
  title: ReturnType<typeof titlesOf>[number],
  build: Build | null,
): HTMLElement {
  const face = el('span', 'ui-end-card__face');
  const head = el('span', 'ui-end-card__head');
  head.append(
    icon('ui-end-card__mark', classMark(player.classId)),
    el('span', 'ui-end-card__state', player.downed ? t('À terre') : t('Debout')),
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
function backOf(player: PlayerState, build: Build | null, team: boolean): HTMLElement {
  const face = el('span', 'ui-end-card__face ui-end-card__face--back');
  const tally = player.tally ?? { badVibes: 0, bosses: 0, revives: 0, vibes: 0 };
  const feats = el('span', 'ui-end-card__feats');
  feats.append(
    feat(t('Bad vibes'), tally.badVibes),
    feat(t('Boss'), tally.bosses),
    ...(team ? [feat(t('Alliés soignés'), tally.revives)] : []),
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
        t('niv. {level}', { level: formatNumber(weapon.level) }),
      ),
    ),
  );
  if (build.cards > 0) {
    kit.append(
      line(
        CARDS,
        tn(build.cards, '{count} carte', '{count} cartes', { count: formatNumber(build.cards) }),
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
