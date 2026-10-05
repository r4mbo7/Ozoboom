import type { PlayerState } from '../sim/state';
import { el, icon } from './dom';
import { classToken, playerLabel } from './hud-model';
import { classMark } from './icons';
import { cssName } from './sun';

export function whoColor(classId: string): string {
  return `var(${cssName(classToken(classId))})`;
}

type Identity = Pick<PlayerState, 'id' | 'name' | 'classId'>;

// A player's name behind the mark of their class, in the colour of their class.
export function createWho(): HTMLElement {
  return el('span', 'ui-who');
}

export function fillWho(node: HTMLElement, player: Identity): void {
  const key = `${player.classId}|${playerLabel(player)}`;
  if (node.dataset.key === key) {
    return;
  }
  node.dataset.key = key;
  node.style.setProperty('--who', whoColor(player.classId));
  node.replaceChildren(
    icon('ui-who__mark', classMark(player.classId)),
    el('span', 'ui-who__name', playerLabel(player)),
  );
}
