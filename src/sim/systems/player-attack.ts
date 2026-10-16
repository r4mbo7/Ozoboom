import { ATTACKS, attackModule } from '../attacks';
import { IDLE_INPUT } from '../commands';
import { lookup } from '../content';
import type { StepContext } from './types';

export function playerAttack(ctx: StepContext): void {
  for (const player of ctx.state.players) {
    if (player.downed) {
      delete player.chargeTicks;
      continue;
    }
    if (player.dash !== undefined) {
      continue;
    }
    const { attack } = lookup(ctx.content.classes, player.classId, 'class');
    const input = ctx.commands.get(player.id)?.input ?? IDLE_INPUT;
    attackModule(attack).step(ctx, player, attack, input);
  }
  for (const module of Object.values(ATTACKS)) {
    module.update?.(ctx);
  }
}
