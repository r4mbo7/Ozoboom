import type { WeaponEffect } from '../data/types';
import { TICKS_PER_BAR } from '../shared/tempo';
import type { PlacedState, PlayerState, ProjectileState, SimState } from '../sim/state';
import { effectOf } from './fixture-weapons';

const STEP_TICKS = TICKS_PER_BAR / 16;
const SIXTEENTHS = {
  sweep: { everyBars: 1, steps: [0, 4, 8, 12] },
  spark: { everyBars: 1, steps: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15] },
  hoop: { everyBars: 1, steps: [0, 8] },
  lob: { everyBars: 1, steps: [0] },
  boomerang: { everyBars: 1, steps: [4, 12] },
  plate: { everyBars: 1, steps: [8] },
  totem: { everyBars: 2, steps: [0] },
  ribbon: { everyBars: 1, steps: [2, 6, 10, 14] },
} as const;
const FLIGHT_TICKS = 24;
const BOOMERANG_TICKS = 36;

function shoot(
  state: SimState,
  player: PlayerState,
  weaponId: string,
  fields: Partial<ProjectileState>,
): void {
  state.nextEntityId += 1;
  state.projectiles.push({
    id: state.nextEntityId,
    owner: { kind: 'weapon', playerId: player.id, weaponId },
    vx: 0,
    vy: 0,
    radius: 5,
    damage: 1,
    ticksLeft: FLIGHT_TICKS,
    pierceLeft: 0,
    x: player.x,
    y: player.y,
    prevX: player.x,
    prevY: player.y,
    ...fields,
  });
}

function place(state: SimState, player: PlayerState, weaponId: string, at: number, radius: number) {
  const placed = (state.placed ??= []);
  state.nextEntityId += 1;
  const x = player.x + player.aim.x * at;
  const y = player.y + player.aim.y * at;
  const effect = effectOf(weaponId);
  const bars = effect.kind === 'plate' || effect.kind === 'totem' ? effect.durationBars : 4;
  const entry: PlacedState = {
    id: state.nextEntityId,
    weaponId,
    playerId: player.id,
    radius,
    ticksLeft: bars * TICKS_PER_BAR,
    cooldown: 0,
    x,
    y,
    prevX: x,
    prevY: y,
  };
  placed.push(entry);
  const max = effect.kind === 'plate' ? effect.maxPlaced : 1;
  while (placed.filter((candidate) => candidate.weaponId === weaponId).length > max) {
    const oldest = placed.findIndex((candidate) => candidate.weaponId === weaponId);
    placed.splice(oldest, 1);
  }
}

function fire(state: SimState, player: PlayerState, weaponId: string, effect: WeaponEffect): void {
  const { aim } = player;
  switch (effect.kind) {
    case 'sweep':
    case 'hoop':
      state.events.push({
        type: 'weaponFired',
        playerId: player.id,
        weaponId,
        x: player.x,
        y: player.y,
      });
      break;
    case 'spark':
      shoot(state, player, weaponId, { vx: aim.x * 12, vy: aim.y * 12 });
      break;
    case 'lob': {
      const reach = Math.min(effect.range, 240);
      shoot(state, player, weaponId, {
        vx: (aim.x * reach) / FLIGHT_TICKS,
        vy: (aim.y * reach) / FLIGHT_TICKS,
        arc: {
          toX: player.x + aim.x * reach,
          toY: player.y + aim.y * reach,
          ticksTotal: FLIGHT_TICKS,
        },
      });
      break;
    }
    case 'boomerang':
      shoot(state, player, weaponId, {
        vx: aim.x * effect.range * 0.5,
        vy: aim.y * effect.range * 0.5,
        ticksLeft: BOOMERANG_TICKS,
        returnTo: player.id,
      });
      break;
    case 'plate':
      place(state, player, weaponId, 70, effect.radius);
      break;
    case 'totem':
      place(state, player, weaponId, 80, effect.radius);
      break;
    case 'ribbon':
      state.events.push({
        type: 'weaponFired',
        playerId: player.id,
        weaponId,
        x: player.x,
        y: player.y,
      });
      for (const enemy of state.enemies) {
        const along = (enemy.x - player.x) * aim.x + (enemy.y - player.y) * aim.y;
        const across = Math.abs((enemy.y - player.y) * aim.x - (enemy.x - player.x) * aim.y);
        enemy.marked ||= along > 0 && along < effect.length && across < 36 + enemy.radius;
      }
      break;
    case 'orbit':
    case 'trail':
      break;
  }
}

function fly(state: SimState, player: PlayerState): void {
  for (const projectile of state.projectiles) {
    const { owner } = projectile;
    if (owner.kind !== 'weapon') {
      continue;
    }
    const effect = effectOf(owner.weaponId);
    projectile.ticksLeft -= 1;
    if (effect.kind === 'orbit') {
      const angle =
        (state.tick / TICKS_PER_BAR) * effect.turnsPerBar * Math.PI * 2 +
        projectile.pierceLeft * Math.PI;
      projectile.x = player.x + Math.cos(angle) * effect.orbitRadius;
      projectile.y = player.y + Math.sin(angle) * effect.orbitRadius;
      projectile.vx = -Math.sin(angle);
      projectile.vy = Math.cos(angle);
      projectile.ticksLeft = 1_000_000;
    } else if (effect.kind === 'boomerang') {
      const t = 1 - projectile.ticksLeft / BOOMERANG_TICKS;
      const reach = Math.hypot(projectile.vx, projectile.vy);
      const out = Math.sin(Math.PI * t) * reach;
      const bend = Math.sin(Math.PI * 2 * t) * 60;
      const dx = projectile.vx / reach;
      const dy = projectile.vy / reach;
      projectile.x = player.x + dx * out - dy * bend;
      projectile.y = player.y + dy * out + dx * bend;
    } else {
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;
    }
  }
  state.projectiles = state.projectiles.filter(
    (projectile) => projectile.owner.kind !== 'weapon' || projectile.ticksLeft > 0,
  );
  if (state.placed !== undefined) {
    for (const placed of state.placed) {
      placed.ticksLeft -= 1;
    }
    state.placed = state.placed.filter((placed) => placed.ticksLeft > 0);
  }
}

function keepFans(state: SimState, player: PlayerState): void {
  for (const slot of player.weapons ?? []) {
    const effect = effectOf(slot.id);
    if (effect.kind !== 'orbit') {
      continue;
    }
    const present = state.projectiles.filter(
      (candidate) => candidate.owner.kind === 'weapon' && candidate.owner.weaponId === slot.id,
    ).length;
    for (let index = present; index < effect.count; index += 1) {
      shoot(state, player, slot.id, {
        pierceLeft: index,
        ticksLeft: 1_000_000,
        radius: effect.radius,
      });
    }
  }
}

// Fires every weapon of the first player on the sixteenth-note grid, as the sim will.
export function advanceWeapons(state: SimState): void {
  const player = state.players[0];
  if (player?.weapons === undefined || player.weapons.length === 0) {
    return;
  }
  const { tick } = state;
  if (tick % TICKS_PER_BAR === 0) {
    for (const enemy of state.enemies) {
      enemy.marked = false;
    }
  }
  fly(state, player);
  for (const slot of player.weapons) {
    const effect = effectOf(slot.id);
    if (effect.kind === 'trail') {
      const ring = (slot.trail ??= new Array<number>(effect.lengthTicks * 2).fill(0));
      ring[(tick % effect.lengthTicks) * 2] = player.x;
      ring[(tick % effect.lengthTicks) * 2 + 1] = player.y;
      slot.phase = Math.min(slot.phase + 1, effect.lengthTicks);
    }
  }
  keepFans(state, player);
  if (tick % STEP_TICKS !== 0) {
    return;
  }
  const bar = Math.floor(tick / TICKS_PER_BAR);
  const step = (tick % TICKS_PER_BAR) / STEP_TICKS;
  for (const slot of player.weapons) {
    const effect = effectOf(slot.id);
    const rhythm =
      effect.kind in SIXTEENTHS ? SIXTEENTHS[effect.kind as keyof typeof SIXTEENTHS] : undefined;
    if (
      rhythm !== undefined &&
      bar % rhythm.everyBars === 0 &&
      (rhythm.steps as readonly number[]).includes(step)
    ) {
      fire(state, player, slot.id, effect);
    }
  }
}
