import type { ClassDefinition, SkillEffect } from '../data/types';
import { MAIN_TEMPO } from '../shared/tempo';
import type { PlayerState, SimEvent, SimState } from '../sim/state';

const SKILL_EVERY = 2 * MAIN_TEMPO.ticksPerBar;
const AIM = { x: 0.6, y: 0.8 };

export function standing(definition: Pick<ClassDefinition, 'id' | 'radius'>): PlayerState {
  return {
    id: 0,
    classId: definition.id,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    radius: definition.radius,
    hp: 1,
    maxHp: 1,
    speed: 0,
    aim: { ...AIM },
    level: 1,
    vibes: 0,
    vibesToNextLevel: 1,
    attackCooldown: 0,
    skillCooldown: 0,
    upgrades: [],
    modifiers: {},
    downed: false,
  };
}

export function emptyState(player: PlayerState, size: number): SimState {
  return {
    seed: 0,
    setId: '',
    tick: 0,
    status: 'running',
    rng: { a: 0, b: 0, c: 0, d: 0 },
    arena: { width: size, height: size },
    set: { tier: 0, segment: 'buildup', phrase: 0, bar: 0, beat: 0, segmentStartTick: 0 },
    core: { x: 0, y: 0, radius: 0, hp: 1, maxHp: 1 },
    players: [player],
    enemies: [],
    projectiles: [],
    traps: [],
    pickups: [],
    pendingUpgrades: [],
    nextEntityId: 1,
    stats: { kills: 0, phrasesHeld: 0, damageDealt: 0, vibesCollected: 0 },
    events: [],
  };
}

export function portraitEvents(tick: number, player: PlayerState, effect: SkillEffect): SimEvent[] {
  const events: SimEvent[] = [];
  const { ticksPerBeat, ticksPerBar } = MAIN_TEMPO;
  if (tick % ticksPerBeat === 0) {
    events.push(
      { type: 'beat', beat: tick / ticksPerBeat },
      {
        type: 'playerFired',
        playerId: player.id,
        x: player.x,
        y: player.y,
        angle: Math.atan2(player.aim.y, player.aim.x),
      },
    );
  }
  if (tick % SKILL_EVERY === ticksPerBar) {
    events.push({ type: 'skillUsed', playerId: player.id });
    if (effect.kind === 'dash') {
      player.invulnerableTicks = effect.invulnerableTicks;
    } else if (effect.kind === 'healPulse') {
      events.push({ type: 'playerHealed', playerId: player.id, amount: effect.amount });
    }
  }
  return events;
}

export function portraitPixels(
  clientWidth: number,
  clientHeight: number,
  devicePixelRatio: number,
  maxPixels: number,
): { width: number; height: number } {
  const ratio = Math.min(
    devicePixelRatio,
    2,
    maxPixels / Math.max(1, clientWidth),
    maxPixels / Math.max(1, clientHeight),
  );
  return { width: Math.round(clientWidth * ratio), height: Math.round(clientHeight * ratio) };
}
