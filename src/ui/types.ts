import type { GameContent } from '../data/types';
import type { InputDevice, InputSnapshot } from '../input/intents';
import type { PlayerId, SimState } from '../sim/state';

export interface UiCallbacks {
  onStart(): void;
  onRestart(): void;
  onChooseUpgrade(playerId: PlayerId, upgradeId: string): void;
  onToggleCalmMode(enabled: boolean): void;
  onToggleMute(muted: boolean): void;
}

export interface Ui {
  showTitle(options: { calmMode: boolean; muted: boolean; device: InputDevice }): void;
  showGame(): void;
  showEnd(state: SimState): void;
  update(state: SimState, snapshot: InputSnapshot, content: GameContent): void;
  destroy(): void;
}

export type CreateUi = (root: HTMLElement, callbacks: UiCallbacks) => Ui;
