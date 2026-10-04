import { describe, expect, it } from 'vitest';
import type { MenuIntents } from '../input/intents';
import { NO_MENU_INTENTS } from '../ui/navigation';
import { type FormItem, navigateForm, shiftType } from './navigation';

function menu(overrides: Partial<MenuIntents>): MenuIntents {
  return { ...NO_MENU_INTENTS, ...overrides };
}

const FORM: readonly FormItem[] = ['type', 'message', 'context', 'send', 'copy', 'close'];

describe('navigateForm', () => {
  it('walks every item of the form with up and down', () => {
    let index = 0;

    const visited = FORM.map(() => {
      const item = FORM[index];
      index = navigateForm(FORM, index, menu({ down: true })).index;
      return item;
    });

    expect(visited).toEqual(FORM);
    expect(index).toBe(0);
    expect(navigateForm(FORM, 0, menu({ up: true })).index).toBe(FORM.length - 1);
  });

  it('changes the type with left and right on the type row', () => {
    expect(navigateForm(FORM, 0, menu({ right: true }))).toEqual({
      index: 0,
      typeShift: 1,
      confirmed: false,
      back: false,
    });
    expect(navigateForm(FORM, 0, menu({ left: true })).typeShift).toBe(-1);
  });

  it('moves between the buttons with left and right elsewhere', () => {
    const step = navigateForm(FORM, 3, menu({ right: true }));

    expect(step.index).toBe(4);
    expect(step.typeShift).toBe(0);
  });

  it('reports confirm and back on any row', () => {
    const step = navigateForm(FORM, 2, menu({ confirm: true, back: true }));

    expect(step).toEqual({ index: 2, typeShift: 0, confirmed: true, back: true });
  });
});

describe('shiftType', () => {
  it('starts from the first or the last type when none is chosen', () => {
    expect(shiftType(null, 1)).toBe('idea');
    expect(shiftType(null, -1)).toBe('other');
  });

  it('cycles through the types in both directions', () => {
    expect(shiftType('idea', 1)).toBe('bug');
    expect(shiftType('other', 1)).toBe('idea');
    expect(shiftType('idea', -1)).toBe('other');
  });

  it('keeps the type when nothing moves', () => {
    expect(shiftType('balance', 0)).toBe('balance');
    expect(shiftType(null, 0)).toBeNull();
  });
});
