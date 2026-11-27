import {
  SOUND_BUSES,
  type SoundBus,
  type SoundLevel,
  createAutoAimToggle,
  createAutoFireToggle,
  createBusControls,
  createHitSoundToggle,
  createSoundControl,
  stepSound,
} from '../ui';
import type { Toggle } from '../ui/toggle';
import type { SoundControl } from '../ui/volume';
import { type Prefs, type StoredPref, saveLevel, savePref } from './prefs';

export interface Settings {
  readonly prefs: Prefs;
  readonly soundControl: SoundControl;
  readonly busControls: Readonly<Record<SoundBus, SoundControl>>;
  readonly hitSoundToggle: Toggle;
  readonly autoFireToggle: Toggle;
  readonly autoAimToggle: Toggle;
  remember<K extends StoredPref>(key: K, value: Prefs[K]): void;
  readonly setSound: (level: SoundLevel) => void;
  readonly stepVolume: (side: -1 | 1) => void;
  readonly setMix: (bus: SoundBus, level: SoundLevel) => void;
  readonly stepMix: (bus: SoundBus, side: -1 | 1) => void;
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
  const busControls = createBusControls(stepMix);
  for (const bus of SOUND_BUSES) {
    busControls[bus].set(prefs.mix[bus]);
  }
  const hitSoundToggle = createHitSoundToggle();
  hitSoundToggle.set(prefs.hitSound);
  const autoFireToggle = createAutoFireToggle();
  autoFireToggle.set(prefs.autoFire);
  const autoAimToggle = createAutoAimToggle();
  autoAimToggle.set(prefs.autoAim);

  function remember<K extends StoredPref>(key: K, value: Prefs[K]): void {
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

  function setMix(bus: SoundBus, level: SoundLevel): void {
    prefs.mix = { ...prefs.mix, [bus]: level };
    applySound();
    saveLevel(storage, bus, level);
    busControls[bus].set(level);
  }

  function stepMix(bus: SoundBus, side: -1 | 1): void {
    setMix(bus, stepSound(prefs.mix[bus], side));
  }

  return {
    prefs,
    soundControl,
    busControls,
    hitSoundToggle,
    autoFireToggle,
    autoAimToggle,
    remember,
    setSound,
    stepVolume,
    setMix,
    stepMix,
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
