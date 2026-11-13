import type { Vec2 } from '../sim/state';
import { TOUCH_STICK_RADIUS, type Control } from './bindings';
import { applyRadialDeadzone } from './gamepad';
import type { TouchFrame } from './merge';
import './touch.css';

export type TouchControl = 'stick' | 'skill' | 'dash' | 'pause' | 'trap';

interface Stick {
  readonly id: number;
  readonly origin: Vec2;
  readonly at: Vec2;
}

export interface TouchState {
  readonly stick: Stick | null;
  readonly skill: ReadonlySet<number>;
  readonly presses: readonly Control[];
  readonly active: boolean;
}

// A null `control` (a menu, anything else) only tells that the player is on a touch screen.
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
    }
  | { readonly type: 'cancel'; readonly id: number };

export const INITIAL_TOUCH_STATE: TouchState = {
  stick: null,
  skill: new Set(),
  presses: [],
  active: false,
};

const TOUCH_CONTROLS: readonly TouchControl[] = ['stick', 'skill', 'dash', 'pause', 'trap'];

export function parseTouchControl(value: string | undefined): TouchControl | null {
  return TOUCH_CONTROLS.find((control) => control === value) ?? null;
}

export function reduceTouch(state: TouchState, event: TouchEventLike): TouchState {
  switch (event.type) {
    case 'down':
      return press(state, event.id, event.control, { x: event.x, y: event.y });
    case 'move':
      return slide(state, event.id, { x: event.x, y: event.y });
    case 'up':
      return lift(slide(state, event.id, { x: event.x, y: event.y }), event.id);
    case 'cancel':
      return lift(state, event.id);
  }
}

export function releaseTouches(state: TouchState): TouchState {
  return { ...state, stick: null, skill: new Set(), presses: [] };
}

function press(state: TouchState, id: number, control: TouchControl | null, at: Vec2): TouchState {
  const touched = { ...state, active: true };
  if (control === null) return touched;
  if (control === 'stick') {
    return state.stick === null ? { ...touched, stick: { id, origin: at, at } } : touched;
  }
  if (control === 'skill') {
    return {
      ...touched,
      skill: new Set(state.skill).add(id),
      presses: [...state.presses, 'skill'],
    };
  }
  const pressed: Control = control === 'trap' ? 'placeTrap' : control;
  return { ...touched, presses: [...state.presses, pressed] };
}

function slide(state: TouchState, id: number, at: Vec2): TouchState {
  if (state.stick?.id !== id) return state;
  return { ...state, stick: follow(state.stick, at), active: true };
}

function lift(state: TouchState, id: number): TouchState {
  const skill = new Set(state.skill);
  skill.delete(id);
  return { ...state, stick: state.stick?.id === id ? null : state.stick, skill, active: true };
}

function follow(stick: Stick, at: Vec2): Stick {
  const dx = at.x - stick.origin.x;
  const dy = at.y - stick.origin.y;
  const reach = Math.sqrt(dx * dx + dy * dy);
  if (reach <= TOUCH_STICK_RADIUS) return { ...stick, at };
  const pull = (reach - TOUCH_STICK_RADIUS) / reach;
  return { ...stick, at, origin: { x: stick.origin.x + dx * pull, y: stick.origin.y + dy * pull } };
}

export function takeTouchFrame(state: TouchState): { frame: TouchFrame; state: TouchState } {
  const { stick } = state;
  return {
    frame: {
      held: new Set<Control>(state.skill.size > 0 ? ['skill'] : []),
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
    },
    state: { ...state, presses: [], active: false },
  };
}

export interface TouchAdapter {
  take(): TouchFrame;
  destroy(): void;
}

// Coordinates are relative to the target, like the mouse pointer's.
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
  stick.hidden = true;
  target.append(stick);

  const local = (event: PointerEvent): Vec2 => {
    const rect = target.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  // Until the HUD knows it is on a touch screen it lets fingers through: its controls are also found by their box.
  const controlAt = (event: PointerEvent): TouchControl | null => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const found = parseTouchControl(
      element?.closest('[data-touch-control]')?.getAttribute('data-touch-control') ?? undefined,
    );
    if (found !== 'stick') return found;
    for (const control of document.querySelectorAll('[data-touch-control]')) {
      const under = [...control.getClientRects()].some(
        (rect) =>
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom,
      );
      if (control !== target && under) {
        return parseTouchControl(control.getAttribute('data-touch-control') ?? undefined);
      }
    }
    return found;
  };

  const draw = () => {
    stick.hidden = state.stick === null;
    if (state.stick !== null) {
      const { origin, at } = state.stick;
      stick.style.translate = `${String(origin.x)}px ${String(origin.y)}px`;
      knob.style.translate = `${String(at.x - origin.x)}px ${String(at.y - origin.y)}px`;
    }
  };
  const apply = (event: TouchEventLike) => {
    state = reduceTouch(state, event);
    draw();
  };

  // Taken from the browser, a finger on a control would also scroll, zoom or fire; one on a menu still clicks it.
  const onDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    const control = controlAt(event);
    if (control !== null) event.preventDefault();
    apply({ type: 'down', id: event.pointerId, control, ...local(event) });
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    apply({ type: 'move', id: event.pointerId, ...local(event) });
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    apply({ type: 'up', id: event.pointerId, ...local(event) });
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
      delete target.dataset.touchControl;
    },
  };
}
