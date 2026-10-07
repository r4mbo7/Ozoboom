import { stepperArrow } from './class-picker';
import { el, setText } from './dom';

export const VOLUME_STEPS = 10;

export interface SoundLevel {
  // From 1 to `VOLUME_STEPS`, kept while the sound is cut.
  readonly volume: number;
  readonly muted: boolean;
}

// Below the quietest step the sound cuts, and the first step up brings it back where it was.
export function stepSound({ volume, muted }: SoundLevel, side: -1 | 1): SoundLevel {
  if (muted) {
    return { volume, muted: side < 0 };
  }
  if (side < 0 && volume <= 1) {
    return { volume, muted: true };
  }
  return { volume: Math.min(Math.max(volume + side, 1), VOLUME_STEPS), muted: false };
}

export interface SoundControl {
  readonly element: HTMLElement;
  set(sound: SoundLevel): void;
}

function arrow(label: string, flipped: boolean, onClick: () => void): HTMLButtonElement {
  const button = stepperArrow(label, flipped);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

// The same setting on the title and in the pause: a click on it cuts or brings back the sound,
// left and right or its arrows move the level.
export function createSoundControl(onStep: (side: -1 | 1) => void): SoundControl {
  const element = el('div', 'ui-button ui-toggle ui-volume');
  element.setAttribute('role', 'slider');
  element.setAttribute('aria-label', 'Son');
  element.setAttribute('aria-valuemin', '0');
  element.setAttribute('aria-valuemax', String(VOLUME_STEPS));
  const text = el('span', 'ui-toggle__text');
  text.append(
    el('span', 'ui-toggle__label', 'Son'),
    el('span', 'ui-toggle__hint', 'Musique et effets'),
  );
  const meter = el('span', 'ui-volume__meter');
  meter.setAttribute('aria-hidden', 'true');
  const bars = Array.from({ length: VOLUME_STEPS }, (_, index) => {
    const bar = el('span', 'ui-volume__bar');
    bar.style.setProperty('--step', String(index));
    return bar;
  });
  meter.append(...bars);
  const state = el('span', 'ui-toggle__state');
  const control = el('span', 'ui-toggle__control ui-volume__control');
  control.append(
    arrow('Baisser le son', false, () => {
      onStep(-1);
    }),
    meter,
    arrow('Monter le son', true, () => {
      onStep(1);
    }),
    state,
  );
  element.append(text, control);
  return {
    element,
    set({ volume, muted }) {
      const level = muted ? 0 : volume;
      const label = muted ? 'Coupé' : `${String(volume * 10)} %`;
      element.setAttribute('aria-valuenow', String(level));
      element.setAttribute('aria-valuetext', label);
      element.toggleAttribute('data-on', !muted);
      bars.forEach((bar, index) => {
        bar.toggleAttribute('data-lit', index < level);
      });
      setText(state, label);
    },
  };
}
