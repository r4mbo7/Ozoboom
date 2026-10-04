import { describe, expect, it } from 'vitest';
import type { MenuIntents } from '../input/intents';
import { NO_MENU_INTENTS, menuEdges, navigateMenu, selectTrap } from './navigation';

function menu(overrides: Partial<MenuIntents>): MenuIntents {
  return { ...NO_MENU_INTENTS, ...overrides };
}

const noTrapIntent = { nextTrap: false, previousTrap: false, selectTrap: null };

describe('menuEdges', () => {
  it('keeps an intent on the update where it starts', () => {
    const edges = menuEdges(menu({ down: true, confirm: true }), menu({}));

    expect(edges).toEqual(menu({ down: true, confirm: true }));
  });

  it('drops an intent that was already active on the previous update', () => {
    const edges = menuEdges(menu({ down: true }), menu({ down: true }));

    expect(edges.down).toBe(false);
  });

  it('treats a missing previous update as idle', () => {
    expect(menuEdges(menu({ back: true }), null).back).toBe(true);
  });
});

describe('navigateMenu', () => {
  it('moves forward with down or right', () => {
    expect(navigateMenu(0, 3, menu({ down: true })).index).toBe(1);
    expect(navigateMenu(1, 3, menu({ right: true })).index).toBe(2);
  });

  it('moves backward with up or left', () => {
    expect(navigateMenu(2, 3, menu({ up: true })).index).toBe(1);
    expect(navigateMenu(1, 3, menu({ left: true })).index).toBe(0);
  });

  it('wraps around both ends', () => {
    expect(navigateMenu(2, 3, menu({ down: true })).index).toBe(0);
    expect(navigateMenu(0, 3, menu({ up: true })).index).toBe(2);
  });

  it('stays in place when opposite directions cancel out', () => {
    expect(navigateMenu(1, 3, menu({ up: true, down: true })).index).toBe(1);
  });

  it('reports confirm and back', () => {
    const step = navigateMenu(1, 3, menu({ confirm: true, back: true }));

    expect(step).toEqual({ index: 1, confirmed: true, back: true });
  });

  it('never selects anything in an empty menu', () => {
    expect(navigateMenu(4, 0, menu({ down: true, confirm: true })).index).toBe(0);
  });
});

describe('selectTrap', () => {
  it('jumps to a trap picked by number', () => {
    expect(selectTrap(0, 2, { ...noTrapIntent, selectTrap: 1 }, noTrapIntent)).toBe(1);
  });

  it('ignores a number with no trap behind it', () => {
    expect(selectTrap(1, 2, { ...noTrapIntent, selectTrap: 4 }, noTrapIntent)).toBe(1);
  });

  it('cycles with next and previous, wrapping around', () => {
    expect(selectTrap(1, 2, { ...noTrapIntent, nextTrap: true }, noTrapIntent)).toBe(0);
    expect(selectTrap(0, 2, { ...noTrapIntent, previousTrap: true }, null)).toBe(1);
  });

  it('moves once per press when the same intent is seen twice', () => {
    const next = { ...noTrapIntent, nextTrap: true };

    expect(selectTrap(0, 3, next, next)).toBe(0);
  });

  it('stays on the first slot when there is no trap', () => {
    expect(selectTrap(3, 0, { ...noTrapIntent, nextTrap: true }, null)).toBe(0);
  });
});
