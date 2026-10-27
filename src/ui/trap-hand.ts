import type { GameContent, SetDefinition, SummonLook, TrapDefinition } from '../data/types';
import type { InputSnapshot } from '../input/intents';
import { t } from '../shared/i18n';
import type { PlayerId, PlayerState, SimState } from '../sim/state';
import { trapCapacity } from '../sim/stats';
import { el, icon, keycap, setFlag, setText } from './dom';
import { FULL_OFFERING_ICONS } from './full';
import {
  type HandTile,
  firstTrapCall,
  handTiles,
  trapCaption,
  trapSlotsFull,
  trapTileTitle,
  trapToTake,
  trapsFull,
} from './hud-model';
import { trapIcon } from './icons';
import { heldSlot, selectTrap } from './navigation';

export interface TrapHand {
  readonly element: HTMLElement;
  build(content: GameContent, set: SetDefinition): void;
  update(
    player: PlayerState,
    state: SimState,
    content: GameContent,
    set: SetDefinition,
    gameplay: InputSnapshot['gameplay'],
  ): void;
  reset(): void;
}

function trapTile(index: number): HTMLElement {
  const tile = el('div', 'ui-trap');
  tile.dataset.touchControl = `trap:${String(index)}`;
  tile.append(el('span', 'ui-trap__key', String(index + 1)));
  return tile;
}

function drawTile(
  tile: HTMLElement,
  view: HandTile,
  trap: TrapDefinition | undefined,
  look: SummonLook | undefined,
): void {
  const offering =
    view.offering === true && look !== undefined ? FULL_OFFERING_ICONS[look] : undefined;
  tile.querySelector('.ui-trap__icon')?.remove();
  if (trap !== undefined) {
    tile.append(icon('ui-trap__icon', trapIcon(trap.effect)));
  } else if (offering !== undefined) {
    tile.append(icon('ui-trap__icon', offering));
  }
  tile.title = trapTileTitle(view, trap, look);
}

function flagTile(tile: HTMLElement, view: HandTile, selected: boolean, call: boolean): void {
  setFlag(tile, 'empty', view.trapId === null && view.offering !== true);
  setFlag(tile, 'offering', view.offering === true);
  setFlag(tile, 'selected', selected);
  setFlag(tile, 'blocked', view.trapId !== null && !view.available);
  setFlag(tile, 'full', view.full === true);
  setFlag(tile, 'call', call);
  if (!call) {
    delete tile.dataset.kick;
  }
}

// The calling tile kicks on every beat: the attribute alternates so the animation starts over.
function kick(tile: HTMLElement): void {
  tile.dataset.kick = tile.dataset.kick === 'a' ? 'b' : 'a';
}

// A place refused for want of a slot flashes the count, from the last frame's events.
function flash(count: HTMLElement, player: PlayerState, state: SimState): void {
  for (const event of state.events) {
    if (event.type === 'trapRefused' && event.playerId === player.id) {
      count.dataset.flash = count.dataset.flash === 'a' ? 'b' : 'a';
    }
  }
}

export function createTrapHand(): TrapHand {
  const element = el('section', 'ui-hud__traps');
  element.setAttribute('aria-label', t('Pièges'));
  const row = el('div', 'ui-traps');
  const cyclePrevious = el('span', 'ui-traps__cycle');
  const cycleNext = el('span', 'ui-traps__cycle');
  cyclePrevious.append(keycap('LB', 'button'));
  cycleNext.append(keycap('RB', 'button'));
  const trapName = el('div', 'ui-traps__name');
  const count = el('span', 'ui-traps__count');
  count.hidden = true;
  element.append(cyclePrevious, row, cycleNext, trapName);

  let tiles: HTMLElement[] = [];
  // To redraw a tile only when its trap changes.
  let tileTraps: (string | null)[] = [];
  let definitions: ReadonlyMap<string, TrapDefinition> = new Map();
  let selectedTrap = 0;
  let previousGameplay: InputSnapshot['gameplay'] | null = null;
  const placed = new Set<PlayerId>();
  let kickedBeat = -1;

  return {
    element,
    build(content, set) {
      selectedTrap = Math.min(selectedTrap, set.handSize - 1);
      definitions = new Map(content.traps.map((trap) => [trap.id, trap]));
      tiles = Array.from({ length: set.handSize }, (_, index) => trapTile(index));
      tileTraps = tiles.map(() => null);
      row.replaceChildren(...tiles, count);
    },
    update(player, state, content, set, gameplay) {
      selectedTrap = selectTrap(selectedTrap, tiles.length, gameplay, previousGameplay);
      previousGameplay = gameplay;
      const capacity = trapCapacity(set, state);
      const views = handTiles(definitions, state, player, tiles.length, capacity);
      const selected = heldSlot(selectedTrap, player.hand?.length ?? 0);
      const call = firstTrapCall(views, state, player, placed);
      const look = content.summons?.find((summon) => summon.setId === state.setId)?.look;
      views.forEach((view, index) => {
        const tile = tiles[index];
        if (tile === undefined) {
          return;
        }
        const held = view.offering === true ? `offering:${look ?? ''}` : view.trapId;
        if (tileTraps[index] !== held) {
          tileTraps[index] = held;
          const trap = view.trapId === null ? undefined : definitions.get(view.trapId);
          drawTile(tile, view, trap, look);
        }
        flagTile(tile, view, index === selected, index === call);
        if (index === call && state.set.beat !== kickedBeat) {
          kick(tile);
        }
      });
      kickedBeat = state.set.beat;
      const taken = trapToTake(definitions, state, player, tiles.length);
      const full = trapsFull(state, capacity);
      const caption = trapCaption(definitions, taken, player.hand?.[selected], full);
      setText(trapName, caption ?? '');
      trapName.hidden = caption === null;
      const slots = trapSlotsFull(state, capacity);
      setText(count, slots ?? '');
      count.hidden = slots === null;
      flash(count, player, state);
    },
    reset() {
      selectedTrap = 0;
      previousGameplay = null;
      placed.clear();
      kickedBeat = -1;
    },
  };
}
