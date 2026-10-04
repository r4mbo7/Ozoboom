import type { SimEvent, SimState } from '../sim/state';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import {
  type FixtureEvent,
  PARTY_OFFSET,
  PLAYER_ORBIT,
  TAU,
  breedOf,
  fire,
  nextRandom,
  spawnEnemy,
  spawnPickup,
} from './fixture';
import { advanceWeapons } from './fixture-weapon-fire';

function killRandomEnemy(state: SimState, events: SimEvent[]): void {
  const index = Math.floor(nextRandom(state.rng) * state.enemies.length);
  const enemy = state.enemies[index];
  if (enemy === undefined || enemy.isBoss) {
    return;
  }
  events.push({
    type: 'enemyDied',
    id: enemy.id,
    kind: enemy.kind,
    x: enemy.x,
    y: enemy.y,
    byPlayer: 0,
  });
  state.enemies[index] = spawnEnemy(state, breedOf(enemy.kind), false);
}

export function advanceFixture(state: SimState, queued: readonly FixtureEvent[]): void {
  const events: SimEvent[] = [];
  state.events = events;
  state.tick += 1;
  const { tick, core } = state;

  for (const entity of [
    ...state.players,
    ...state.enemies,
    ...state.projectiles,
    ...state.pickups,
  ]) {
    entity.prevX = entity.x;
    entity.prevY = entity.y;
  }
  for (const trap of state.traps) {
    trap.prevX = trap.x;
    trap.prevY = trap.y;
  }

  const beat = tick % TICKS_PER_BEAT === 0;
  if (beat || queued.includes('beat')) {
    events.push({ type: 'beat', beat: Math.floor(tick / TICKS_PER_BEAT) });
  }
  if (beat) {
    for (const trap of state.traps) {
      if (trap.kind === 'caisson-de-basse') {
        events.push({ type: 'trapFired', id: trap.id, kind: trap.kind, x: trap.x, y: trap.y });
      }
    }
  }
  if (queued.includes('coreHit')) {
    events.push({ type: 'coreHit', damage: 5 });
  }
  if (queued.includes('speakerPlugged')) {
    for (const speaker of state.speakers ?? []) {
      if (speaker.plugged) {
        events.push({ type: 'speakerPlugged', speakerId: speaker.id });
      }
    }
  }
  if (queued.includes('enemyDied') || tick % 7 === 0) {
    killRandomEnemy(state, events);
  }

  const player = state.players[0];
  if (player !== undefined && !player.downed) {
    const orbit = (tick / (TICKS_PER_BAR * 8)) * TAU;
    const wobble = PLAYER_ORBIT + Math.sin(tick / 23) * 60;
    player.x = core.x + Math.cos(orbit) * wobble;
    player.y = core.y + Math.sin(orbit) * wobble * 0.8;
    const aimAngle = orbit + Math.sin(tick / 17) * 0.9;
    player.aim = { x: Math.cos(aimAngle), y: Math.sin(aimAngle) };
  }
  for (const mate of state.players.slice(1)) {
    if (player !== undefined && !mate.downed) {
      const side = mate.id === 1 ? -1 : 1;
      mate.x = player.x;
      mate.y = player.y + PARTY_OFFSET * side;
      mate.aim = player.aim;
    }
  }

  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (enemy === undefined) {
      continue;
    }
    const breed = breedOf(enemy.kind);
    const dx = core.x - enemy.x;
    const dy = core.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    if (distance < core.radius + enemy.radius) {
      state.enemies[index] = spawnEnemy(state, breed, false);
      continue;
    }
    const sway = Math.sin(tick / 9 + enemy.id) * 0.45;
    const forward = distance > breed.holdAt ? enemy.speed : 0;
    const side = breed.holdAt > 0 ? enemy.speed * 0.5 : enemy.speed * sway;
    enemy.x += (dx / distance) * forward - (dy / distance) * side;
    enemy.y += (dy / distance) * forward + (dx / distance) * side;
  }

  for (const projectile of state.projectiles) {
    if (projectile.owner.kind === 'weapon') {
      continue;
    }
    projectile.ticksLeft -= 1;
    if (projectile.ticksLeft <= 0) {
      fire(state, projectile);
      continue;
    }
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
  }

  for (let index = 0; index < state.pickups.length; index += 1) {
    const pickup = state.pickups[index];
    if (pickup === undefined) {
      continue;
    }
    pickup.ticksLeft -= 1;
    if (pickup.ticksLeft <= 0) {
      state.pickups[index] = spawnPickup(state);
    }
  }

  for (const trap of state.traps) {
    if (trap.kind === 'laser') {
      const turned = Math.atan2(trap.direction.y, trap.direction.x) + 0.012;
      trap.direction = { x: Math.cos(turned), y: Math.sin(turned) };
    }
  }

  advanceWeapons(state);

  state.set.beat = Math.floor(tick / TICKS_PER_BEAT);
  state.set.bar = Math.floor(tick / TICKS_PER_BAR);
}
