import { describe, expect, it } from 'vitest';
import type { GameContent, UpgradeDefinition, WeaponDefinition } from '../../data/types';
import { FIXTURE_CONTENT, FIXTURE_OPTIONS, actionsFor } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { PlayerState } from '../state';

const weapon = (id: string, extra: Partial<WeaponDefinition> = {}): WeaponDefinition => ({
  id,
  name: id,
  description: id,
  rhythm: { everyBars: 1, steps: [0] },
  effect: { kind: 'sweep', damage: 1, radius: 10, arcDegrees: 90 },
  maxLevel: 2,
  levelMul: 1.5,
  ...extra,
});

const upgrade = (id: string, maxStacks: number): UpgradeDefinition => ({
  id,
  name: id,
  description: id,
  family: 'generic',
  modifiers: [{ stat: 'speedMul', mul: 1.1 }],
  maxStacks,
});

const CONTENT: GameContent = {
  ...FIXTURE_CONTENT,
  upgrades: [upgrade('twin', 2), upgrade('filler', 9)],
  weapons: [weapon('stick'), weapon('double-stick', { evolvedFrom: 'stick', maxLevel: 1 })],
  fusions: [{ weaponId: 'stick', upgradeId: 'twin', resultId: 'double-stick' }],
};

function game(): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation({ ...FIXTURE_OPTIONS, content: CONTENT });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, player };
}

function holdRecipe(player: PlayerState, level = 2, stacks = 2): void {
  player.weapons = [{ id: 'stick', level, phase: 0 }];
  player.upgrades = Array.from({ length: stacks }, () => 'twin');
}

function offer(simulation: Simulation, player: PlayerState): readonly string[] {
  player.vibes = player.vibesToNextLevel;
  simulation.step([]);
  const options = simulation.state.pendingUpgrades[0]?.options ?? [];
  return options;
}

const choose = (upgradeId: string) => actionsFor(0, { type: 'chooseUpgrade', upgradeId });

describe('fusion', () => {
  it('offers the fused form when the weapon is at its maximum level and the upgrade at its maximum stacks', () => {
    const { simulation, player } = game();
    holdRecipe(player);

    expect(offer(simulation, player)).toContain('double-stick');
  });

  it.each([
    ['the weapon is below its maximum level', 1, 2],
    ['the upgrade is below its maximum stacks', 2, 1],
  ])('does not offer it when %s', (_name, level, stacks) => {
    const { simulation, player } = game();
    holdRecipe(player, level, stacks);

    expect(offer(simulation, player)).not.toContain('double-stick');
  });

  it('does not offer it without the weapon', () => {
    const { simulation, player } = game();
    player.upgrades = ['twin', 'twin'];

    expect(offer(simulation, player)).not.toContain('double-stick');
  });

  it('replaces the weapon by the fused form at level 1 and announces it', () => {
    const { simulation, player } = game();
    holdRecipe(player);
    offer(simulation, player);

    simulation.step([choose('double-stick')]);

    expect(player.weapons).toEqual([{ id: 'double-stick', level: 1, phase: 0 }]);
    expect(player.upgrades).toEqual(['twin', 'twin']);
    expect(simulation.state.events).toContainEqual({
      type: 'weaponEvolved',
      playerId: 0,
      weaponId: 'stick',
      resultId: 'double-stick',
    });
    expect(simulation.state.pendingUpgrades).toEqual([]);
  });

  it('serves a recipe once: the card never comes back', () => {
    const { simulation, player } = game();
    holdRecipe(player);
    offer(simulation, player);
    simulation.step([choose('double-stick')]);
    simulation.step([]);
    player.weapons = [{ id: 'stick', level: 2, phase: 0 }];

    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      offer(simulation, player).forEach((id) => seen.add(id));
      simulation.state.pendingUpgrades.length = 0;
      simulation.state.status = 'running';
    }

    expect(seen).not.toContain('double-stick');
  });

  it('refuses the fused form when it was not offered or the recipe is not open', () => {
    const { simulation, player } = game();
    holdRecipe(player, 1);
    simulation.step([]);
    simulation.state.pendingUpgrades.push({
      playerId: 0,
      options: ['double-stick'],
      rarities: ['common'],
    });
    simulation.step([]);

    simulation.step([choose('double-stick')]);

    expect(player.weapons).toEqual([{ id: 'stick', level: 1, phase: 0 }]);
    expect(simulation.state.pendingUpgrades).toHaveLength(1);
  });
});
