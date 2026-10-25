import type { GameContent } from '../data/types';
import { t } from '../shared/i18n';
import type { PlayerId, PlayerState } from '../sim/state';
import { type Bracelet, createBracelet } from './bracelet';
import { el } from './dom';
import type { Prompts } from './prompts';
import { type Roster, braceletedPlayers } from './hud-model';
import type { UiFrame } from './types';

export interface BraceletRow {
  readonly element: HTMLElement;
  update(frame: UiFrame, content: GameContent, roster: Roster): void;
  landing(playerId: PlayerId): HTMLElement | null;
}

export function createBraceletRow(prompts: Prompts): BraceletRow {
  const element = el('div', 'ui-hud__bracelets');
  element.setAttribute('aria-label', t('Les joueurs'));
  const views: Bracelet[] = [];
  let worn: readonly PlayerState[] = [];

  function fit(count: number): void {
    while (views.length < count) {
      const view = createBracelet(prompts);
      views.push(view);
      element.append(view.element);
    }
    while (views.length > count) {
      views.pop()?.element.remove();
    }
  }

  return {
    element,
    update(frame, content, roster) {
      worn = braceletedPlayers(roster);
      fit(worn.length);
      worn.forEach((player, index) => {
        const definition = content.classes.find((entry) => entry.id === player.classId) ?? null;
        const local = frame.players.find((entry) => entry.playerId === player.id);
        const device = roster.locals.includes(player)
          ? (local?.snapshot.device ?? frame.snapshot.device)
          : null;
        views[index]?.update(player, definition, device);
      });
    },
    landing(playerId) {
      const index = worn.findIndex((player) => player.id === playerId);
      return views[index]?.element ?? null;
    },
  };
}
