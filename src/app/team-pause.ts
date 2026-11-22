import type { DeviceId, InputDevice } from '../input/intents';
import { t } from '../shared/i18n';
import type { PlayerId } from '../sim/state';
import { createControlsButton, createFeedbackButton } from '../ui';
import type { InputView, MatchSeat } from './match';
import type { PauseItem, PauseScreen } from './pause';
import type { Settings } from './settings';

export interface TeamPause {
  readonly paused: boolean;
  // Online, the pause menu stops nothing: the set goes on, and so does its music.
  readonly stopsTheSet: boolean;
  // The device that pressed pause; null for a pause the game opened, as when the tab is hidden.
  readonly pauser: DeviceId | null;
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
  readonly backToLobby: () => void;
  readonly online: () => boolean;
  // A team whose lobby this screen leads: on one screen, or the online host's.
  readonly leadsTeam: () => boolean;
}

// The pause is the team's: any device pauses, navigates and resumes, through the merged view.
export function createTeamPause(screen: PauseScreen, env: TeamPauseEnv): TeamPause {
  let paused = false;
  let pauser: DeviceId | null = null;

  function pause(device: InputDevice, by: DeviceId | null = null): void {
    if (paused) {
      return;
    }
    paused = true;
    pauser = by;
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
    get pauser() {
      return pauser;
    },
    pause(device) {
      pause(device);
    },
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
          const [id, snapshot] = [...devices].find(([, own]) => own.gameplay.pause) ?? [];
          pause(snapshot?.device ?? merged.device, id);
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

// The player of this screen whose sheet the pause shows: the one on the device that paused, else the
// first; online, that is the local player. Null when this screen plays nobody.
export function pausingPlayer(
  seats: readonly MatchSeat[],
  pauser: DeviceId | null,
): PlayerId | null {
  const local = seats.filter((seat) => seat.local);
  const own = local.find((seat) => seat.device !== null && seat.device === pauser);
  return (own ?? local[0])?.playerId ?? null;
}

export function pauseItems(settings: Settings, actions: PauseActions): PauseItem[] {
  const { prefs } = settings;
  return [
    { label: t('Resume'), activate: actions.resume },
    {
      label: t('Sound'),
      element: settings.soundControl.element,
      activate() {
        settings.setSound({ volume: prefs.volume, muted: !prefs.muted });
      },
      adjust: settings.stepVolume,
    },
    {
      label: t('Hit sound'),
      element: settings.hitSoundToggle.button,
      activate() {
        settings.setHitSound(!prefs.hitSound);
      },
    },
    {
      label: t('Auto fire'),
      element: settings.autoFireToggle.button,
      activate() {
        settings.setAutoFire(!prefs.autoFire);
      },
    },
    {
      label: t('Auto aim'),
      element: settings.autoAimToggle.button,
      activate() {
        settings.setAutoAim(!prefs.autoAim);
      },
    },
    { label: t('Controls'), element: createControlsButton(), activate: actions.openControls },
    { label: t('Your feedback'), element: createFeedbackButton(), activate: actions.openForm },
    {
      label: t('Back to the lobby'),
      shown: actions.leadsTeam,
      confirm: lobbyConfirm(),
      activate: actions.backToLobby,
    },
    {
      label: t('Quit the game'),
      get confirm() {
        return actions.online() ? quitOnlineConfirm() : quitConfirm();
      },
      activate: actions.quit,
    },
  ];
}

const quitConfirm = () =>
  ({
    question: t('Leave the set?'),
    text: t('Heading home before sunrise: the game ends here, with no score.'),
    stay: t('Stay'),
    leave: t('Leave'),
  }) as const;

const lobbyConfirm = () =>
  ({
    question: t('Back to the lobby?'),
    text: t('The set stops for the whole team, with no score: everyone can change character.'),
    stay: t('Stay'),
    leave: t('Back to the lobby'),
  }) as const;

const quitOnlineConfirm = () =>
  ({
    question: t('Leave the set?'),
    text: t(
      'You leave the others behind: your character stands still and the set goes on without you.',
    ),
    stay: t('Stay'),
    leave: t('Leave'),
  }) as const;

const onlinePauseText = () =>
  ({
    heading: t('The set goes on'),
    text: t(
      'Online, pausing doesn’t stop the set: your character stands still while the others play.',
    ),
  }) as const;
