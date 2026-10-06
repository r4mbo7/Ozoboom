import type { Vec2 } from '../sim/state';
import {
  TOUCH_DRAG_THRESHOLD,
  TOUCH_STICK_RADIUS,
  TRAP_SLOT_CONTROLS,
  type Control,
} from './bindings';
import { applyRadialDeadzone } from './gamepad';
import type { TouchFrame } from './merge';
import './touch.css';

// What a finger lands on, from the `data-touch-control` of the element under it: the arena takes
// the virtual stick, the HUD its trap tiles, its skill and its pause button.
export type TouchControl = 'stick' | 'skill' | 'pause' | `trap:${number}`;

interface Stick {
  readonly id: number;
  readonly origin: Vec2;
  readonly at: Vec2;
}

interface Drag {
  readonly slot: number;
  readonly origin: Vec2;
  readonly at: Vec2;
  readonly moved: boolean;
  readonly onArena: boolean;
}

export interface TouchState {
  readonly stick: Stick | null;
  readonly skill: ReadonlySet<number>;
  // A finger lands on the skill this frame: a tap shorter than a frame still casts it.
  readonly skillTapped: boolean;
  readonly drags: ReadonlyMap<number, Drag>;
  readonly presses: readonly Control[];
  readonly drop: Vec2 | null;
  readonly active: boolean;
}

// `control` is null for a finger on anything else, a menu for one: it only tells that the player
// is on a touch screen.
export type TouchEventLike =
  | {
      readonly type: 'down';
      readonly id: number;
      readonly control: TouchControl | null;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly type: 'move' | 'up';
      readonly id: number;
      readonly x: number;
      readonly y: number;
      readonly onArena: boolean;
    }
  | { readonly type: 'cancel'; readonly id: number };

export const INITIAL_TOUCH_STATE: TouchState = {
  stick: null,
  skill: new Set(),
  skillTapped: false,
  drags: new Map(),
  presses: [],
  drop: null,
  active: false,
};

export function parseTouchControl(value: string | undefined): TouchControl | null {
  if (value === 'stick' || value === 'skill' || value === 'pause') return value;
  const slot = trapSlot(value);
  return slot === null ? null : (`trap:${String(slot)}` as TouchControl);
}

function trapSlot(value: string | undefined): number | null {
  const match = /^trap:(\d+)$/.exec(value ?? '');
  const slot = match === null ? NaN : Number(match[1]);
  return slot < TRAP_SLOT_CONTROLS.length ? slot : null;
}

export function reduceTouch(state: TouchState, event: TouchEventLike): TouchState {
  switch (event.type) {
    case 'down':
      return press(state, event.id, event.control, { x: event.x, y: event.y });
    case 'move':
      return slide(state, event.id, { x: event.x, y: event.y }, event.onArena);
    case 'up':
      return lift(
        slide(state, event.id, { x: event.x, y: event.y }, event.onArena),
        event.id,
        true,
      );
    case 'cancel':
      return lift(state, event.id, false);
  }
}

export function releaseTouches(state: TouchState): TouchState {
  return { ...state, stick: null, skill: new Set(), skillTapped: false, drags: new Map() };
}

function press(state: TouchState, id: number, control: TouchControl | null, at: Vec2): TouchState {
  const touched = { ...state, active: true };
  if (control === null) return touched;
  if (control === 'stick') {
    return state.stick === null ? { ...touched, stick: { id, origin: at, at } } : touched;
  }
  if (control === 'skill') {
    return { ...touched, skill: new Set(state.skill).add(id), skillTapped: true };
  }
  if (control === 'pause') return { ...touched, presses: [...state.presses, 'pause'] };
  const slot = trapSlot(control);
  const select = slot === null ? undefined : TRAP_SLOT_CONTROLS[slot];
  if (slot === null || select === undefined) return touched;
  return {
    ...touched,
    drags: new Map(state.drags).set(id, { slot, origin: at, at, moved: false, onArena: false }),
    presses: [...state.presses, select],
  };
}

function slide(state: TouchState, id: number, at: Vec2, onArena: boolean): TouchState {
  if (state.stick?.id === id) {
    return { ...state, stick: follow(state.stick, at), active: true };
  }
  const drag = state.drags.get(id);
  if (drag === undefined) return state;
  const moved = drag.moved || distance(drag.origin, at) > TOUCH_DRAG_THRESHOLD;
  return {
    ...state,
    drags: new Map(state.drags).set(id, { ...drag, at, moved, onArena }),
    active: true,
  };
}

// A tap places the trap at the player's feet, a drag where the finger leaves the arena; a drag
// that ends back on the HUD changes nothing.
function lift(state: TouchState, id: number, placing: boolean): TouchState {
  const skill = new Set(state.skill);
  skill.delete(id);
  const drags = new Map(state.drags);
  const drag = drags.get(id);
  drags.delete(id);
  const next = {
    ...state,
    stick: state.stick?.id === id ? null : state.stick,
    skill,
    drags,
    active: true,
  };
  if (!placing || drag === undefined || (drag.moved && !drag.onArena)) return next;
  return {
    ...next,
    presses: [...state.presses, 'placeTrap'],
    drop: drag.moved ? drag.at : null,
  };
}

function follow(stick: Stick, at: Vec2): Stick {
  const dx = at.x - stick.origin.x;
  const dy = at.y - stick.origin.y;
  const reach = Math.sqrt(dx * dx + dy * dy);
  if (reach <= TOUCH_STICK_RADIUS) return { ...stick, at };
  const pull = (reach - TOUCH_STICK_RADIUS) / reach;
  return { ...stick, at, origin: { x: stick.origin.x + dx * pull, y: stick.origin.y + dy * pull } };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function takeTouchFrame(state: TouchState): { frame: TouchFrame; state: TouchState } {
  const { stick } = state;
  return {
    frame: {
      held: new Set<Control>(state.skill.size > 0 || state.skillTapped ? ['skill'] : []),
      presses: state.presses,
      move:
        stick === null
          ? { x: 0, y: 0 }
          : applyRadialDeadzone(
              (stick.at.x - stick.origin.x) / TOUCH_STICK_RADIUS,
              (stick.at.y - stick.origin.y) / TOUCH_STICK_RADIUS,
            ),
      aim: null,
      active: state.active,
      drop: state.drop,
    },
    state: { ...state, skillTapped: false, presses: [], drop: null, active: false },
  };
}

export interface TouchAdapter {
  take(): TouchFrame;
  destroy(): void;
}

// The target is the arena: a finger that lands on it, and on nothing of the interface above it,
// steers the virtual stick. Coordinates are relative to it, like the mouse pointer's.
export function attachTouch(target: HTMLElement): TouchAdapter {
  const document = target.ownerDocument;
  const view = document.defaultView;
  if (view === null) throw new Error('Input target is not attached to a window');
  let state = INITIAL_TOUCH_STATE;
  target.dataset.touchControl = 'stick';

  const stick = document.createElement('div');
  stick.className = 'touch-stick';
  const knob = document.createElement('div');
  knob.className = 'touch-stick__knob';
  stick.append(knob);
  const drop = document.createElement('div');
  drop.className = 'touch-drop';
  stick.hidden = true;
  drop.hidden = true;
  target.append(stick, drop);

  const local = (event: PointerEvent): Vec2 => {
    const rect = target.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  // Until the HUD knows it is on a touch screen, it lets fingers through to the arena like the
  // mouse: its controls are also found by their box, so that they answer the first touch.
  const controlAt = (event: PointerEvent): TouchControl | null => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const found = parseTouchControl(
      element?.closest<HTMLElement>('[data-touch-control]')?.dataset.touchControl,
    );
    if (found !== 'stick') return found;
    for (const control of document.querySelectorAll<HTMLElement>('[data-touch-control]')) {
      const under = [...control.getClientRects()].some(
        (rect) =>
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom,
      );
      if (control !== target && under) return parseTouchControl(control.dataset.touchControl);
    }
    return found;
  };
  const onArena = (event: PointerEvent) => controlAt(event) === 'stick';

  const draw = () => {
    stick.hidden = state.stick === null;
    if (state.stick !== null) {
      const { origin, at } = state.stick;
      stick.style.translate = `${String(origin.x)}px ${String(origin.y)}px`;
      knob.style.translate = `${String(at.x - origin.x)}px ${String(at.y - origin.y)}px`;
    }
    const dragged = [...state.drags.values()].find((drag) => drag.moved && drag.onArena);
    drop.hidden = dragged === undefined;
    if (dragged !== undefined) {
      drop.style.translate = `${String(dragged.at.x)}px ${String(dragged.at.y)}px`;
    }
  };
  const apply = (event: TouchEventLike) => {
    state = reduceTouch(state, event);
    draw();
  };

  // Taken from the browser, a finger on a control would also scroll, zoom, or press the mouse and
  // fire. A finger elsewhere keeps its default: a tap on a menu still clicks it.
  const onDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    const control = controlAt(event);
    if (control !== null) event.preventDefault();
    apply({ type: 'down', id: event.pointerId, control, ...local(event) });
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    apply({ type: 'move', id: event.pointerId, onArena: onArena(event), ...local(event) });
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    apply({ type: 'up', id: event.pointerId, onArena: onArena(event), ...local(event) });
  };
  const onCancel = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    apply({ type: 'cancel', id: event.pointerId });
  };
  const onBlur = () => {
    state = releaseTouches(state);
    draw();
  };

  view.addEventListener('pointerdown', onDown);
  view.addEventListener('pointermove', onMove);
  view.addEventListener('pointerup', onUp);
  view.addEventListener('pointercancel', onCancel);
  view.addEventListener('blur', onBlur);

  return {
    take() {
      const taken = takeTouchFrame(state);
      state = taken.state;
      return taken.frame;
    },
    destroy() {
      view.removeEventListener('pointerdown', onDown);
      view.removeEventListener('pointermove', onMove);
      view.removeEventListener('pointerup', onUp);
      view.removeEventListener('pointercancel', onCancel);
      view.removeEventListener('blur', onBlur);
      stick.remove();
      drop.remove();
      delete target.dataset.touchControl;
    },
  };
}
