import type { SpecialModule } from './types';

// Runs after enemy-steering: x - prevX is the step just taken, and a still enemy has no front.
export const frontGuard: SpecialModule = (_ctx, enemy, effect) => {
  if (effect.kind !== 'frontGuard') {
    return;
  }
  enemy.front ??= { x: 0, y: 0, damageMul: effect.frontDamageMul };
  enemy.front.x = enemy.x - enemy.prevX;
  enemy.front.y = enemy.y - enemy.prevY;
};
