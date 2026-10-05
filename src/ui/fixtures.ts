import { CLASSES } from '../data/classes';
import type { GameContent, SpeakerDefinition } from '../data/types';
import type { InputSnapshot } from '../input/intents';
import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../shared/tempo';
import type { EnemyState, PlayerState, SimState, SpeakerState, TrapState } from '../sim/state';

function fixtureSpeaker(
  id: string,
  name: string,
  x: number,
  y: number,
  aura: SpeakerDefinition['aura'],
): SpeakerDefinition {
  return { id, name, description: name, x, y, radius: 90, plugBars: 2, aura };
}

export const UI_FIXTURE_CONTENT: GameContent = {
  classes: [
    {
      id: 'mage',
      name: 'La VJ',
      role: 'Dégâts de zone à distance, fragile',
      color: '#ff2bd6',
      maxHp: 100,
      speed: 4,
      radius: 14,
      pickupRadius: 60,
      attack: {
        damage: 10,
        cooldownTicks: 12,
        projectileSpeed: 12,
        projectileRadius: 5,
        rangeTicks: 40,
        pierce: 0,
        count: 1,
        spreadRadians: 0,
      },
      skill: {
        id: 'nova',
        name: 'Nova',
        description: 'Une onde de lumière repousse tout autour de toi.',
        cooldownTicks: 240,
        effect: { kind: 'nova', damage: 40, radius: 160, knockback: 30 },
      },
      ultimate: {
        id: 'laser-show',
        name: 'Laser show',
        description: 'Tous les lasers de la scène balaient le dancefloor.',
        cooldownTicks: 0,
        effect: { kind: 'laserShow', damagePerTick: 4, radius: 400, durationTicks: 96 },
      },
    },
    ...CLASSES.filter((definition) => definition.id !== 'mage'),
  ],
  enemies: [
    {
      id: 'desagreable',
      name: 'Le Désagréable',
      behaviour: 'rusher',
      maxHp: 20,
      speed: 3,
      radius: 10,
      damage: 4,
      attackCooldownTicks: 24,
      aggroRadius: 120,
      vibesDrop: 1,
      wattsDrop: 0,
      scalingPerPhrase: { hp: 0.1, speed: 0.02 },
    },
    {
      id: 'couvre-feu',
      name: 'Le Couvre-feu',
      behaviour: 'boss',
      maxHp: 2000,
      speed: 1,
      radius: 48,
      damage: 30,
      attackCooldownTicks: 48,
      aggroRadius: 200,
      vibesDrop: 50,
      wattsDrop: 40,
      scalingPerPhrase: { hp: 0, speed: 0 },
    },
    {
      id: 'batterie-a-plat',
      name: 'La Batterie à plat',
      behaviour: 'boss',
      maxHp: 3000,
      speed: 1,
      radius: 52,
      damage: 35,
      attackCooldownTicks: 48,
      aggroRadius: 200,
      vibesDrop: 80,
      wattsDrop: 60,
      scalingPerPhrase: { hp: 0, speed: 0 },
    },
  ],
  traps: [
    {
      id: 'caisson-de-basse',
      name: 'Caisson de basse',
      description: 'Une onde de choc sur chaque kick.',
      cost: 30,
      radius: 120,
      hp: 100,
      cadence: 'beat',
      effect: { kind: 'shockwave', damage: 12, radius: 120, knockback: 20 },
      maxLevel: 3,
      levelMul: 1.5,
    },
    {
      id: 'laser',
      name: 'Laser',
      description: 'Une ligne de lumière qui brûle les bad vibes.',
      cost: 50,
      radius: 20,
      hp: 80,
      cadence: 'continuous',
      effect: { kind: 'beam', damagePerTick: 1, length: 320, width: 8 },
      maxLevel: 3,
      levelMul: 1.5,
    },
  ],
  weapons: [
    {
      id: 'baton-de-feu',
      name: 'Bâton de feu',
      description: 'Un arc de feu à chaque temps.',
      classAffinity: 'mage',
      rhythm: { everyBars: 1, steps: [0, 4, 8, 12] },
      effect: { kind: 'sweep', damage: 6, radius: 90, arcDegrees: 120 },
      maxLevel: 5,
      levelMul: 1.3,
    },
    {
      id: 'diabolo',
      name: 'Diabolo',
      description: 'Lancé sur le un, il retombe une demi-mesure plus loin.',
      classAffinity: 'mage',
      rhythm: { everyBars: 1, steps: [0] },
      effect: { kind: 'lob', damage: 14, radius: 70, range: 300, flightTicks: 12 },
      maxLevel: 5,
      levelMul: 1.3,
    },
    {
      id: 'eventails-de-feu',
      name: 'Éventails de feu',
      description: 'Tournent autour de toi en continu.',
      classAffinity: 'tank',
      rhythm: 'continuous',
      effect: { kind: 'orbit', damage: 1, count: 2, radius: 14, orbitRadius: 60, turnsPerBar: 1 },
      maxLevel: 5,
      levelMul: 1.3,
    },
    {
      id: 'pluie-de-diabolos',
      name: 'Pluie de diabolos',
      description: 'Trois diabolos sur le un, qui retombent en éventail.',
      classAffinity: 'mage',
      evolvedFrom: 'diabolo',
      rhythm: { everyBars: 1, steps: [0, 6, 12] },
      effect: { kind: 'lob', damage: 14, radius: 70, range: 300, flightTicks: 12 },
      maxLevel: 5,
      levelMul: 1.3,
    },
  ],
  fusions: [{ weaponId: 'diabolo', upgradeId: 'nova-elargie', resultId: 'pluie-de-diabolos' }],
  upgrades: [
    {
      id: 'baskets-de-feu-rare',
      name: 'Baskets de feu rare',
      description: 'Rare : tu traverses la foule bien plus vite.',
      family: 'generic',
      rarity: 'rare',
      modifiers: [{ stat: 'speedMul', mul: 1.25 }],
      maxStacks: 1,
    },
    {
      id: 'relique-casque',
      name: 'Casque de Berlin',
      description: 'Tu encaisses plus, et tes pièges frappent plus fort.',
      family: 'relic',
      modifiers: [{ stat: 'trapDamageMul', mul: 1.2 }],
      maxStacks: 1,
    },
    {
      id: 'relique-sifflet',
      name: 'Sifflet de rave',
      description: 'Tes tirs vont plus vite et traversent une bad vibe de plus.',
      family: 'relic',
      modifiers: [{ stat: 'pierceAdd', add: 1 }],
      maxStacks: 1,
    },
    {
      id: 'relique-bracelet',
      name: 'Bracelet fluo',
      description: 'Ta nova frappe bien plus fort, toutes les mesures.',
      family: 'relic',
      modifiers: [{ stat: 'skillPowerMul', mul: 1.5 }],
      maxStacks: 1,
    },
    {
      id: 'relique-bob',
      name: 'Bob du festival',
      description: 'Tu traverses la foule plus vite, sans jamais t’arrêter.',
      family: 'relic',
      modifiers: [{ stat: 'speedMul', mul: 1.2 }],
      maxStacks: 1,
    },
    {
      id: 'nova-elargie',
      name: 'Nova XXL',
      description: 'Ta nova couvre tout le dancefloor autour de toi.',
      family: 'class',
      classId: 'mage',
      modifiers: [{ stat: 'skillPowerMul', mul: 1.25 }],
      maxStacks: 3,
    },
    {
      id: 'baskets-de-feu',
      name: 'Baskets de feu',
      description: 'Tu traverses la foule plus vite.',
      family: 'generic',
      modifiers: [{ stat: 'speedMul', mul: 1.1 }],
      maxStacks: 5,
    },
    {
      id: 'caissons-gonfles',
      name: 'Caissons gonflés',
      description: 'Tes pièges frappent plus fort sur chaque temps.',
      family: 'defense',
      modifiers: [{ stat: 'trapDamageMul', mul: 1.2 }],
      maxStacks: 3,
    },
  ],
  sets: [
    {
      id: 'soiree-fixture',
      name: 'Soirée fixture',
      bpm: 145,
      arena: { width: 1600, height: 1000 },
      core: { radius: 60, maxHp: 1000, wattsPerBar: 5 },
      startingWatts: 60,
      maxTraps: 6,
      speakers: [
        fixtureSpeaker('dome-chill', 'Le Dôme chill', 800, 80, {
          kind: 'mist',
          slowFactor: 1,
          healPerBar: 4,
          radius: 120,
        }),
        fixtureSpeaker('foret', 'La Forêt', 1520, 500, {
          kind: 'mist',
          slowFactor: 0.6,
          healPerBar: 0,
          radius: 120,
        }),
        fixtureSpeaker('sub', 'Le Sub', 800, 920, {
          kind: 'shockwave',
          damage: 6,
          radius: 120,
          knockback: 10,
        }),
        fixtureSpeaker('cercle-acid', 'Le Cercle acid', 80, 500, {
          kind: 'lure',
          radius: 120,
          markedDamageMul: 1.5,
        }),
      ],
      levelCurve: { baseVibes: 10, vibesPerLevel: 5 },
      pickups: { lifetimeTicks: 8 * TICKS_PER_BAR, speed: 12 },
      tiers: [
        {
          buildupPhrases: 4,
          breakBars: 4,
          bossId: 'couvre-feu',
          spawns: [{ enemyId: 'desagreable', everyBars: 1, count: 3, fromPhrase: 0 }],
        },
        {
          buildupPhrases: 4,
          breakBars: 4,
          bossId: 'batterie-a-plat',
          spawns: [{ enemyId: 'desagreable', everyBars: 1, count: 6, fromPhrase: 0 }],
        },
      ],
    },
  ],
};

export function fixturePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 0,
    classId: 'mage',
    x: 760,
    y: 500,
    prevX: 760,
    prevY: 500,
    radius: 14,
    hp: 82,
    maxHp: 100,
    speed: 4,
    aim: { x: 1, y: 0 },
    level: 4,
    vibes: 34,
    vibesToNextLevel: 60,
    attackCooldown: 0,
    skillCooldown: 90,
    ultimateReady: false,
    upgrades: ['baskets-de-feu', 'nova-elargie'],
    modifiers: {},
    downed: false,
    ...overrides,
  };
}

function fixtureEnemies(count: number): EnemyState[] {
  return Array.from({ length: count }, (_, index) => ({
    id: 100 + index,
    kind: 'desagreable',
    x: (index * 97) % 1600,
    y: (index * 61) % 1000,
    prevX: (index * 97) % 1600,
    prevY: (index * 61) % 1000,
    radius: 10,
    hp: 20,
    maxHp: 20,
    speed: 3,
    damage: 4,
    target: 'core',
    attackCooldown: 0,
    slowFactor: 1,
    stunTicks: 0,
    marked: false,
    isBoss: false,
  }));
}

function fixtureTrap(id: number, kind: string): TrapState {
  return {
    id,
    kind,
    ownerId: 0,
    level: 1,
    direction: { x: 1, y: 0 },
    hp: 100,
    cooldown: 0,
    x: 700,
    y: 420,
    prevX: 700,
    prevY: 420,
  };
}

export function fixtureState(overrides: Partial<SimState> = {}): SimState {
  const tick = 2 * TICKS_PER_PHRASE + 5 * TICKS_PER_BAR + 20;
  return {
    seed: 42,
    setId: 'soiree-fixture',
    tick,
    status: 'running',
    rng: { a: 1, b: 2, c: 3, d: 4 },
    arena: { width: 1600, height: 1000 },
    set: { tier: 0, segment: 'buildup', phrase: 2, bar: 37, beat: 149, segmentStartTick: 0 },
    core: { x: 800, y: 500, radius: 60, hp: 640, maxHp: 1000, watts: 85 },
    players: [fixturePlayer()],
    enemies: fixtureEnemies(124),
    projectiles: [],
    traps: [fixtureTrap(1, 'caisson-de-basse'), fixtureTrap(2, 'laser')],
    pickups: [],
    pendingUpgrades: [],
    nextEntityId: 300,
    stats: { kills: 312, phrasesHeld: 2, damageDealt: 8450, vibesCollected: 180, wattsSpent: 80 },
    events: [],
    ...overrides,
  };
}

export type UiFixtureScreen =
  | 'title'
  | 'game'
  | 'upgrade'
  | 'won'
  | 'lost'
  | 'volume'
  | 'relics'
  | 'fusion'
  | 'team'
  | 'offers'
  | 'teamWon'
  | 'teamLost';

export const UI_FIXTURE_SCREENS: readonly UiFixtureScreen[] = [
  'title',
  'game',
  'upgrade',
  'won',
  'lost',
  'volume',
  'relics',
  'fusion',
  'team',
  'offers',
  'teamWon',
  'teamLost',
];

function fixtureSpeakerState(
  definition: SpeakerDefinition,
  plugged: boolean,
  plugTicks: number,
): SpeakerState {
  const { id, x, y, radius } = definition;
  return { id, x, y, radius, plugTicks, plugged };
}

// Volume 2 in the night of the second tier (or at the end of the drop, in daylight): two speakers plugged, a third filling with the player
// standing in it, and two circus weapons held.
function volumeState(late: boolean): SimState {
  const definitions = UI_FIXTURE_CONTENT.sets[0]?.speakers ?? [];
  const sub = definitions[2];
  const segmentStartTick = 20_000;
  return fixtureState({
    tick: segmentStartTick + (late ? 4 * TICKS_PER_BAR : 1.5 * TICKS_PER_PHRASE),
    set: {
      tier: 1,
      segment: late ? 'drop' : 'buildup',
      phrase: 1,
      bar: 70,
      beat: 280,
      segmentStartTick,
    },
    volume: 2,
    speakers: definitions.map((definition, index) =>
      fixtureSpeakerState(definition, index < 2, index === 2 ? 2 * TICKS_PER_BAR * 0.6 : 0),
    ),
    players: [
      fixturePlayer({
        x: sub?.x ?? 0,
        y: sub?.y ?? 0,
        level: 7,
        weapons: [
          { id: 'baton-de-feu', level: 3, phase: 0 },
          { id: 'diabolo', level: 1, phase: 0 },
        ],
      }),
    ],
  });
}

// Four players around the same stage, in the night of the second tier (or at the end of its drop,
// in daylight): two mages and two others, one of them down.
export const TEAM_NAMES: readonly string[] = ['Léa', 'Tom', 'Inès', 'Sam'];

function teamPlayers(): PlayerState[] {
  return [
    fixturePlayer({
      id: 0,
      name: 'Léa',
      x: 700,
      y: 480,
      level: 6,
      vibes: 22,
      vibesToNextLevel: 70,
      weapons: [
        { id: 'baton-de-feu', level: 3, phase: 0 },
        { id: 'diabolo', level: 1, phase: 0 },
      ],
    }),
    fixturePlayer({
      id: 1,
      name: 'Tom',
      classId: 'tank',
      x: 860,
      y: 520,
      hp: 140,
      maxHp: 200,
      level: 5,
      vibes: 51,
      vibesToNextLevel: 65,
      skillCooldown: 0,
      ultimateReady: true,
      weapons: [{ id: 'eventails-de-feu', level: 2, phase: 0 }],
    }),
    fixturePlayer({
      id: 2,
      name: 'Inès',
      classId: 'healer',
      x: 780,
      y: 600,
      hp: 18,
      maxHp: 100,
      level: 5,
      vibes: 10,
      vibesToNextLevel: 65,
      skillCooldown: 200,
    }),
    fixturePlayer({
      id: 3,
      name: 'Sam',
      x: 640,
      y: 560,
      hp: 0,
      downed: true,
      level: 4,
    }),
  ];
}

function teamState(late: boolean, overrides: Partial<SimState> = {}): SimState {
  const segmentStartTick = 20_000;
  return fixtureState({
    tick: segmentStartTick + (late ? 4 * TICKS_PER_BAR : 1.5 * TICKS_PER_PHRASE),
    set: {
      tier: 1,
      segment: late ? 'drop' : 'buildup',
      phrase: 1,
      bar: 70,
      beat: 280,
      segmentStartTick,
    },
    players: teamPlayers(),
    ...overrides,
  });
}

export function fixtureForScreen(screen: UiFixtureScreen, late = false): SimState {
  switch (screen) {
    case 'team':
      return teamState(late);
    case 'offers': {
      const players = teamPlayers();
      players[0] = { ...(players[0] ?? fixturePlayer()), vibes: 0 };
      return teamState(late, {
        status: 'choosingUpgrade',
        players,
        pendingUpgrades: [
          { playerId: 0, options: ['nova-elargie', 'baskets-de-feu-rare', 'baton-de-feu'] },
          { playerId: 1, options: ['caissons-gonfles', 'baskets-de-feu', 'eventails-de-feu'] },
          { playerId: 2, options: ['baskets-de-feu', 'caissons-gonfles', 'diabolo'] },
        ],
      });
    }
    case 'teamWon':
      return {
        ...fixtureForScreen('won'),
        players: teamPlayers().map((player) => ({ ...player, downed: player.id === 3 })),
      };
    case 'teamLost':
      return {
        ...fixtureForScreen('lost'),
        players: teamPlayers().map((player) => ({ ...player, downed: player.id !== 1 })),
      };
    case 'title':
    case 'game':
      return fixtureState();
    case 'volume':
      return volumeState(late);
    case 'upgrade':
      return fixtureState({
        status: 'choosingUpgrade',
        players: [fixturePlayer({ level: 5, vibes: 0, vibesToNextLevel: 65 })],
        pendingUpgrades: [
          { playerId: 0, options: ['nova-elargie', 'baskets-de-feu-rare', 'baton-de-feu'] },
        ],
      });
    case 'fusion':
      return fixtureState({
        status: 'choosingUpgrade',
        players: [
          fixturePlayer({
            level: 8,
            vibes: 0,
            vibesToNextLevel: 80,
            weapons: [{ id: 'diabolo', level: 2, phase: 0 }],
          }),
        ],
        pendingUpgrades: [
          { playerId: 0, options: ['pluie-de-diabolos', 'diabolo', 'eventails-de-feu'] },
        ],
      });
    case 'relics':
      return fixtureState({
        status: 'choosingUpgrade',
        pendingUpgrades: [
          {
            playerId: 0,
            kind: 'relic',
            options: ['relique-casque', 'relique-sifflet', 'relique-bracelet', 'relique-bob'],
          },
        ],
      });
    case 'won':
      return fixtureState({
        status: 'won',
        tick: 9 * TICKS_PER_PHRASE + 13 * TICKS_PER_BAR + 7,
        set: { tier: 2, segment: 'drop', phrase: 9, bar: 157, beat: 630, segmentStartTick: 7344 },
        core: { x: 800, y: 500, radius: 60, hp: 410, maxHp: 1000, watts: 140 },
        enemies: [],
        stats: {
          kills: 1873,
          phrasesHeld: 8,
          damageDealt: 61200,
          vibesCollected: 1210,
          wattsSpent: 540,
        },
      });
    case 'lost':
      return fixtureState({
        status: 'lost',
        tick: 6 * TICKS_PER_PHRASE + 3 * TICKS_PER_BAR + 30,
        set: { tier: 1, segment: 'buildup', phrase: 6, bar: 99, beat: 398, segmentStartTick: 3888 },
        core: { x: 800, y: 500, radius: 60, hp: 0, maxHp: 1000, watts: 20 },
        stats: {
          kills: 1042,
          phrasesHeld: 6,
          damageDealt: 30500,
          vibesCollected: 700,
          wattsSpent: 320,
        },
      });
  }
}

export function idleSnapshot(overrides: Partial<InputSnapshot> = {}): InputSnapshot {
  return {
    device: 'keyboardMouse',
    gameplay: {
      move: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      fire: false,
      skill: false,
      ultimate: false,
      placeTrap: false,
      nextTrap: false,
      previousTrap: false,
      selectTrap: null,
      pause: false,
    },
    menu: { up: false, down: false, left: false, right: false, confirm: false, back: false },
    pointerScreen: null,
    aimFromPointer: false,
    ...overrides,
  };
}
