import { rotate } from '../../shared/angle';
import type { Vec2 } from '../../shared/vec';

export function fan(aim: Vec2, count: number, spreadRadians: number): Vec2[] {
  return Array.from({ length: count }, (_, i) => {
    const offset = count === 1 ? 0 : -spreadRadians / 2 + (i * spreadRadians) / (count - 1);
    return offset === 0 ? aim : rotate(aim, offset);
  });
}
