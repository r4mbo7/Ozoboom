import type { TitleActions, TitleOptions } from './title';
import type { UiCallbacks } from './types';
import { type SoundLevel, VOLUME_STEPS, stepSound } from './volume';

export type TitleOptionActions = Pick<
  TitleActions,
  | 'toggleCalmMode'
  | 'toggleMute'
  | 'stepVolume'
  | 'toggleHitSound'
  | 'toggleAutoFire'
  | 'toggleAutoAim'
>;

type TitleOptionCallbacks = Pick<
  UiCallbacks,
  | 'onToggleCalmMode'
  | 'onToggleMute'
  | 'onSetVolume'
  | 'onToggleHitSound'
  | 'onToggleAutoFire'
  | 'onToggleAutoAim'
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
    hitSound: false,
    autoFire: false,
    autoAim: false,
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

  return {
    actions: {
      toggleCalmMode() {
        change({ calmMode: !options.calmMode });
        callbacks.onToggleCalmMode(options.calmMode);
      },
      toggleMute() {
        setSound({ volume: options.volume, muted: !options.muted });
      },
      stepVolume(side) {
        setSound(stepSound(options, side));
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
    },
    calmMode: () => options.calmMode,
    apply(next = options) {
      change(next);
    },
  };
}
