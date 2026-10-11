import type { InputDevice, MenuIntents } from '../input/intents';
import { el, fillHint } from './dom';
import { formatTempo } from './format';
import { stepClass } from './lobby-model';
import { promptsFor } from './prompts';
import { stagePreview } from './stage-preview';
import type { StageCard, StagePickerModel } from './types';

export interface StageCards {
  readonly element: HTMLElement;
  set(stages: readonly StageCard[], stageId: string): void;
  // A guest sees the host's pick and cannot change it.
  setReadonly(readonly: boolean): void;
}

// The next scene before or after the picked one, wrapping; null with nothing to choose from.
export function stepStage(
  stages: readonly StageCard[],
  stageId: string,
  delta: number,
): string | null {
  return stepClass(
    stages.map((stage) => ({ id: stage.setId })),
    stageId,
    delta,
  );
}

function card(stage: StageCard, onChoose: (setId: string) => void, readonly: () => boolean) {
  const node = el('button', 'ui-stage');
  node.type = 'button';
  node.tabIndex = -1;
  node.setAttribute('role', 'radio');
  const meta = el('span', 'ui-stage__meta');
  meta.append(
    el('span', 'ui-stage__chip', stage.style),
    el('span', 'ui-stage__chip', formatTempo(stage.bpm)),
  );
  node.append(stagePreview(stage.decor), el('span', 'ui-stage__name', stage.name), meta);
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!readonly()) {
      onChoose(stage.setId);
    }
  });
  return node;
}

// One card per scene, the picked one lit. Shared by the picker and the lobby.
export function createStageCards(label: string, onChoose: (setId: string) => void): StageCards {
  const element = el('div', 'ui-stagecards');
  element.setAttribute('role', 'radiogroup');
  element.setAttribute('aria-label', label);
  let stages: readonly StageCard[] = [];
  let nodes: HTMLButtonElement[] = [];
  let locked = false;

  function same(next: readonly StageCard[]): boolean {
    return (
      next.length === stages.length &&
      next.every((stage, index) => JSON.stringify(stage) === JSON.stringify(stages[index]))
    );
  }

  return {
    element,
    set(next, stageId) {
      if (!same(next)) {
        stages = next;
        nodes = next.map((stage) => card(stage, onChoose, () => locked));
        element.replaceChildren(...nodes);
      }
      stages.forEach((stage, index) => {
        nodes[index]?.setAttribute('aria-checked', String(stage.setId === stageId));
      });
    },
    setReadonly(readonly) {
      locked = readonly;
      element.toggleAttribute('data-readonly', readonly);
      element.setAttribute('aria-readonly', String(readonly));
    },
  };
}

export interface StagePickerActions {
  choose(setId: string): void;
  confirm(): void;
  leave(): void;
}

export interface StagePickerScreen {
  readonly element: HTMLElement;
  setModel(model: StagePickerModel): void;
  setDevice(device: InputDevice): void;
  update(edges: MenuIntents): void;
}

// Solo: after « Jouer », pick the scene. Left and right choose, Enter launches, Escape goes back.
export function createStagePicker(actions: StagePickerActions): StagePickerScreen {
  let model: StagePickerModel = { stages: [], stageId: '' };

  const element = el('section', 'ui-screen ui-stagepicker');
  element.setAttribute('aria-label', 'Choix de la scène');
  const header = el('header', 'ui-lobby__header');
  header.append(
    el('p', 'ui-kicker', 'Avant de lancer'),
    el('h2', 'ui-lobby__title', 'Choisis la scène'),
    el('p', 'ui-lobby__lead', 'Où se passe la nuit ?'),
  );
  const cards = createStageCards('Scènes', (setId) => {
    actions.choose(setId);
  });
  cards.element.setAttribute('aria-current', 'true');
  const launch = el('button', 'ui-button ui-button--primary', 'Lancer le set');
  launch.type = 'button';
  launch.tabIndex = -1;
  const back = el('button', 'ui-button', 'Retour au titre');
  back.type = 'button';
  back.tabIndex = -1;
  launch.addEventListener('click', () => {
    actions.confirm();
  });
  back.addEventListener('click', () => {
    actions.leave();
  });
  const footer = el('div', 'ui-lobby__actions');
  footer.append(launch, back);
  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-lobby__body');
  body.append(header, cards.element, footer, hint);
  element.append(body);

  let device: InputDevice | null = null;

  function paintHint(): void {
    if (device === null) {
      return;
    }
    const prompts = promptsFor(device);
    fillHint(
      hint,
      [
        { keys: prompts.navigateRow, label: 'choisir' },
        { keys: [prompts.confirm], label: 'lancer' },
        { keys: [prompts.back], label: 'retour' },
      ],
      prompts.style,
    );
  }

  return {
    element,
    setModel(next) {
      model = next;
      cards.set(next.stages, next.stageId);
    },
    setDevice(next) {
      if (next !== device) {
        device = next;
        paintHint();
      }
    },
    update(edges) {
      const delta = (edges.right || edges.down ? 1 : 0) - (edges.left || edges.up ? 1 : 0);
      const next = delta === 0 ? null : stepStage(model.stages, model.stageId, delta);
      if (edges.back) {
        actions.leave();
      } else if (edges.confirm) {
        actions.confirm();
      } else if (next !== null) {
        actions.choose(next);
      }
    },
  };
}
