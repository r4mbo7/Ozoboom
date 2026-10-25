import type { GameplayIntents, MenuIntents } from '../input/intents';
import { wrap } from '../shared/scalar';
import type { Vec2 } from '../sim/state';
import { type Direction, direction } from '../shared/i18n';

export const NO_MENU_INTENTS: Readonly<MenuIntents> = {
  up: false,
  down: false,
  left: false,
  right: false,
  previous: false,
  next: false,
  confirm: false,
  back: false,
};

// Previous intents that make every intent wait for its release before it counts again.
export const HELD_MENU_INTENTS: Readonly<MenuIntents> = {
  up: true,
  down: true,
  left: true,
  right: true,
  previous: true,
  next: true,
  confirm: true,
  back: true,
};

export function menuEdges(current: MenuIntents, previous: MenuIntents | null): MenuIntents {
  const before = previous ?? NO_MENU_INTENTS;
  return eachIntent((intent) => current[intent] && !before[intent]);
}

function eachIntent(value: (intent: keyof MenuIntents) => boolean): MenuIntents {
  return {
    up: value('up'),
    down: value('down'),
    left: value('left'),
    right: value('right'),
    previous: value('previous'),
    next: value('next'),
    confirm: value('confirm'),
    back: value('back'),
  };
}

export interface MenuInput {
  // What is held when a menu opens waits for its release.
  open(): void;
  edges(menu: MenuIntents, move: Vec2): MenuIntents;
}

// A direction held in combat stays ignored after an opening, repeats included, until the move lets go of it; a validation is ignored on the opening update.
export function createMenuInput(): MenuInput {
  let previous: MenuIntents | null = null;
  let waiting: MenuIntents = NO_MENU_INTENTS;
  return {
    open() {
      waiting = HELD_MENU_INTENTS;
    },
    edges(menu, move) {
      const pushed: Readonly<Record<keyof MenuIntents, boolean>> = {
        up: move.y < 0,
        down: move.y > 0,
        left: move.x < 0,
        right: move.x > 0,
        previous: false,
        next: false,
        confirm: false,
        back: false,
      };
      const held = waiting;
      waiting = eachIntent((intent) => held[intent] && (menu[intent] || pushed[intent]));
      const started = menuEdges(menu, previous);
      previous = menu;
      return readingEdges(
        eachIntent((intent) => started[intent] && !waiting[intent]),
        direction(),
      );
    },
  };
}

// A right-to-left language lays the rows out from the right, so a push to the right steps back.
export function readingEdges(edges: MenuIntents, reading: Direction): MenuIntents {
  return reading === 'rtl'
    ? { ...edges, left: edges.right, right: edges.left, previous: edges.next, next: edges.previous }
    : edges;
}

export interface MenuStep {
  index: number;
  confirmed: boolean;
  back: boolean;
}

export function navigateMenu(index: number, count: number, edges: MenuIntents): MenuStep {
  if (count <= 0) {
    return { index: 0, confirmed: false, back: edges.back };
  }
  const delta = (edges.down || edges.right ? 1 : 0) - (edges.up || edges.left ? 1 : 0);
  return {
    index: wrap(index + delta, count),
    confirmed: edges.confirm,
    back: edges.back,
  };
}

type TrapIntents = Pick<GameplayIntents, 'nextTrap' | 'previousTrap' | 'selectTrap'>;

export function selectTrap(
  index: number,
  count: number,
  current: TrapIntents,
  previous: TrapIntents | null,
): number {
  if (count <= 0) {
    return 0;
  }
  const chosen = current.selectTrap;
  if (chosen !== null && chosen !== previous?.selectTrap && chosen >= 0 && chosen < count) {
    return chosen;
  }
  const delta =
    (current.nextTrap && previous?.nextTrap !== true ? 1 : 0) -
    (current.previousTrap && previous?.previousTrap !== true ? 1 : 0);
  return wrap(index + delta, count);
}

export function heldSlot(selected: number, held: number): number {
  return Math.min(selected, held - 1);
}
