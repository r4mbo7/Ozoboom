import { IDLE_INPUT } from '../commands';
import { lookup } from '../content';
import { SKILLS, skillModule } from '../skills';
import { skillCooldownTicks, statValue } from '../stats';
import type { StepContext } from './types';

export function skills(ctx: StepContext): void {
  const { state, content, commands } = ctx;
  if (state.events.some((event) => event.type === 'bar')) {
    delete state.core.repairedThisBar;
  }
  for (const player of state.players) {
    player.skillCooldown = Math.max(0, player.skillCooldown - 1);
    player.invulnerableTicks = Math.max(0, (player.invulnerableTicks ?? 0) - 1);
    if (player.downed) {
      continue;
    }
    const input = commands.get(player.id)?.input ?? IDLE_INPUT;
    const { skill } = lookup(content.classes, player.classId, 'class');

    if (input.skill && player.skillCooldown === 0) {
      const power = statValue(player, 'skillPowerMul', 1);
      skillModule(skill.effect).cast(ctx, player, skill.effect, input, power);
      player.skillCooldown = skillCooldownTicks(player, skill);
      state.events.push({ type: 'skillUsed', playerId: player.id });
    }
  }
  for (const module of Object.values(SKILLS)) {
    module.update?.(ctx);
  }
}
