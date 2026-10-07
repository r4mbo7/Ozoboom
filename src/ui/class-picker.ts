import type { ClassDefinition } from '../data/types';
import { el, icon, setText } from './dom';

export type ClassInfo = Pick<ClassDefinition, 'id' | 'name' | 'role' | 'color'>;

const THEMED = new Set(['mage', 'tank', 'healer']);

// The three classes follow the palette of the hour: their data colour only stands in for the others.
export function classColor(info: ClassInfo): string {
  return THEMED.has(info.id) ? `var(--${info.id})` : info.color;
}

function swatch(info: ClassInfo): HTMLSpanElement {
  const node = el('span', 'ui-swatch');
  node.style.setProperty('--class-color', classColor(info));
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export interface ClassCards {
  readonly element: HTMLElement;
  set(classId: string): void;
}

// Every class as a card, the chosen one lit, and its role underneath. The group is one item of the
// menu: left and right move the choice, a click on a card makes it.
export function createClassCards(
  classes: readonly ClassInfo[],
  onChoose: (classId: string) => void,
): ClassCards {
  const element = el('div', 'ui-classpick');
  element.setAttribute('role', 'radiogroup');
  const label = el('p', 'ui-panel__label', 'Ta classe');
  label.id = 'ui-classpick-label';
  element.setAttribute('aria-labelledby', label.id);
  const row = el('div', 'ui-classpick__cards');
  const role = el('p', 'ui-classpick__role');
  role.setAttribute('aria-live', 'polite');

  const cards = classes.map((info) => {
    const card = el('button', 'ui-class');
    card.type = 'button';
    card.tabIndex = -1;
    card.setAttribute('role', 'radio');
    card.append(swatch(info), el('span', 'ui-class__name', info.name));
    card.addEventListener('click', (event) => {
      event.stopPropagation();
      onChoose(info.id);
    });
    return card;
  });
  row.append(...cards);
  element.append(label, row, role);

  return {
    element,
    set(classId) {
      classes.forEach((info, index) => {
        cards[index]?.setAttribute('aria-checked', String(info.id === classId));
      });
      setText(role, classes.find((info) => info.id === classId)?.role ?? '');
    },
  };
}

export interface ClassStepper {
  readonly element: HTMLElement;
  readonly previous: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  set(classId: string): void;
}

const CHEVRON =
  '<path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';

export function stepperArrow(label: string, flipped: boolean): HTMLButtonElement {
  const button = el('button', 'ui-stepper__arrow');
  button.type = 'button';
  button.tabIndex = -1;
  button.setAttribute('aria-label', label);
  const glyph = icon('ui-stepper__glyph', CHEVRON);
  if (flipped) {
    glyph.classList.add('ui-stepper__glyph--flipped');
  }
  button.append(glyph);
  return button;
}

// One class at a time, with an arrow on each side, for a seat of the lobby.
export function createClassStepper(
  classes: readonly ClassInfo[],
  onStep: (side: -1 | 1) => void,
): ClassStepper {
  const element = el('div', 'ui-stepper');
  const previous = stepperArrow('Classe précédente', false);
  const next = stepperArrow('Classe suivante', true);
  const current = el('div', 'ui-stepper__current');
  const dot = el('span', 'ui-swatch');
  dot.setAttribute('aria-hidden', 'true');
  const name = el('span', 'ui-stepper__name');
  name.setAttribute('aria-live', 'polite');
  current.append(dot, name);
  element.append(previous, current, next);
  previous.addEventListener('click', () => {
    onStep(-1);
  });
  next.addEventListener('click', () => {
    onStep(1);
  });

  return {
    element,
    previous,
    next,
    set(classId) {
      const info = classes.find((entry) => entry.id === classId);
      if (info !== undefined) {
        dot.style.setProperty('--class-color', classColor(info));
        setText(name, info.name);
      }
    },
  };
}
