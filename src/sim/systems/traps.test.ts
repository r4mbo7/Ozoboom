import { describe, expect, it } from 'vitest';
import { distanceSquared } from '../../shared/vec';
import type { PlayerAction, PlayerCommand, PlayerInput } from '../commands';
import {
  EFFECTS_OPTIONS,
  type TimedEvent,
  actionsFor,
  commandFor,
  placeEnemy,
  stepAndRecord,
} from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { EnemyState, PlayerState, SimState, Vec2 } from '../state';

function game(setId = 'fixture-set'): {
  simulation: Simulation;
  state: SimState;
  player: PlayerState;
} {
  const simulation = createSimulation({ ...EFFECTS_OPTIONS, setId });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  player.hand = EFFECTS_OPTIONS.content.traps.flatMap(({ id }) =>
    Array.from({ length: 8 }, () => id),
  );
  return { simulation, state: simulation.state, player };
}

const placeAction = (
  trapId: string,
  x: number,
  y: number,
  facing: Vec2 = { x: 1, y: 0 },
): PlayerAction => ({ type: 'placeTrap', trapId, x, y, dx: facing.x, dy: facing.y });

const place = (
  trapId: string,
  x: number,
  y: number,
  facing?: Vec2,
  input: Partial<PlayerInput> = {},
) =>
  ({
    ...commandFor(0, input),
    actions: [placeAction(trapId, x, y, facing)],
  }) satisfies PlayerCommand;

function frozen(enemy: EnemyState): EnemyState {
  enemy.stunTicks = 100_000;
  return enemy;
}

function firedTicks(recorded: readonly TimedEvent[]): number[] {
  return recorded.filter(({ event }) => event.type === 'trapFired').map(({ tick }) => tick);
}

describe('trap placement', () => {
  it('places a trap from the hand and announces it', () => {
    const { simulation, state, player } = game();
    player.hand = ['mister', 'subwoofer'];

    simulation.step([place('subwoofer', 400, 450)]);

    expect(state.traps).toEqual([
      {
        id: 1,
        kind: 'subwoofer',
        ownerId: 0,
        x: 400,
        y: 450,
        prevX: 400,
        prevY: 450,
        direction: { x: 1, y: 0 },
        hp: 100,
        cooldown: 0,
      },
    ]);
    expect(player.hand).toEqual(['mister']);
    expect(state.events).toContainEqual({
      type: 'trapPlaced',
      id: 1,
      kind: 'subwoofer',
      x: 400,
      y: 450,
    });
  });

  it('faces the trap along the direction of the placement, normalized', () => {
    const { simulation, state } = game();

    simulation.step([place('beam', 400, 450, { x: 0, y: -2 }, { aim: { x: 1, y: 0 } })]);

    expect(state.traps[0]?.direction).toEqual({ x: 0, y: -1 });
  });

  it('faces the trap along the aim of the player for a placement without direction', () => {
    const { simulation, state } = game();

    simulation.step([place('beam', 400, 450, { x: 0, y: 0 }, { aim: { x: -3, y: 0 } })]);

    expect(state.traps[0]?.direction).toEqual({ x: -1, y: 0 });
  });

  it.each<[string, (state: SimState, player: PlayerState) => PlayerAction]>([
    [
      'the player does not hold',
      (_, player) => {
        player.hand = ['mister'];
        return placeAction('subwoofer', 400, 450);
      },
    ],
    ['outside the arena', () => placeAction('subwoofer', 23, 450)],
    ['across the bottom edge', () => placeAction('subwoofer', 400, 900 - 23)],
    ['on the core', () => placeAction('subwoofer', 800 - 48 - 24 + 1, 450)],
    ['for an unknown trap', () => placeAction('flamethrower', 400, 450)],
    [
      'by a downed player',
      (_, player) => {
        player.downed = true;
        return placeAction('subwoofer', 400, 450);
      },
    ],
  ])('refuses a trap %s', (_, prepare) => {
    const { simulation, state, player } = game();
    const action = prepare(state, player);
    const hand = [...(player.hand ?? [])];

    simulation.step([actionsFor(0, action)]);

    expect(state.traps).toEqual([]);
    expect(player.hand).toEqual(hand);
    expect(state.events.filter((event) => event.type === 'trapPlaced')).toEqual([]);
  });

  it('accepts a trap that just touches the arena edge, the core or another trap', () => {
    const { simulation, state } = game();

    simulation.step([
      actionsFor(
        0,
        placeAction('subwoofer', 24, 450),
        placeAction('subwoofer', 800 - 48 - 24, 450),
        placeAction('mister', 800 - 48 - 24 - 24 - 16, 450),
      ),
    ]);

    expect(state.traps.map((trap) => trap.kind)).toEqual(['subwoofer', 'subwoofer', 'mister']);
  });

  it('refuses a trap that overlaps another one', () => {
    const { simulation, state } = game();

    simulation.step([
      actionsFor(0, placeAction('subwoofer', 400, 450), placeAction('mister', 400 + 39, 450)),
    ]);

    expect(state.traps.map((trap) => trap.kind)).toEqual(['subwoofer']);
  });

  it('refuses a new trap once the set limit is reached', () => {
    const { simulation, state } = game();
    const placements = Array.from({ length: 7 }, (_, i) =>
      placeAction('mister', 100 + i * 50, 100),
    );

    simulation.step([actionsFor(0, ...placements)]);

    expect(state.traps).toHaveLength(6);
  });

  it('places one more trap for each trap slot the player gained', () => {
    const { simulation, state, player } = game();
    player.modifiers.trapSlotsAdd = 1;
    const placements = Array.from({ length: 8 }, (_, i) =>
      placeAction('mister', 100 + i * 50, 100),
    );

    simulation.step([actionsFor(0, ...placements)]);

    expect(state.traps).toHaveLength(7);
  });

  it('ignores a trap placed on a trap of the same kind', () => {
    const { simulation, state, player } = game();
    simulation.step([place('subwoofer', 400, 450)]);
    const before = structuredClone({ traps: state.traps, hand: player.hand });

    simulation.step([place('subwoofer', 405, 445)]);

    expect({ traps: state.traps, hand: player.hand }).toEqual(before);
    expect(state.events.filter((event) => event.type === 'trapPlaced')).toEqual([]);
  });

  it('refuses a trap placed on a trap of another kind', () => {
    const { simulation, state } = game();

    simulation.step([
      actionsFor(0, placeAction('subwoofer', 400, 450), placeAction('mister', 400, 450)),
    ]);

    expect(state.traps.map((trap) => trap.kind)).toEqual(['subwoofer']);
  });
});

describe('trap cadence', () => {
  it('fires a beat trap on every beat tick', () => {
    const { simulation } = game();
    simulation.step([place('subwoofer', 400, 450)]);

    const recorded = stepAndRecord(simulation, 99);

    expect(firedTicks(recorded)).toEqual([12, 24, 36, 48, 60, 72, 84, 96]);
  });

  it('fires a bar trap on every bar tick', () => {
    const { simulation } = game();
    simulation.step([place('metronome', 400, 450)]);

    const recorded = stepAndRecord(simulation, 149);

    expect(firedTicks(recorded)).toEqual([48, 96, 144]);
  });

  it('fires a continuous trap on every tick from the tick it is placed', () => {
    const { simulation, state } = game();

    simulation.step([place('beam', 400, 450)]);
    const onPlacement = [...state.events];
    const recorded = stepAndRecord(simulation, 4);

    expect(onPlacement.filter((event) => event.type === 'trapFired')).toHaveLength(1);
    expect(firedTicks(recorded)).toEqual([2, 3, 4, 5]);
  });

  it('fires a drop trap only on the tick the drop starts', () => {
    const { simulation } = game('fast-drop');
    simulation.step([place('strobe', 400, 450)]);

    const recorded = stepAndRecord(simulation, 150);

    const dropTicks = recorded
      .filter(({ event }) => event.type === 'segment' && event.segment === 'drop')
      .map(({ tick }) => tick);
    expect(dropTicks).toEqual([96]);
    expect(firedTicks(recorded)).toEqual([96]);
  });
});

describe('trap effects', () => {
  it('shockwave: hurts and pushes back the enemies in its radius on its beat', () => {
    const { simulation, state } = game();
    simulation.step([place('subwoofer', 400, 450)]);
    const near = frozen(placeEnemy(state, 'grump', 450, 450));
    const far = frozen(placeEnemy(state, 'grump', 400, 450 + 90 + 12 + 1));

    stepAndRecord(simulation, 10);
    const beforeBeat = near.hp;
    simulation.step([]);

    expect(beforeBeat).toBe(20);
    expect({ hp: near.hp, x: near.x, y: near.y }).toEqual({ hp: 12, x: 462, y: 450 });
    expect({ hp: far.hp, x: far.x, y: far.y }).toEqual({ hp: 20, x: 400, y: 553 });
    expect(state.events).toContainEqual({
      type: 'enemyHit',
      id: near.id,
      damage: 8,
      x: 450,
      y: 450,
    });
    expect(state.stats.damageDealt).toBe(8);
  });

  it('shockwave: scales with the owner damage and radius multipliers', () => {
    const { simulation, state, player } = game();
    simulation.step([place('subwoofer', 400, 450)]);
    player.modifiers.trapDamageMul = 1.25;
    player.modifiers.trapRadiusMul = 2;
    const reachedOnlyWithBiggerRadius = frozen(placeEnemy(state, 'grump', 400, 450 + 150));

    stepAndRecord(simulation, 11);

    expect(reachedOnlyWithBiggerRadius.hp).toBe(20 - 8 * 1.25);
  });

  it('beam: hurts every tick the enemies in the rectangle it draws along its direction', () => {
    const { simulation, state } = game();
    const inBeam = frozen(placeEnemy(state, 'grump', 405, 450 + 150));
    const atTheTip = frozen(placeEnemy(state, 'grump', 400, 450 + 200 + 12));
    const aside = frozen(placeEnemy(state, 'grump', 400 + 10 + 12 + 1, 500));
    const behind = frozen(placeEnemy(state, 'grump', 400, 450 - 12 - 1));
    const pastTheTip = frozen(placeEnemy(state, 'grump', 400, 450 + 200 + 12 + 1));

    simulation.step([place('beam', 400, 450, { x: 0, y: 1 })]);
    stepAndRecord(simulation, 2);

    expect([inBeam, atTheTip, aside, behind, pastTheTip].map((enemy) => enemy.hp)).toEqual([
      17, 17, 20, 20, 20,
    ]);
  });

  it('mist: slows the enemies inside it and heals the players inside it on every bar', () => {
    const { simulation, state, player } = game();
    player.hp = 50;
    const inside = frozen(placeEnemy(state, 'grump', 650, 500));
    const outside = frozen(placeEnemy(state, 'grump', 650, 450 + 80 + 12 + 1));

    simulation.step([place('mister', 650, 450)]);
    const slowed = [inside.slowFactor, outside.slowFactor];
    stepAndRecord(simulation, 46);
    const beforeBar = player.hp;
    simulation.step([]);
    const onBar = player.hp;
    inside.x = 1400;
    simulation.step([]);

    expect(slowed).toEqual([0.5, 1]);
    expect([beforeBar, onBar]).toEqual([50, 60]);
    expect(inside.slowFactor).toBe(1);
  });

  it('mist: heals no more than the max hp and never a downed player', () => {
    const simulation = createSimulation({
      ...EFFECTS_OPTIONS,
      players: [
        { id: 0, classId: 'raver' },
        { id: 1, classId: 'raver' },
      ],
    });
    const [first, second] = simulation.state.players;
    if (first === undefined || second === undefined) {
      throw new Error('expected two players');
    }
    first.hand = ['mister'];
    first.hp = 95;
    second.hp = 0;
    second.downed = true;
    second.x = first.x + 30;
    second.y = first.y;

    simulation.step([place('mister', first.x - 40, first.y)]);
    stepAndRecord(simulation, 47);

    expect([first.hp, second.hp]).toEqual([100, 0]);
  });

  it('lure: marks the enemies in its radius and draws them to it', () => {
    const { simulation, state } = game();
    const drawn = placeEnemy(state, 'grump', 500, 450);
    const almostThere = placeEnemy(state, 'grump', 400 + 16 + 12 + 1, 450);
    const outside = placeEnemy(state, 'grump', 400, 450 + 150 + 12 + 1);

    simulation.step([place('lure', 400, 450)]);

    expect({ x: drawn.x, y: drawn.y, marked: drawn.marked }).toEqual({
      x: 497.5,
      y: 450,
      marked: true,
    });
    expect(almostThere.x).toBe(400 + 16 + 12);
    expect(outside.marked).toBe(false);
  });

  it('lure: marked enemies take the bonus damage of the lure from the other traps', () => {
    const { simulation, state } = game();
    const marked = frozen(placeEnemy(state, 'grump', 450, 500));
    const unmarked = frozen(placeEnemy(state, 'grump', 330, 420));
    simulation.step([
      actionsFor(0, placeAction('subwoofer', 400, 450), placeAction('lure', 400, 600)),
    ]);

    stepAndRecord(simulation, 11);

    expect([marked.marked, unmarked.marked]).toEqual([true, false]);
    expect([marked.hp, unmarked.hp]).toEqual([20 - 16, 20 - 8]);
  });

  it('strobe: stuns the enemies in its radius on the drop', () => {
    const { simulation, state } = game('fast-drop');
    simulation.step([place('strobe', 400, 450)]);
    stepAndRecord(simulation, 93);
    const inside = placeEnemy(state, 'grump', 450, 450);
    const outside = placeEnemy(state, 'grump', 400, 450 + 120 + 12 + 1);
    inside.speed = 0;
    outside.speed = 0;

    simulation.step([]);
    simulation.step([]);
    const onDrop = [inside.stunTicks, outside.stunTicks];
    simulation.step([]);

    expect(state.tick).toBe(97);
    expect(onDrop).toEqual([24, 0]);
    expect(inside.stunTicks).toBe(23);
  });
});

describe('bosses against traps', () => {
  it('a boss keeps closing in on the core through a subwoofer and a lure', () => {
    const { simulation, state, player } = game();
    player.x = 100;
    player.y = 100;
    const boss = placeEnemy(state, 'curfew', 1400, 450);
    boss.hp = 100_000;
    simulation.step([
      actionsFor(0, placeAction('subwoofer', 1250, 450), placeAction('lure', 1050, 600)),
    ]);

    const distances: number[] = [];
    for (let i = 0; i < 400; i++) {
      simulation.step([]);
      distances.push(distanceSquared(boss, state.core));
    }

    const stalls = distances.filter((distance, i) => i > 0 && distance >= (distances[i - 1] ?? 0));
    expect(stalls).toEqual([]);
  });
});

describe('heavy enemies against traps', () => {
  function bouncerAgainstMister(stunned = false): {
    simulation: Simulation;
    state: SimState;
    recorded: TimedEvent[];
  } {
    const { simulation, state } = game();
    const bouncer = placeEnemy(state, 'bouncer', 400 + 16 + 20 - 1, 450);
    bouncer.speed = 0;
    if (stunned) {
      frozen(bouncer);
    }
    simulation.step([place('mister', 400, 450)]);
    const recorded = stepAndRecord(simulation, 108);
    return { simulation, state, recorded };
  }

  it('a heavy in contact hits the trap for its damage at its attack rate until it breaks', () => {
    const { recorded, state } = bouncerAgainstMister();

    expect(recorded.filter(({ event }) => event.type === 'trapDestroyed')).toEqual([
      { tick: 109, event: { type: 'trapDestroyed', id: 2, kind: 'mister', x: 400, y: 450 } },
    ]);
    expect(state.traps).toEqual([]);
  });

  it('a heavy hits once on contact and again after its attack cooldown', () => {
    const { simulation, state } = game();
    const bouncer = placeEnemy(state, 'bouncer', 400 + 16 + 20 - 1, 450);
    bouncer.speed = 0;

    simulation.step([place('mister', 400, 450)]);
    const afterContact = state.traps[0]?.hp;
    stepAndRecord(simulation, 35);
    const beforeSecondBlow = state.traps[0]?.hp;
    simulation.step([]);

    expect([afterContact, beforeSecondBlow, state.traps[0]?.hp]).toEqual([35, 35, 20]);
  });

  it('a stunned heavy does not hit the trap', () => {
    const { state } = bouncerAgainstMister(true);

    expect(state.traps[0]?.hp).toBe(50);
  });

  it('a boss hits the trap, a rusher does not', () => {
    const { simulation, state } = game();
    const boss = placeEnemy(state, 'curfew', 400 + 16 + 40 - 1, 450);
    boss.speed = 0;
    const rusher = placeEnemy(state, 'grump', 1000, 200 + 16 + 12 - 1);
    rusher.speed = 0;

    simulation.step([
      actionsFor(0, placeAction('mister', 400, 450), placeAction('mister', 1000, 200)),
    ]);

    expect(state.traps.map((trap) => trap.hp)).toEqual([20, 50]);
  });
});
