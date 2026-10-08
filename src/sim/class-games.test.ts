import { describe, expect, it } from 'vitest';
import { distanceSquared } from '../shared/vec';
import { CONTENT } from '../data/content';
import type { GameContent } from '../data/types';
import { commandFor } from './fixtures';
import { createSimulation } from './index';
import { spawnEnemy } from './systems/spawning';
import type { SimEvent, SimState } from './state';

// The short set of `?dev=fast` (src/app/dev.ts), played by a bot that walks at the nearest bad vibe,
// fires, uses its skill whenever it can, and takes the first card of every offer.
const FAST_CONTENT: GameContent = {
  ...CONTENT,
  enemies: CONTENT.enemies.map((enemy) => ({
    ...enemy,
    maxHp: enemy.maxHp * (enemy.behaviour === 'boss' ? 0.05 : 0.5),
  })),
  sets: CONTENT.sets.map((set) => ({
    ...set,
    core: { ...set.core, maxHp: set.core.maxHp * 4 },
    tiers: set.tiers.map((tier) => ({ ...tier, buildupPhrases: 1, breakBars: 1 })),
  })),
};

const MAX_TICKS = 60_000;

function nearestEnemy(state: SimState): { x: number; y: number } | undefined {
  const player = state.players[0];
  if (player === undefined) {
    return undefined;
  }
  let best: { x: number; y: number } | undefined;
  let bestDistance = Infinity;
  for (const enemy of state.enemies) {
    const distance = Math.sqrt(distanceSquared(enemy, player));
    if (enemy.hp > 0 && distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
}

interface Game {
  state: SimState;
  events: SimEvent[];
}

const played = new Map<string, Game>();

function play(classId: string): Game {
  const cached = played.get(classId);
  if (cached !== undefined) {
    return cached;
  }
  const simulation = createSimulation({
    seed: 1,
    setId: 'soiree-v0',
    content: FAST_CONTENT,
    players: [{ id: 0, classId }],
  });
  const { state } = simulation;
  const events: SimEvent[] = [];
  for (
    let tick = 0;
    tick < MAX_TICKS && state.status !== 'won' && state.status !== 'lost';
    tick++
  ) {
    const player = state.players[0];
    const target = nearestEnemy(state);
    if (player === undefined) {
      throw new Error('expected one player');
    }
    const offer = state.pendingUpgrades.find((pending) => pending.playerId === 0);
    const toward =
      target === undefined ? { x: 0, y: 0 } : { x: target.x - player.x, y: target.y - player.y };
    const length = Math.sqrt(toward.x * toward.x + toward.y * toward.y);
    const aim = { x: toward.x / (length || 1), y: toward.y / (length || 1) };
    const command = commandFor(0, {
      move: length > 120 ? aim : { x: 0, y: 0 },
      aim,
      fire: target !== undefined,
      skill: target !== undefined,
    });
    const upgradeId = offer?.options[0];
    simulation.step([
      upgradeId === undefined
        ? command
        : { ...command, actions: [{ type: 'chooseUpgrade', upgradeId }] },
    ]);
    events.push(...state.events);
  }
  const game = { state, events };
  played.set(classId, game);
  return game;
}

describe.each(['mage', 'tank', 'healer'])('a short set played to the end with %s', (classId) => {
  const { state, events } = play(classId);
  const count = (type: SimEvent['type']) => events.filter((event) => event.type === type).length;

  it('ends in a win or a loss', () => {
    expect(['won', 'lost']).toContain(state.status);
  });

  it('uses its skill', () => {
    expect(count('skillUsed')).toBeGreaterThan(0);
  });

  it('kills bad vibes', () => {
    expect(state.stats.kills).toBeGreaterThan(0);
  });
});

describe('the roadie and the care in a short set', () => {
  it('draw bad vibes with the charge', () => {
    const { events } = play('tank');

    expect(events.some((event) => event.type === 'taunted' && event.count > 0)).toBe(true);
  });

  it('heal with the pulse', () => {
    const { events } = play('healer');

    expect(events.some((event) => event.type === 'coreRepaired')).toBe(true);
  });
});

describe('the roadie charge', () => {
  function crowdedGame() {
    const desagreable = CONTENT.enemies.find((enemy) => enemy.id === 'desagreable');
    if (desagreable === undefined) {
      throw new Error('missing content');
    }
    const simulation = createSimulation({
      seed: 1,
      setId: 'soiree-v0',
      content: CONTENT,
      players: [{ id: 0, classId: 'tank' }],
    });
    const { state } = simulation;
    const player = state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    const crowd = [142, 145, 148].map((gap) =>
      spawnEnemy(state, desagreable, player.x, player.y + 160 + gap, false),
    );
    return { simulation, player, crowd };
  }

  it('bring the nearby bad vibes onto the roadie', () => {
    const { simulation, player, crowd } = crowdedGame();

    simulation.step([commandFor(0, { skill: true, aim: { x: 0, y: 1 } })]);

    expect(crowd.map((enemy) => enemy.target)).toEqual([player.id, player.id, player.id]);
  });
});
