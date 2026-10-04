import { ENEMIES } from '../data/enemies';
import type { SimState } from '../sim/state';
import { at, teleport } from './fixture';

export type SheetPose = 'awake' | 'asleep' | 'down';

// One mask of each sort in a row, all the same size, for judging a drawing at a given size.
export function layMasks(state: SimState, diameter: number, pose: SheetPose): void {
  const { core } = state;
  const gap = Math.max(diameter * 0.5, 14);
  const step = diameter + gap;
  const left = core.x - (step * (ENEMIES.length - 1)) / 2;
  state.projectiles = [];
  state.pickups = [];
  state.traps = [];
  state.enemies = ENEMIES.map((def, index) => {
    state.nextEntityId += 1;
    return at(
      {
        id: state.nextEntityId,
        kind: def.id,
        radius: diameter / 2,
        hp: pose === 'down' ? 0 : 10,
        maxHp: 10,
        speed: 0,
        damage: 0,
        target: 'core',
        attackCooldown: 0,
        slowFactor: 1,
        stunTicks: pose === 'asleep' ? 1_000_000 : 0,
        marked: false,
        isBoss: def.behaviour === 'boss',
        ...(pose === 'down' ? { downTicks: 1_000_000 } : {}),
      },
      left + index * step,
      core.y - 120,
    );
  });
  const player = state.players[0];
  if (player !== undefined) {
    teleport(player, core.x, core.y + 100);
  }
}

export function killMasks(state: SimState): void {
  state.events = state.enemies.map((enemy) => ({
    type: 'enemyDied',
    id: enemy.id,
    kind: enemy.kind,
    x: enemy.x,
    y: enemy.y,
    byPlayer: 0,
  }));
  state.enemies = [];
}
