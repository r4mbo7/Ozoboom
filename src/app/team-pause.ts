import type { InputDevice } from '../input/intents';
import { t } from '../shared/i18n';
import { createControlsButton, createFeedbackButton } from '../ui';
import type { InputView } from './match';
import type { PauseItem, PauseScreen } from './pause';
import type { Settings } from './settings';

export interface TeamPause {
  readonly paused: boolean;
  // Online, the pause menu stops nothing: the set goes on, and so does its music.
  readonly stopsTheSet: boolean;
  pause(device: InputDevice): void;
  resume(): void;
  dismiss(): void;
  takesPresses(view: InputView): boolean;
}

export interface TeamPauseEnv {
  online(): boolean;
  changed(): void;
}

export interface PauseActions {
  readonly resume: () => void;
  readonly openControls: () => void;
  readonly openForm: () => void;
  readonly quit: () => void;
  readonly online: () => boolean;
}

// The pause is the team's: any device pauses, navigates and resumes, through the merged view.
export function createTeamPause(screen: PauseScreen, env: TeamPauseEnv): TeamPause {
  let paused = false;

  function pause(device: InputDevice): void {
    if (paused) {
      return;
    }
    paused = true;
    env.changed();
    screen.show(device, env.online() ? onlinePauseText() : undefined);
  }

  function resume(): void {
    if (!paused) {
      return;
    }
    paused = false;
    env.changed();
    screen.hide();
  }

  return {
    get paused() {
      return paused;
    },
    get stopsTheSet() {
      return paused && !env.online();
    },
    pause,
    resume,
    dismiss() {
      paused = false;
      screen.hide();
    },
    takesPresses({ devices, merged }) {
      const { gameplay, menu } = merged;
      const wasPaused = paused;
      if (!paused) {
        if (gameplay.pause) {
          const pauser = [...devices.values()].find((snapshot) => snapshot.gameplay.pause);
          pause(pauser?.device ?? merged.device);
        }
      } else if ((gameplay.pause || menu.back) && screen.confirming) {
        screen.cancelConfirmation();
      } else if (gameplay.pause || menu.back) {
        resume();
      } else {
        screen.handle(menu, gameplay.move);
      }
      return wasPaused || paused;
    },
  };
}

export function pauseItems(settings: Settings, actions: PauseActions): PauseItem[] {
  const { prefs } = settings;
  return [
    { label: t('Reprendre'), activate: actions.resume },
    {
      label: t('Son'),
      element: settings.soundControl.element,
      activate() {
        settings.setSound({ volume: prefs.volume, muted: !prefs.muted });
      },
      adjust: settings.stepVolume,
    },
    {
      label: t('Son des coups'),
      element: settings.hitSoundToggle.button,
      activate() {
        settings.setHitSound(!prefs.hitSound);
      },
    },
    {
      label: t('Tir automatique'),
      element: settings.autoFireToggle.button,
      activate() {
        settings.setAutoFire(!prefs.autoFire);
      },
    },
    {
      label: t('Visée automatique'),
      element: settings.autoAimToggle.button,
      activate() {
        settings.setAutoAim(!prefs.autoAim);
      },
    },
    { label: t('Contrôles'), element: createControlsButton(), activate: actions.openControls },
    { label: t('Ton avis'), element: createFeedbackButton(), activate: actions.openForm },
    {
      label: t('Quitter la partie'),
      get confirm() {
        return actions.online() ? quitOnlineConfirm() : quitConfirm();
      },
      activate: actions.quit,
    },
  ];
}

const quitConfirm = () =>
  ({
    question: t('Quitter le set ?'),
    text: t('Tu rentres avant le sunrise : la partie s’arrête ici, sans score.'),
    stay: t('Rester'),
    leave: t('Quitter'),
  }) as const;

const quitOnlineConfirm = () =>
  ({
    question: t('Quitter le set ?'),
    text: t(
      'Tu laisses les autres joueurs : ton personnage reste immobile et le set continue sans toi.',
    ),
    stay: t('Rester'),
    leave: t('Quitter'),
  }) as const;

const onlinePauseText = () =>
  ({
    heading: t('Le set continue'),
    text: t(
      'En ligne, la pause n’arrête pas le set : ton personnage reste immobile pendant que les autres jouent.',
    ),
  }) as const;
