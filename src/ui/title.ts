import type { InputDevice } from '../input/intents';
import { el, fillHint, keycap, setText } from './dom';
import { formatNumber } from './format';
import { createFeedbackButton } from './feedback-button';
import { type Menu, createMenu } from './menu';
import { promptsFor } from './prompts';
import {
  createAutoAimToggle,
  createAutoFireToggle,
  createHitSoundToggle,
  createToggle,
} from './toggle';
import { createSoundControl } from './volume';

export interface TitleActions {
  start(): void;
  playTogether(): void;
  toggleCalmMode(): void;
  toggleMute(): void;
  stepVolume(side: -1 | 1): void;
  toggleHitSound(): void;
  toggleAutoFire(): void;
  toggleAutoAim(): void;
  feedback?(): void;
}

export interface TitleOptions {
  readonly calmMode: boolean;
  readonly muted: boolean;
  readonly volume: number;
  readonly hitSound: boolean;
  readonly autoFire: boolean;
  readonly autoAim: boolean;
}

export interface TitleScreen {
  readonly element: HTMLElement;
  readonly menu: Menu;
  setOptions(options: TitleOptions): void;
  setDevice(device: InputDevice): void;
  setVisits(count: number): void;
}

const MANDALA =
  '<svg viewBox="-100 -100 200 200" focusable="false">' +
  Array.from({ length: 12 }, (_, index) => {
    const turn = index * 30;
    return `<ellipse rx="22" ry="78" transform="rotate(${String(turn)})"/>`;
  }).join('') +
  '<circle r="96"/><circle r="60"/><circle r="30"/></svg>';

export function createTitle(actions: TitleActions): TitleScreen {
  const element = el('section', 'ui-screen ui-title');
  element.setAttribute('aria-label', 'Écran titre');

  const header = el('header', 'ui-title__header');
  const mandala = el('div', 'ui-title__mandala');
  mandala.setAttribute('aria-hidden', 'true');
  mandala.innerHTML = MANDALA;
  header.append(
    mandala,
    el('h1', 'ui-title__logo', 'Ozoboom'),
    el('p', 'ui-title__tagline', 'Défends le sound system jusqu’au lever du soleil.'),
  );

  const play = el('button', 'ui-button ui-button--primary', 'Jouer');
  play.type = 'button';
  const together = el('button', 'ui-button', 'Jouer à plusieurs');
  together.type = 'button';
  const calm = createToggle('Mode calme', 'Sans strobos, secousses ni halos forts', 'Oui', 'Non');
  const sound = createSoundControl((side) => {
    actions.stepVolume(side);
  });
  const hitSound = createHitSoundToggle();
  const autoFire = createAutoFireToggle();
  const autoAim = createAutoAimToggle();

  const items = [
    play,
    together,
    calm.button,
    sound.element,
    hitSound.button,
    autoFire.button,
    autoAim.button,
  ];
  if (actions.feedback !== undefined) {
    items.push(createFeedbackButton());
  }

  const nav = el('nav', 'ui-menu');
  nav.setAttribute('aria-label', 'Menu principal');
  nav.append(...items);

  const controls = el('section', 'ui-panel ui-controls');
  const controlsHead = el('div', 'ui-panel__head');
  const controlsTitle = el('h2', 'ui-panel__label');
  controlsHead.append(controlsTitle);
  const controlsList = el('dl', 'ui-controls__list');
  controls.append(controlsHead, controlsList);

  const hint = el('p', 'ui-hint');

  const meta = el('p', 'ui-title__meta', `v${__APP_RELEASE__}`);

  const body = el('div', 'ui-title__body');
  body.append(header, nav, controls, hint, meta);
  element.append(body);

  const activations = [
    () => {
      actions.start();
    },
    () => {
      actions.playTogether();
    },
    () => {
      actions.toggleCalmMode();
    },
    () => {
      actions.toggleMute();
    },
    () => {
      actions.toggleHitSound();
    },
    () => {
      actions.toggleAutoFire();
    },
    () => {
      actions.toggleAutoAim();
    },
    () => {
      actions.feedback?.();
    },
  ];
  const menu = createMenu(
    (index) => {
      activations[index]?.();
    },
    (index, side) => {
      if (items[index] !== sound.element) {
        return false;
      }
      actions.stepVolume(side);
      return true;
    },
  );
  menu.setItems(items);

  let device: InputDevice | null = null;

  return {
    element,
    menu,
    setOptions(options) {
      calm.set(options.calmMode);
      sound.set(options);
      hitSound.set(options.hitSound);
      autoFire.set(options.autoFire);
      autoAim.set(options.autoAim);
    },
    setVisits(count) {
      setText(meta, `v${__APP_RELEASE__} · ${formatNumber(count)} visite${count > 1 ? 's' : ''}`);
    },
    setDevice(next) {
      if (next === device) {
        return;
      }
      device = next;
      const prompts = promptsFor(next);
      setText(controlsTitle, `Commandes · ${prompts.name}`);
      controlsList.replaceChildren(
        ...prompts.controls.map((control) => {
          const row = el('div', 'ui-controls__row');
          const keys = el('dd', 'ui-controls__keys');
          keys.append(...control.keys.map((key) => keycap(key, prompts.style)));
          row.append(el('dt', 'ui-controls__action', control.action), keys);
          return row;
        }),
      );
      fillHint(
        hint,
        [
          { keys: prompts.navigate, label: 'naviguer' },
          { keys: prompts.navigateRow, label: 'son' },
          { keys: [prompts.confirm], label: 'valider' },
        ],
        prompts.style,
      );
    },
  };
}
