import type { SimEvent } from '../state';
import type { SpecialModule } from './types';

export const babble: SpecialModule = ({ state }, enemy, effect) => {
  if (effect.kind !== 'babble') {
    return;
  }
  const bar = state.events.find(
    (event): event is Extract<SimEvent, { type: 'bar' }> => event.type === 'bar',
  );
  if (bar !== undefined && bar.bar % effect.everyBars === 0) {
    state.events.push({
      type: 'enemyBabbled',
      id: enemy.id,
      kind: enemy.kind,
      x: enemy.x,
      y: enemy.y,
    });
  }
};
