import {
  type SoundLevel,
  createAutoAimToggle,
  createAutoFireToggle,
  createHitSoundToggle,
  createSoundControl,
  stepSound,
} from '../ui';
import type { Toggle } from '../ui/toggle';
import type { SoundControl } from '../ui/volume';
import { type Prefs, savePref } from './prefs';

export interface Settings {
  readonly prefs: Prefs;
  readonly soundControl: SoundControl;
  readonly hitSoundToggle: Toggle;
  readonly autoFireToggle: Toggle;
  readonly autoAimToggle: Toggle;
  remember<K extends keyof Prefs>(key: K, value: Prefs[K]): void;
  readonly setSound: (level: SoundLevel) => void;
  readonly stepVolume: (side: -1 | 1) => void;
  readonly setHitSound: (enabled: boolean) => void;
  readonly setAutoFire: (enabled: boolean) => void;
  readonly setAutoAim: (enabled: boolean) => void;
}

export function createSettings(
  storage: () => Storage | null,
  prefs: Prefs,
  applySound: () => void,
): Settings {
  const soundControl = createSoundControl(stepVolume);
  soundControl.set(prefs);
  const hitSoundToggle = createHitSoundToggle();
  hitSoundToggle.set(prefs.hitSound);
  const autoFireToggle = createAutoFireToggle();
  autoFireToggle.set(prefs.autoFire);
  const autoAimToggle = createAutoAimToggle();
  autoAimToggle.set(prefs.autoAim);

  function remember<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
    prefs[key] = value;
    savePref(storage, key, value);
  }

  function setSound({ volume, muted }: SoundLevel): void {
    prefs.volume = volume;
    prefs.muted = muted;
    applySound();
    savePref(storage, 'volume', volume);
    savePref(storage, 'muted', muted);
    soundControl.set(prefs);
  }

  function stepVolume(side: -1 | 1): void {
    setSound(stepSound(prefs, side));
  }

  return {
    prefs,
    soundControl,
    hitSoundToggle,
    autoFireToggle,
    autoAimToggle,
    remember,
    setSound,
    stepVolume,
    setHitSound(enabled) {
      prefs.hitSound = enabled;
      applySound();
      savePref(storage, 'hitSound', enabled);
      hitSoundToggle.set(enabled);
    },
    setAutoFire(enabled) {
      remember('autoFire', enabled);
      autoFireToggle.set(enabled);
    },
    setAutoAim(enabled) {
      remember('autoAim', enabled);
      autoAimToggle.set(enabled);
    },
  };
}
