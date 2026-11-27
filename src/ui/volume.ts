import { t } from '../shared/i18n';
import { clamp } from '../shared/scalar';
import { stepperArrow } from './class-picker';
import { el, setText } from './dom';

export const VOLUME_STEPS = 10;

export interface SoundLevel {
  // From 1 to `VOLUME_STEPS`, kept while the sound is cut.
  readonly volume: number;
  readonly muted: boolean;
}

export type SoundBus = 'music' | 'effects';
export const SOUND_BUSES: readonly SoundBus[] = ['music', 'effects'];
export type SoundMix = Readonly<Record<SoundBus, SoundLevel>>;
export const FULL_MIX: SoundMix = {
  music: { volume: VOLUME_STEPS, muted: false },
  effects: { volume: VOLUME_STEPS, muted: false },
};

export function toggleMuted({ volume, muted }: SoundLevel): SoundLevel {
  return { volume, muted: !muted };
}

// Below the quietest step the sound cuts, and the first step up brings it back where it was.
export function stepSound({ volume, muted }: SoundLevel, side: -1 | 1): SoundLevel {
  if (muted) {
    return { volume, muted: side < 0 };
  }
  if (side < 0 && volume <= 1) {
    return { volume, muted: true };
  }
  return { volume: clamp(volume + side, 1, VOLUME_STEPS), muted: false };
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

interface SoundTexts {
  readonly label: string;
  readonly hint: string;
  readonly down: string;
  readonly up: string;
}

const soundTexts = (): SoundTexts => ({
  label: t('Sound'),
  hint: t('Music and effects'),
  down: t('Turn the sound down'),
  up: t('Turn the sound up'),
});

export const busLabel = (bus: SoundBus): string => (bus === 'music' ? t('Music') : t('Effects'));

const busTexts = (bus: SoundBus): SoundTexts =>
  bus === 'music'
    ? {
        label: busLabel(bus),
        hint: t('Tracks and the title'),
        down: t('Turn the music down'),
        up: t('Turn the music up'),
      }
    : {
        label: busLabel(bus),
        hint: t('Shots, hits and menus'),
        down: t('Turn the effects down'),
        up: t('Turn the effects up'),
      };

export function createBusControls(
  onStep: (bus: SoundBus, side: -1 | 1) => void,
): Record<SoundBus, SoundControl> {
  const control = (bus: SoundBus) =>
    createSoundControl((side) => {
      onStep(bus, side);
    }, busTexts(bus));
  return { music: control('music'), effects: control('effects') };
}

export function createSoundControl(
  onStep: (side: -1 | 1) => void,
  texts: SoundTexts = soundTexts(),
): SoundControl {
  const element = el('div', 'ui-button ui-toggle ui-volume');
  element.setAttribute('role', 'slider');
  element.setAttribute('aria-label', texts.label);
  element.setAttribute('aria-valuemin', '0');
  element.setAttribute('aria-valuemax', String(VOLUME_STEPS));
  const text = el('span', 'ui-toggle__text');
  text.append(
    el('span', 'ui-toggle__label', texts.label),
    el('span', 'ui-toggle__hint', texts.hint),
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
    arrow(texts.down, false, () => {
      onStep(-1);
    }),
    meter,
    arrow(texts.up, true, () => {
      onStep(1);
    }),
    state,
  );
  element.append(text, control);
  return {
    element,
    set({ volume, muted }) {
      const level = muted ? 0 : volume;
      const label = muted ? t('Muted') : t('{percent}%', { percent: volume * 10 });
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
