import type { InputDevice } from '../input/intents';
import { type ClassInfo, createClassCards } from './class-picker';
import { el, fillHint, keycap, setText } from './dom';
import { createFeedbackButton } from './feedback-button';
import { type Menu, createMenu } from './menu';
import { stepClass } from './lobby-model';
import { promptsFor } from './prompts';
import { createSoundToggle, createToggle } from './toggle';

export interface TitleActions {
  start(): void;
  playTogether(): void;
  chooseClass(classId: string): void;
  toggleCalmMode(): void;
  toggleMute(): void;
  feedback?(): void;
}

export interface TitleScreen {
  readonly element: HTMLElement;
  readonly menu: Menu;
  setOptions(calmMode: boolean, muted: boolean): void;
  setClass(classId: string): void;
  setDevice(device: InputDevice): void;
}

const MANDALA =
  '<svg viewBox="-100 -100 200 200" focusable="false">' +
  Array.from({ length: 12 }, (_, index) => {
    const turn = index * 30;
    return `<ellipse rx="22" ry="78" transform="rotate(${String(turn)})"/>`;
  }).join('') +
  '<circle r="96"/><circle r="60"/><circle r="30"/></svg>';

export function createTitle(actions: TitleActions, classes: readonly ClassInfo[]): TitleScreen {
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
  let classId = classes[0]?.id ?? '';
  const picker = createClassCards(classes, (next) => {
    choose(next);
  });
  const calm = createToggle('Mode calme', 'Sans strobos, secousses ni halos forts', 'Oui', 'Non');
  const sound = createSoundToggle();

  const items = [play, picker.element, together, calm.button, sound.button];
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

  function choose(next: string): void {
    if (next !== classId) {
      classId = next;
      picker.set(next);
      actions.chooseClass(next);
    }
  }

  const activations = [
    () => {
      actions.start();
    },
    () => {
      choose(stepClass(classes, classId, 1) ?? classId);
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
      actions.feedback?.();
    },
  ];
  const menu = createMenu(
    (index) => {
      activations[index]?.();
    },
    (index, side) => {
      if (items[index] !== picker.element) {
        return false;
      }
      choose(stepClass(classes, classId, side) ?? classId);
      return true;
    },
  );
  menu.setItems(items);
  picker.set(classId);

  let device: InputDevice | null = null;

  return {
    element,
    menu,
    setOptions(calmMode, muted) {
      calm.set(calmMode);
      sound.set(!muted);
    },
    setClass(next) {
      classId = next;
      picker.set(next);
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
          { keys: prompts.navigateRow, label: 'classe' },
          { keys: [prompts.confirm], label: 'valider' },
        ],
        prompts.style,
      );
    },
  };
}
