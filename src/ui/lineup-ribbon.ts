import type { GameContent, SetDefinition } from '../data/types';
import { direction, t } from '../shared/i18n';
import { lineupCursor, lineupSlots, setFraction } from '../sim/lineup';
import type { SimState } from '../sim/state';
import { el, icon, setFlag, setText, setVar } from './dom';
import { type SlotEdges, dropReading, isNight, slotLabel, sunPosition } from './hud-model';
import { INFINITY, MOON, SUN } from './icons';

export interface LineupRibbon {
  readonly element: HTMLElement;
  build(set: SetDefinition): void;
  update(set: SetDefinition, state: SimState, content: GameContent): void;
}

function endlessMark(from: number | null | undefined): string | undefined {
  return from === undefined ? undefined : from === null ? 'ahead' : 'on';
}

function slotNodes(set: SetDefinition): { slots: HTMLElement[]; groups: HTMLElement[] } {
  const slots: HTMLElement[] = [];
  const groups: HTMLElement[] = [];
  let group: HTMLElement | null = null;
  for (const slot of lineupSlots(set)) {
    if (slot.kind === 'sunrise') {
      group = null;
    } else if (group === null || (slot.kind === 'phrase' && slot.phrase === 0)) {
      group = el('div', 'ui-lineup__tier');
      groups.push(group);
    }
    const node = el('span', `ui-slot ui-slot--${slot.kind}`);
    node.title = slotLabel(slot);
    if (slot.kind === 'sunrise') {
      node.append(icon('ui-slot__sun', SUN), icon('ui-slot__endless', INFINITY));
      groups.push(node);
    } else {
      group?.append(node);
    }
    slots.push(node);
  }
  return { slots, groups };
}

function slotEdgesOf(track: HTMLElement, slots: readonly HTMLElement[]): SlotEdges[] {
  const width = track.clientWidth;
  const rtl = direction() === 'rtl';
  return width === 0
    ? []
    : slots.map((slot) => {
        const start = rtl ? width - slot.offsetLeft - slot.offsetWidth : slot.offsetLeft;
        return { start: start / width, width: slot.offsetWidth / width };
      });
}

function paintSlots(slots: readonly HTMLElement[], set: SetDefinition, state: SimState): void {
  const cursor = lineupCursor(set, state);
  slots.forEach((slot, index) => {
    const status = index < cursor.slot ? 'done' : index === cursor.slot ? 'current' : 'next';
    if (slot.dataset.state !== status) {
      slot.dataset.state = status;
    }
    if (index === cursor.slot) {
      setVar(slot, '--fill', String(cursor.fraction ?? 1));
      setFlag(slot, 'open', cursor.fraction === null);
    }
  });
}

// An endless game has no sunrise: its last slot says so, lit once the last boss fell.
function paintEndless(last: HTMLElement | undefined, from: number | null | undefined): void {
  if (last === undefined || last.dataset.endless === endlessMark(from)) {
    return;
  }
  if (from === undefined) {
    delete last.dataset.endless;
  } else {
    last.dataset.endless = endlessMark(from);
  }
  last.title = from === undefined ? t('Sunrise') : t('Sans fin');
}

export function createLineupRibbon(): LineupRibbon {
  const element = el('section', 'ui-panel ui-hud__ribbon');
  element.setAttribute('aria-label', t('Line-up'));
  const drop = el('div', 'ui-drop');
  const dropLabel = el('span', 'ui-drop__label', t('Drop'));
  const dropValue = el('span', 'ui-drop__value');
  dropValue.setAttribute('role', 'timer');
  dropValue.setAttribute('aria-label', t('Drop'));
  drop.append(dropLabel, dropValue);
  const track = el('div', 'ui-lineup');
  const sky = el('div', 'ui-lineup__sky');
  sky.setAttribute('aria-hidden', 'true');
  const sun = el('span', 'ui-lineup__sun');
  sky.append(sun);
  const timeline = el('div', 'ui-panel ui-hud__timeline');
  timeline.append(track);
  element.append(drop, timeline);

  let slots: HTMLElement[] = [];
  let slotEdges: SlotEdges[] = [];
  let sunNight: boolean | null = null;
  let sunAt = -1;

  function measureSlots(): void {
    slotEdges = slotEdgesOf(track, slots);
  }

  function paintSun(fraction: number): void {
    const edges =
      slotEdges.length === slots.length
        ? slotEdges
        : slots.map((_, index) => ({ start: index / slots.length, width: 1 / slots.length }));
    const at = sunPosition(fraction, edges);
    if (Math.abs(at - sunAt) > 0.0005) {
      sunAt = at;
      setVar(sky, '--sun', String(at));
    }
    const night = isNight(fraction);
    if (night !== sunNight) {
      sunNight = night;
      sun.replaceChildren(icon('ui-lineup__glyph', night ? MOON : SUN));
    }
  }

  function paintDrop(set: SetDefinition, state: SimState, content: GameContent): void {
    const reading = dropReading(set, state, content);
    setText(dropLabel, reading.label);
    setText(dropValue, reading.value);
    dropValue.hidden = reading.value === '';
    setFlag(element, 'drop', reading.dropping);
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(measureSlots).observe(track);
  }

  return {
    element,
    build(set) {
      const nodes = slotNodes(set);
      slots = nodes.slots;
      track.replaceChildren(sky, ...nodes.groups);
      measureSlots();
    },
    update(set, state, content) {
      paintSlots(slots, set, state);
      paintEndless(slots.at(-1), state.set.endlessFromTick);
      paintDrop(set, state, content);
      paintSun(setFraction(set, state));
    },
  };
}
