import type { InputDevice } from '../input/intents';
import { el, fillHint, keycap, setText } from './dom';
import { createFeedbackButton } from './feedback-button';
import { type Menu, createMenu } from './menu';
import { promptsFor } from './prompts';
import { createToggle } from './toggle';

export interface TitleActions {
  start(): void;
  toggleCalmMode(): void;
  toggleMute(): void;
  feedback?(): void;
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

  const items = [play, calm.button, sound.button];
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

  const body = el('div', 'ui-title__body');
  body.append(header, nav, controls, hint);
  element.append(body);

  const menu = createMenu((index) => {
    if (index === 0) {
      actions.start();
    } else if (index === 1) {
      actions.toggleCalmMode();
    } else if (index === 2) {
      actions.toggleMute();
    } else {
      actions.feedback?.();
    }
  });
  menu.setItems(items);

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
