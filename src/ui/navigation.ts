import type { GameplayIntents, MenuIntents } from '../input/intents';

export const NO_MENU_INTENTS: Readonly<MenuIntents> = {
  up: false,
  down: false,
  left: false,
  right: false,
  confirm: false,
  back: false,
};

export function menuEdges(current: MenuIntents, previous: MenuIntents | null): MenuIntents {
  const before = previous ?? NO_MENU_INTENTS;
  return {
    up: current.up && !before.up,
    down: current.down && !before.down,
    left: current.left && !before.left,
    right: current.right && !before.right,
    confirm: current.confirm && !before.confirm,
    back: current.back && !before.back,
  };
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

function wrap(index: number, count: number): number {
  return ((index % count) + count) % count;
}
