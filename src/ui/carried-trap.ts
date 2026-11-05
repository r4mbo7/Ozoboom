import type { GameContent, SummonLook, TrapDefinition } from '../data/types';
import type { InputDevice } from '../input/intents';
import { t } from '../shared/i18n';
import type { PlayerState, SimState } from '../sim/state';
import { el, icon, keycap, setFlag, setText } from './dom';
import { FULL_OFFERING_ICONS, FULL_PLACE_KEY } from './full';
import { type CarriedTile, carriedTile, trapCaption, trapTileTitle, trapToTake } from './hud-model';
import { trapIcon } from './icons';
import type { Prompts } from './prompts';

// What the place key would do, with its key; on touch, the button that lifts or puts down, which
// shows the carried trap. With a keyboard or a gamepad, the trap above the head says it alone.
export interface CarriedTrap {
  readonly element: HTMLElement;
  build(content: GameContent): void;
  update(player: PlayerState, state: SimState, content: GameContent): void;
  setDevice(device: InputDevice): void;
}

function drawTile(
  tile: HTMLElement,
  view: CarriedTile,
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
  setFlag(tile, 'board', false);
  setFlag(tile, 'empty', view.trapId === null && view.offering !== true);
  setFlag(tile, 'offering', view.offering === true);
}

export function createCarriedTrap(prompts: Prompts): CarriedTrap {
  const element = el('section', 'ui-hud__traps');
  element.setAttribute('aria-label', t('Pièges'));
  const tile = el('div', 'ui-trap');
  tile.dataset.touchControl = 'trap';
  const trapName = el('div', 'ui-traps__name');
  const key = el('span', 'ui-traps__key');
  const label = el('span', 'ui-traps__label');
  trapName.append(key, label);
  element.append(tile, trapName);

  let definitions: ReadonlyMap<string, TrapDefinition> = new Map();
  // To redraw the tile only when what it holds changes.
  let drawn: string | null | undefined;
  let touch = false;

  return {
    element,
    build(content) {
      definitions = new Map(content.traps.map((trap) => [trap.id, trap]));
      drawn = undefined;
    },
    update(player, state, content) {
      const use = FULL_PLACE_KEY.use?.(state, player);
      if (use !== undefined) {
        if (drawn !== use.id) {
          drawn = use.id;
          tile.querySelector('.ui-trap__icon')?.remove();
          tile.append(icon('ui-trap__icon', use.icon));
          tile.title = use.label;
          setFlag(tile, 'empty', false);
          setFlag(tile, 'offering', false);
          setFlag(tile, 'board', true);
        }
        setText(label, use.label);
        trapName.hidden = false;
        element.hidden = false;
        return;
      }
      const view = carriedTile(player);
      const look = content.summons?.find((summon) => summon.setId === state.setId)?.look;
      const held = view.offering === true ? `offering:${look ?? ''}` : view.trapId;
      if (drawn !== held) {
        drawn = held;
        const trap = view.trapId === null ? undefined : definitions.get(view.trapId);
        drawTile(tile, view, trap, look);
      }
      const caption = trapCaption(definitions, trapToTake(definitions, state, player), view.trapId);
      setText(label, caption ?? '');
      trapName.hidden = caption === null;
      element.hidden = !touch && caption === null;
    },
    setDevice(device) {
      touch = device === 'touch';
      setFlag(element, 'touch', touch);
      tile.hidden = !touch;
      const shown = prompts.for(device);
      key.replaceChildren(...(touch ? [] : [keycap(shown.placeTrap, shown.style)]));
    },
  };
}
