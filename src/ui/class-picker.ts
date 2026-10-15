import type { ClassDefinition } from '../data/types';
import { el, icon, setText } from './dom';
import { PHONE } from './icons';
import type { ClassPortrait } from './types';

export type ClassInfo = Pick<
  ClassDefinition,
  'id' | 'name' | 'role' | 'color' | 'maxHp' | 'speed' | 'attack' | 'skill'
>;

const THEMED = new Set(['mage', 'tank', 'healer']);

// The three classes follow the palette of the hour: their data colour only stands in for the others.
export function classColor(info: ClassInfo): string {
  return THEMED.has(info.id) ? `var(--${info.id})` : info.color;
}

// Without the game to draw it, a class shows as a lit disc of its colour.
export function swatchPortrait(classes: readonly ClassInfo[]): ClassPortrait {
  const element = el('span', 'ui-portrait-swatch');
  element.setAttribute('aria-hidden', 'true');
  return {
    element,
    setClass(classId) {
      const info = classes.find((entry) => entry.id === classId);
      if (info !== undefined) {
        element.style.setProperty('--class-color', classColor(info));
      }
    },
    destroy() {
      element.remove();
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

// The style sheet shows it only on a touch screen held upright: the set is drawn for landscape.
export function landscapeNotice(): HTMLElement {
  const notice = el('p', 'ui-landscape');
  const text = el('span', 'ui-landscape__text');
  text.append(
    el('strong', 'ui-landscape__title', 'Tourne ton téléphone'),
    el('span', 'ui-landscape__detail', 'Le set se joue en paysage.'),
  );
  notice.append(icon('ui-landscape__icon', PHONE), text);
  return notice;
}
