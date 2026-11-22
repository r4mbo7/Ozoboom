import { el, icon } from '../dom';
import type { ProgrammeEntry } from './types';

export interface PortraitView {
  readonly element: HTMLElement;
  // Paints it again at the size its frame now has.
  paint(): void;
}

// The entry's still portrait in a square frame; a locked one is its glyph in shadow.
export function createPortrait(entry: ProgrammeEntry, className: string): PortraitView {
  const element = el('span', `${className} ui-programme__portrait`);
  if (entry.color !== undefined) {
    element.style.setProperty('--entry-color', entry.color);
  }
  const { portrait } = entry;
  if ('glyph' in portrait) {
    element.append(icon('ui-programme__glyph', portrait.glyph));
    return { element, paint: () => undefined };
  }
  if ('picture' in portrait) {
    element.append(icon('ui-programme__picture', portrait.picture, portrait.viewBox));
    return { element, paint: () => undefined };
  }
  const canvas = el('canvas', 'ui-programme__canvas');
  canvas.setAttribute('aria-hidden', 'true');
  element.append(canvas);
  return {
    element,
    paint() {
      portrait.paint(canvas);
    },
  };
}
