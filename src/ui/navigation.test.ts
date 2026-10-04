import { describe, expect, it } from 'vitest';
import type { MenuIntents } from '../input/intents';
import {
  HELD_MENU_INTENTS,
  NO_MENU_INTENTS,
  createMenuInput,
  menuEdges,
  navigateMenu,
  selectTrap,
} from './navigation';

function menu(overrides: Partial<MenuIntents>): MenuIntents {
  return { ...NO_MENU_INTENTS, ...overrides };
}

const noTrapIntent = { nextTrap: false, previousTrap: false, selectTrap: null };

const still = { x: 0, y: 0 };
const pushingRight = { x: 1, y: 0 };

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

  it('waits for a release after held intents, so the press that opened a form does not act in it', () => {
    const held = menuEdges(menu({ confirm: true }), HELD_MENU_INTENTS);
    const released = menuEdges(menu({}), menu({ confirm: true }));
    const pressedAgain = menuEdges(menu({ confirm: true }), menu({}));

    expect(held).toEqual(NO_MENU_INTENTS);
    expect(released).toEqual(NO_MENU_INTENTS);
    expect(pressedAgain.confirm).toBe(true);
  });
});

describe('createMenuInput', () => {
  it('ignores the presses on the frame the menu opens', () => {
    const input = createMenuInput();
    input.open();

    const edges = input.edges(menu({ down: true, confirm: true }), { x: 0, y: 1 });

    expect(edges).toEqual(NO_MENU_INTENTS);
  });

  it('reads a press made after the menu opened', () => {
    const input = createMenuInput();
    input.open();
    input.edges(menu({}), still);

    const edges = input.edges(menu({ down: true }), { x: 0, y: 1 });

    expect(edges.down).toBe(true);
  });

  it('ignores a direction held as the menu opened, its repeats included, until it is released', () => {
    const input = createMenuInput();
    input.edges(menu({ right: true }), pushingRight);
    input.open();

    const whileHeld = [
      input.edges(menu({}), pushingRight),
      input.edges(menu({ right: true }), pushingRight),
      input.edges(menu({}), pushingRight),
      input.edges(menu({ right: true }), pushingRight),
    ];
    const released = input.edges(menu({}), still);
    const pushedAgain = input.edges(menu({ right: true }), pushingRight);

    expect(whileHeld).toEqual([NO_MENU_INTENTS, NO_MENU_INTENTS, NO_MENU_INTENTS, NO_MENU_INTENTS]);
    expect(released).toEqual(NO_MENU_INTENTS);
    expect(pushedAgain).toEqual(menu({ right: true }));
  });

  it('only holds back the directions still pushed', () => {
    const input = createMenuInput();
    input.open();
    input.edges(menu({}), pushingRight);

    const edges = input.edges(menu({ down: true, right: true }), { x: 1, y: 1 });

    expect(edges).toEqual(menu({ down: true }));
  });

  it('ignores the validation that opened the menu, and reads the next one', () => {
    const input = createMenuInput();
    input.open();

    const opening = input.edges(menu({ confirm: true }), still);
    const between = input.edges(menu({}), still);
    const next = input.edges(menu({ confirm: true }), still);

    expect(opening).toEqual(NO_MENU_INTENTS);
    expect(between).toEqual(NO_MENU_INTENTS);
    expect(next).toEqual(menu({ confirm: true }));
  });

  it('holds back again on every opening', () => {
    const input = createMenuInput();
    input.open();
    input.edges(menu({}), still);
    input.edges(menu({ left: true }), { x: -1, y: 0 });

    input.open();
    const edges = input.edges(menu({ left: true }), { x: -1, y: 0 });

    expect(edges).toEqual(NO_MENU_INTENTS);
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
