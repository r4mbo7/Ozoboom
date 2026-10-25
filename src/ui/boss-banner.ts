import type { GameContent } from '../data/types';
import { t } from '../shared/i18n';
import { SUN_PALETTES } from '../shared/palette';
import { setTempo, setOf } from '../sim/lineup';
import type { SimState } from '../sim/state';
import { el, setText } from './dom';

const BANNER_BEATS = 9;

export function landedBoss(state: Pick<SimState, 'events'>, content: GameContent): string | null {
  for (const event of state.events) {
    if (event.type === 'enemySpawned') {
      const definition = content.enemies.find((enemy) => enemy.id === event.kind);
      if (definition?.behaviour === 'boss') {
        return t(definition.name);
      }
    }
  }
  return null;
}

export interface BossBanner {
  readonly element: HTMLElement;
  update(state: SimState, content: GameContent): void;
  reset(): void;
}

export function createBossBanner(): BossBanner {
  const element = el('div', 'ui-boss');
  element.setAttribute('role', 'status');
  element.hidden = true;
  for (const token of ['sol', 'or', 'noyau'] as const) {
    element.style.setProperty(`--${token}`, SUN_PALETTES.nuit[token]);
  }
  const name = el('span', 'ui-boss__name');
  element.append(name);
  let since = Number.NEGATIVE_INFINITY;

  return {
    element,
    update(state, content) {
      const landed = landedBoss(state, content);
      if (landed !== null) {
        setText(name, landed);
        since = state.tick;
      }
      const { ticksPerBeat } = setTempo(setOf(content, state.setId));
      const elapsed = state.tick - since;
      element.hidden = elapsed < 0 || elapsed >= BANNER_BEATS * ticksPerBeat;
    },
    reset() {
      since = Number.NEGATIVE_INFINITY;
      element.hidden = true;
    },
  };
}
