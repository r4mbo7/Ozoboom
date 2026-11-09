import { t } from '../shared/i18n';
import type { SetDefinition } from '../data/types';
import type { PlayerState, SimEvent, SimState, Vec2 } from '../sim/state';
import { el, icon, keycap, setText } from './dom';
import { enteredSpeaker, volumeCrans } from './hud-model';
import { PLUG, SENT } from './icons';
import type { DevicePrompts } from './prompts';

// The gestures of the tutorial, in the order it asks them (docs/game-design.md, « Didacticiel »).
export const TUTORIAL_STEPS = [
  'move',
  'fire',
  'vibes',
  'upgrade',
  'trap',
  'dash',
  'skill',
  'speaker',
] as const;

export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

// `step` is the index of the gesture asked, TUTORIAL_STEPS.length once all are done; `doneAt`, the
// tick its gesture was done; `from`, where the player stood when it was asked; `done`, every gesture
// the player has made so far, so that one made ahead of its turn is not asked.
export interface TutorialProgress {
  readonly step: number;
  readonly doneAt: number | null;
  readonly from: Vec2 | null;
  readonly done: readonly TutorialStep[];
}

export interface TutorialSight {
  readonly tick: number;
  readonly events: readonly SimEvent[];
  readonly players: readonly Pick<PlayerState, 'id' | 'x' | 'y' | 'carriedTrap'>[];
}

// Arena units the player walks before the first step counts.
const WALK = 160;
// A done gesture shows its tick this long before the next one is asked.
const DONE_TICKS = 30;
// The last line stays this long.
const LAST_TICKS = 150;
// The cells of the charge gauge: one per beat of the two bars a speaker takes.
const CHARGE_CELLS = 8;

export const TUTORIAL_START: TutorialProgress = { step: 0, doneAt: null, from: null, done: [] };

// The gesture an event shows the player did, null for any other event.
function gestureOf(event: SimEvent, playerId: number): TutorialStep | null {
  switch (event.type) {
    case 'playerFired':
      return event.playerId === playerId ? 'fire' : null;
    case 'pickupCollected':
      return event.playerId === playerId ? 'vibes' : null;
    // A weapon taken or evolved at a level is the player's choice as much as an upgrade.
    case 'upgradeChosen':
    case 'weaponGained':
    case 'weaponEvolved':
      return event.playerId === playerId ? 'upgrade' : null;
    // Put down: only a lifted trap is, so the trap was moved.
    case 'trapPlaced':
      return event.playerId === playerId ? 'trap' : null;
    case 'dashed':
      return event.playerId === playerId ? 'dash' : null;
    case 'skillUsed':
      return event.playerId === playerId ? 'skill' : null;
    case 'speakerPlugged':
      return 'speaker';
    default:
      return null;
  }
}

// The next gesture to ask after `step`, past those the player has already done on their own.
function nextStep(step: number, done: readonly TutorialStep[]): number {
  let next = step + 1;
  while (next < TUTORIAL_STEPS.length && done.includes(TUTORIAL_STEPS[next] ?? 'move')) {
    next += 1;
  }
  return next;
}

// Called once per step of the sim, so that no event goes by unseen; the same progress when nothing changed.
export function advanceTutorial(
  progress: TutorialProgress,
  sight: TutorialSight,
): TutorialProgress {
  const player = sight.players[0];
  const step = TUTORIAL_STEPS[progress.step];
  if (player === undefined || step === undefined) {
    return progress;
  }
  const made = sight.events
    .map((event) => gestureOf(event, player.id))
    .filter(
      (gesture): gesture is TutorialStep => gesture !== null && !progress.done.includes(gesture),
    );
  const done = made.length === 0 ? progress.done : [...progress.done, ...new Set(made)];
  if (progress.doneAt !== null) {
    if (sight.tick - progress.doneAt < DONE_TICKS) {
      return done === progress.done ? progress : { ...progress, done };
    }
    const next = nextStep(progress.step, done);
    return {
      step: next,
      doneAt: next === TUTORIAL_STEPS.length ? sight.tick : null,
      from: null,
      done,
    };
  }
  const from = progress.from ?? { x: player.x, y: player.y };
  const did =
    step === 'move'
      ? Math.hypot(player.x - from.x, player.y - from.y) >= WALK
      : made.includes(step);
  if (did) {
    return { step: progress.step, doneAt: sight.tick, from, done };
  }
  return progress.from === null || done !== progress.done ? { ...progress, from, done } : progress;
}

export function tutorialOver(progress: TutorialProgress, tick: number): boolean {
  return (
    progress.step === TUTORIAL_STEPS.length &&
    progress.doneAt !== null &&
    tick - progress.doneAt >= LAST_TICKS
  );
}

// Where the player is in a two-part gesture: holding a trap above the head, so the line asks to put
// it down; standing in a speaker's circle, so the line asks to stay.
export interface Gesture {
  readonly carrying: boolean;
  readonly inside: boolean;
}

export function lineOf(step: TutorialStep, touch: boolean, { carrying, inside }: Gesture): string {
  switch (step) {
    case 'move':
      return touch ? t('Glisse sur l’arène pour te déplacer') : t('Déplace-toi');
    case 'fire':
      return touch ? t('Approche une bad vibe : tu tires tout seul') : t('Tire');
    case 'vibes':
      return t('Ramasse les vibes');
    case 'upgrade':
      return t('Remplis ta jauge de vibes, puis choisis une amélioration');
    case 'trap':
      if (carrying) {
        return touch
          ? t('Va plus loin et touche encore le bouton')
          : t('Va plus loin et repose-le');
      }
      return touch
        ? t('Près d’un piège, touche le bouton du piège pour le prendre')
        : t('Prends un piège pour le déplacer');
    case 'dash':
      return touch ? t('Touche le bouton du dash') : t('Fais un dash');
    case 'skill':
      return touch ? t('Touche le bouton de ta spéciale') : t('Lance ta spéciale');
    case 'speaker':
      return inside ? t('Restes-y : elle se branche') : t('Va dans le cercle d’une enceinte');
  }
}

function keysOf(step: TutorialStep, shown: DevicePrompts): readonly string[] {
  switch (step) {
    case 'move':
      return shown.move;
    case 'fire':
      return shown.fire;
    case 'trap':
      return [shown.placeTrap];
    case 'dash':
      return [shown.dash];
    case 'skill':
      return [shown.skill];
    default:
      return [];
  }
}

// The key the arena shows under the player for the gesture asked: none on touch, whose button calls.
export function tutorialKey(step: TutorialStep, shown: DevicePrompts, touch: boolean): string {
  return touch ? '' : (keysOf(step, shown)[0] ?? '');
}

// Whether a player stands in a speaker's circle, and the cells of the gauge lit by the charge of
// the speaker plugging furthest, which drains once the player is out.
export function speakerCharge(
  set: SetDefinition,
  state: SimState,
): { inside: boolean; lit: number } {
  const fill = Math.max(
    0,
    ...volumeCrans(set, state)
      .filter((cran) => cran.state !== 'on')
      .map((cran) => cran.fill),
  );
  return {
    inside: enteredSpeaker(set, state) !== null,
    lit: Math.floor(fill * CHARGE_CELLS + 1e-6),
  };
}

// The drawing of the HUD a line speaks of, so that a newcomer knows what it names: the level ring
// for the vibes gauge, the plug of the ribbon for a speaker.
function signOf(step: TutorialStep | undefined): readonly HTMLElement[] {
  switch (step) {
    case 'upgrade':
      return [el('span', 'ui-tutorial__gauge')];
    case 'speaker':
      return [icon('ui-tutorial__plug', PLUG)];
    default:
      return [];
  }
}

export interface TutorialBanner {
  readonly element: HTMLElement;
  // A tutorial game asks its gestures from the first; any other game hides the banner.
  reset(active: boolean): void;
  // The gesture the banner asks now, null when it asks none.
  observe(sight: TutorialSight): TutorialStep | null;
  // The key of the gesture asked on the device in play, '' on touch or for a gesture without one.
  askedKey(): string;
  setDevice(shown: DevicePrompts, touch: boolean): void;
  // Each frame: whether the player stands in a speaker's circle, and how far its charge has gone.
  follow(set: SetDefinition, state: SimState): void;
}

export function createTutorialBanner(): TutorialBanner {
  const element = el('div', 'ui-tutorial');
  element.setAttribute('role', 'status');
  element.hidden = true;
  const sign = el('span', 'ui-tutorial__sign');
  sign.setAttribute('aria-hidden', 'true');
  const line = el('span', 'ui-tutorial__line');
  const keys = el('span', 'ui-tutorial__keys');
  const tick = icon('ui-tutorial__tick', SENT);
  const charge = el('span', 'ui-tutorial__charge');
  charge.setAttribute('aria-hidden', 'true');
  const cells = Array.from({ length: CHARGE_CELLS }, () => el('span', 'ui-tutorial__cell'));
  charge.append(...cells);
  element.append(sign, line, charge, keys, tick);
  let active = false;
  let progress = TUTORIAL_START;
  let device: { shown: DevicePrompts; touch: boolean } | null = null;
  // What the banner shows, so that a step of the sim that changes nothing touches no node.
  let drawn: {
    step: number;
    done: boolean;
    carrying: boolean;
    inside: boolean;
    lit: number;
  } | null = null;
  let now = 0;
  let carrying = false;
  let inside = false;
  // Cells of the gauge lit by the charge of the speaker plugging furthest.
  let lit = 0;

  function draw(): void {
    const over = !active || tutorialOver(progress, now);
    const done = progress.doneAt !== null;
    if (over) {
      element.hidden = true;
      drawn = null;
      return;
    }
    if (
      drawn?.step === progress.step &&
      drawn.done === done &&
      drawn.carrying === carrying &&
      drawn.inside === inside &&
      drawn.lit === lit
    ) {
      return;
    }
    drawn = { step: progress.step, done, carrying, inside, lit };
    element.hidden = false;
    element.dataset.done = String(done);
    const step = TUTORIAL_STEPS[progress.step];
    element.dataset.step = step ?? 'end';
    sign.replaceChildren(...signOf(step));
    const touch = device?.touch ?? false;
    setText(
      line,
      step === undefined
        ? t('Tu sais jouer. Tiens jusqu’au sunrise\u202f!')
        : lineOf(step, touch, { carrying, inside }),
    );
    // The gauge shows while the player charges a speaker, and while the charge drains once out.
    charge.hidden = step !== 'speaker' || done || (!inside && lit === 0);
    cells.forEach((cell, index) => cell.classList.toggle('is-lit', index < lit));
    const shown = step === undefined || device === null || touch ? [] : keysOf(step, device.shown);
    keys.replaceChildren(
      ...shown
        .filter((name) => name !== '')
        .map((name) => keycap(name, device?.shown.style ?? 'key')),
    );
  }

  return {
    element,
    reset(next) {
      active = next;
      progress = TUTORIAL_START;
      drawn = null;
      now = 0;
      carrying = false;
      inside = false;
      lit = 0;
      draw();
    },
    observe(sight) {
      if (!active) {
        return null;
      }
      progress = advanceTutorial(progress, sight);
      now = sight.tick;
      // Each beat swaps the kick, which starts the call of the button the banner names again.
      if (sight.events.some((event) => event.type === 'beat')) {
        element.dataset.kick = element.dataset.kick === 'a' ? 'b' : 'a';
      }
      carrying = sight.players[0]?.carriedTrap !== undefined;
      draw();
      return progress.doneAt === null ? (TUTORIAL_STEPS[progress.step] ?? null) : null;
    },
    askedKey() {
      const step = TUTORIAL_STEPS[progress.step];
      return step === undefined || device === null || progress.doneAt !== null
        ? ''
        : tutorialKey(step, device.shown, device.touch);
    },
    setDevice(shown, touch) {
      device = { shown, touch };
      drawn = null;
      draw();
    },
    follow(set, state) {
      // A done gesture keeps its line under the tick.
      if (!active || progress.doneAt !== null) {
        return;
      }
      ({ inside, lit } = speakerCharge(set, state));
      draw();
    },
  };
}
