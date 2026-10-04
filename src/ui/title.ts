import type { InputDevice } from '../input/intents';
import { el, fillHint, keycap, setText } from './dom';
import { type Menu, createMenu } from './menu';
import { promptsFor } from './prompts';

export interface TitleActions {
  start(): void;
  toggleCalmMode(): void;
  toggleMute(): void;
}

export interface TitleScreen {
  readonly element: HTMLElement;
  readonly menu: Menu;
  setOptions(calmMode: boolean, muted: boolean): void;
  setDevice(device: InputDevice): void;
}

const MANDALA =
  '<svg viewBox="-100 -100 200 200" focusable="false">' +
  Array.from({ length: 12 }, (_, index) => {
    const turn = index * 30;
    return `<ellipse rx="22" ry="78" transform="rotate(${String(turn)})"/>`;
  }).join('') +
  '<circle r="96"/><circle r="60"/><circle r="30"/></svg>';

interface Toggle {
  button: HTMLButtonElement;
  set(on: boolean): void;
}

function createToggle(label: string, hint: string, onText: string, offText: string): Toggle {
  const button = el('button', 'ui-button ui-toggle');
  button.type = 'button';
  button.setAttribute('role', 'switch');
  const text = el('span', 'ui-toggle__text');
  text.append(el('span', 'ui-toggle__label', label), el('span', 'ui-toggle__hint', hint));
  const control = el('span', 'ui-toggle__control');
  const state = el('span', 'ui-toggle__state');
  const track = el('span', 'ui-switch');
  track.append(el('span', 'ui-switch__knob'));
  control.append(state, track);
  button.append(text, control);
  return {
    button,
    set(on) {
      button.setAttribute('aria-checked', String(on));
      setText(state, on ? onText : offText);
    },
  };
}

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
  const calm = createToggle('Mode calme', 'Sans strobos, secousses ni halos forts', 'Oui', 'Non');
  const sound = createToggle('Son', 'Musique et effets', 'Activé', 'Coupé');

  const nav = el('nav', 'ui-menu');
  nav.setAttribute('aria-label', 'Menu principal');
  nav.append(play, calm.button, sound.button);

  const controls = el('section', 'ui-panel ui-controls');
  const controlsHead = el('div', 'ui-panel__head');
  const controlsTitle = el('h2', 'ui-panel__label');
  controlsHead.append(controlsTitle);
  const controlsList = el('dl', 'ui-controls__list');
  controls.append(controlsHead, controlsList);

  const hint = el('p', 'ui-hint');

  const body = el('div', 'ui-title__body');
  body.append(header, nav, controls, hint);
  element.append(body);

  const menu = createMenu((index) => {
    if (index === 0) {
      actions.start();
    } else if (index === 1) {
      actions.toggleCalmMode();
    } else {
      actions.toggleMute();
    }
  });
  menu.setItems([play, calm.button, sound.button]);

  let device: InputDevice | null = null;

  return {
    element,
    menu,
    setOptions(calmMode, muted) {
      calm.set(calmMode);
      sound.set(!muted);
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
          { keys: [prompts.confirm], label: 'valider' },
        ],
        prompts.style,
      );
    },
  };
}
