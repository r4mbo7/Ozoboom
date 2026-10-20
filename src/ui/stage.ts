import type { InputDevice, MenuIntents } from '../input/intents';
import { t } from '../shared/i18n';
import { el, fillHint, setText } from './dom';
import {
  createNightTabs,
  launchDetail,
  launchLabel,
  nightLength,
  nightNote,
  nightOf,
  stageQuestion,
} from './night';
import { formatTempo } from './format';
import { stepClass } from './lobby-model';
import { promptsFor } from './prompts';
import { stagePreview } from './stage-preview';
import { STAGE_TEASERS, stageTeaser } from './teaser';
import type { Night, StageCard, StagePickerModel } from './types';

export interface StageCards {
  readonly element: HTMLElement;
  // In a festival the stage picked is where it starts, the others follow.
  set(stages: readonly StageCard[], stageId: string, festival?: boolean): void;
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
    el('span', 'ui-stage__chip', t(stage.style)),
    el('span', 'ui-stage__chip', formatTempo(stage.bpm)),
  );
  const tag = el('span', 'ui-stage__tag');
  tag.hidden = true;
  node.append(tag, stagePreview(stage.decor), el('span', 'ui-stage__name', t(stage.name)), meta);
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
  const teasers = STAGE_TEASERS.map(stageTeaser);

  function same(next: readonly StageCard[]): boolean {
    return (
      next.length === stages.length &&
      next.every((stage, index) => JSON.stringify(stage) === JSON.stringify(stages[index]))
    );
  }

  return {
    element,
    set(next, stageId, festival = false) {
      if (!same(next)) {
        stages = next;
        nodes = next.map((stage) => card(stage, onChoose, () => locked));
        element.replaceChildren(...nodes, ...teasers);
      }
      element.toggleAttribute('data-festival', festival);
      stages.forEach((stage, index) => {
        const node = nodes[index];
        const picked = stage.setId === stageId;
        node?.setAttribute('aria-checked', String(picked));
        const tag = node?.querySelector<HTMLElement>('.ui-stage__tag');
        if (tag) {
          tag.hidden = !festival;
          tag.toggleAttribute('data-start', picked);
          setText(tag, picked ? t('Départ') : t('Ensuite'));
        }
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
  chooseNight(night: Night): void;
  confirm(): void;
  leave(): void;
}

export interface StagePickerScreen {
  readonly element: HTMLElement;
  // The picker opens: the cards are picked, not the switch.
  open(): void;
  setModel(model: StagePickerModel): void;
  setDevice(device: InputDevice): void;
  update(edges: MenuIntents): void;
}

// Solo: after the class, pick the night and the scene. The tab keys choose the night, left and right the scene,
// Enter launches, Escape goes back.
export function createStagePicker(actions: StagePickerActions): StagePickerScreen {
  let model: StagePickerModel = { stages: [], stageId: '', endless: false };

  const element = el('section', 'ui-screen ui-stagepicker');
  element.setAttribute('aria-label', t('Choix de la scène'));
  const header = el('header', 'ui-lobby__header');
  const title = el('h2', 'ui-lobby__title');
  header.append(el('p', 'ui-kicker', t('Avant de lancer')), title);
  const nights = createNightTabs((night) => {
    actions.chooseNight(night);
  });
  const cards = createStageCards(t('Scènes'), (setId) => {
    actions.choose(setId);
  });
  const note = el('p', 'ui-stagepicker__note');
  const launch = el('button', 'ui-button ui-button--primary ui-launch');
  launch.type = 'button';
  launch.tabIndex = -1;
  const launchText = el('span', 'ui-launch__label');
  const launchMore = el('span', 'ui-launch__detail');
  launch.append(launchText, launchMore);
  const back = el('button', 'ui-button', t('Retour au perso'));
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
  body.append(header, nights.element, cards.element, note, footer, hint);
  element.append(body);

  let device: InputDevice | null = null;

  function paintHint(): void {
    if (device === null) {
      return;
    }
    const prompts = promptsFor(device);
    nights.setKeys(prompts.tabs, prompts.style);
    fillHint(
      hint,
      [
        ...(prompts.tabs.length === 0 ? [] : [{ keys: prompts.tabs, label: t('mode') }]),
        { keys: prompts.navigateRow, label: t('scène') },
        { keys: [prompts.confirm], label: t('lancer') },
        { keys: [prompts.back], label: t('retour') },
      ],
      prompts.style,
    );
  }

  return {
    element,
    open() {
      paintHint();
    },
    setModel(next) {
      model = next;
      const night = nightOf(next);
      setText(title, stageQuestion(night));
      nights.set(night, nightLength(night, next.stages, next.stageId));
      cards.set(next.stages, next.stageId, night === 'festival');
      setText(note, nightNote(night));
      note.hidden = nightNote(night) === '';
      setText(launchText, launchLabel(night));
      setText(launchMore, launchDetail(night, next.stages, next.stageId));
    },
    setDevice(next) {
      if (next !== device) {
        device = next;
        paintHint();
      }
    },
    update(edges) {
      if (nights.handle(edges)) {
        return;
      }
      const delta = (edges.right ? 1 : 0) - (edges.left ? 1 : 0);
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
