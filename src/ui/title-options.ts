import type { TitleActions, TitleOptions } from './title';
import type { UiCallbacks } from './types';
import {
  FULL_MIX,
  type SoundBus,
  type SoundLevel,
  VOLUME_STEPS,
  stepSound,
  toggleMuted,
} from './volume';

export type TitleOptionActions = Pick<
  TitleActions,
  | 'toggleCalmMode'
  | 'toggleMute'
  | 'stepVolume'
  | 'toggleMix'
  | 'stepMix'
  | 'toggleHitSound'
  | 'toggleAutoFire'
  | 'toggleAutoAim'
  | 'setPseudo'
>;

type TitleOptionCallbacks = Pick<
  UiCallbacks,
  | 'onToggleCalmMode'
  | 'onToggleMute'
  | 'onSetVolume'
  | 'onSetMix'
  | 'onToggleHitSound'
  | 'onToggleAutoFire'
  | 'onToggleAutoAim'
  | 'onSetPseudo'
>;

export interface TitleSettings {
  readonly actions: TitleOptionActions;
  calmMode(): boolean;
  apply(next?: TitleOptions): void;
}

export function createTitleOptions(
  callbacks: TitleOptionCallbacks,
  show: (options: TitleOptions) => void,
): TitleSettings {
  let options: TitleOptions = {
    calmMode: false,
    muted: false,
    volume: VOLUME_STEPS,
    mix: FULL_MIX,
    hitSound: false,
    autoFire: false,
    autoAim: false,
    pseudo: '',
  };

  function change(patch: Partial<TitleOptions>): void {
    options = { ...options, ...patch };
    show(options);
  }

  function setSound(next: SoundLevel): void {
    const before = options;
    change({ volume: next.volume, muted: next.muted });
    if (next.muted !== before.muted) {
      callbacks.onToggleMute(next.muted);
    }
    if (next.volume !== before.volume) {
      callbacks.onSetVolume(next.volume);
    }
  }

  function setMix(bus: SoundBus, level: SoundLevel): void {
    change({ mix: { ...options.mix, [bus]: level } });
    callbacks.onSetMix(bus, level);
  }

  return {
    actions: {
      toggleCalmMode() {
        change({ calmMode: !options.calmMode });
        callbacks.onToggleCalmMode(options.calmMode);
      },
      toggleMute() {
        setSound(toggleMuted(options));
      },
      stepVolume(side) {
        setSound(stepSound(options, side));
      },
      toggleMix(bus) {
        setMix(bus, toggleMuted(options.mix[bus]));
      },
      stepMix(bus, side) {
        setMix(bus, stepSound(options.mix[bus], side));
      },
      toggleHitSound() {
        change({ hitSound: !options.hitSound });
        callbacks.onToggleHitSound(options.hitSound);
      },
      toggleAutoFire() {
        change({ autoFire: !options.autoFire });
        callbacks.onToggleAutoFire(options.autoFire);
      },
      toggleAutoAim() {
        change({ autoAim: !options.autoAim });
        callbacks.onToggleAutoAim(options.autoAim);
      },
      setPseudo(pseudo) {
        change({ pseudo });
        callbacks.onSetPseudo(pseudo);
      },
    },
    calmMode: () => options.calmMode,
    apply(next = options) {
      change(next);
    },
  };
}
