import type { ClassInfo } from './class-picker';
import type { LobbyModel, LobbySeat } from './types';

// The data holds one class until the roadie and the care are written: the harness shows all three.
export const LOBBY_CLASSES: readonly ClassInfo[] = [
  {
    id: 'mage',
    name: 'La VJ',
    role: 'Balaie la foule de loin avec ses lasers. Fragile.',
    color: '#ff2bd6',
  },
  {
    id: 'tank',
    name: 'Le roadie',
    role: 'Tient la ligne et attire les bad vibes. Lent.',
    color: '#ff9a3d',
  },
  {
    id: 'healer',
    name: 'Le care',
    role: 'Soigne, répare la scène et relève ses amis.',
    color: '#7cf2b0',
  },
];

export const LOBBY_FIXTURES = [
  'local-empty',
  'local-two',
  'local-full',
  'entry',
  'host',
  'guest',
  'error-reload',
  'error-full',
  'error-started',
  'error-connection',
] as const;

export type LobbyFixture = (typeof LOBBY_FIXTURES)[number];

export const ROOM_CODE = 'K7M2QX';

export function roomLink(origin: string): string {
  return `${origin}#rejoindre=${ROOM_CODE}`;
}

function seat(overrides: Partial<LobbySeat> & Pick<LobbySeat, 'playerId'>): LobbySeat {
  return {
    name: `Joueur ${String(overrides.playerId + 1)}`,
    classId: 'mage',
    device: null,
    remote: false,
    host: false,
    ...overrides,
  };
}

const LOCAL: LobbyModel = {
  mode: 'local',
  role: 'host',
  code: null,
  link: null,
  seats: [],
  canLaunch: false,
  error: null,
};

const ENTRY: LobbyModel = { ...LOCAL, mode: 'online', seats: [] };

const ERRORS: Readonly<Record<string, string>> = {
  'error-reload': 'Recharge la page',
  'error-full': 'Salon plein',
  'error-started': 'La partie a déjà commencé',
  'error-connection': 'Connexion impossible',
};

export function lobbyFixture(name: LobbyFixture, origin: string): LobbyModel {
  switch (name) {
    case 'local-empty':
      return LOCAL;
    case 'local-two':
      return {
        ...LOCAL,
        seats: [
          seat({ playerId: 0, device: 'keyboardMouse', host: true }),
          seat({ playerId: 1, device: 'gamepad:0', classId: 'tank', name: 'Camille' }),
        ],
        canLaunch: true,
      };
    case 'local-full':
      return {
        ...LOCAL,
        seats: [
          seat({ playerId: 0, device: 'keyboardMouse', host: true, name: 'Constantin' }),
          seat({ playerId: 1, device: 'gamepad:0', classId: 'tank', name: 'Camille' }),
          seat({ playerId: 2, device: 'gamepad:1', classId: 'healer', name: 'Léo' }),
          seat({ playerId: 3, device: 'gamepad:2', classId: 'mage' }),
        ],
        canLaunch: true,
      };
    case 'host':
      return {
        mode: 'online',
        role: 'host',
        code: ROOM_CODE,
        link: roomLink(origin),
        seats: [
          seat({ playerId: 0, device: 'keyboardMouse', host: true, name: 'Constantin' }),
          seat({ playerId: 1, remote: true, classId: 'tank', name: 'Camille' }),
          seat({ playerId: 2, remote: true, classId: 'healer', name: 'Léo' }),
        ],
        canLaunch: true,
        error: null,
      };
    case 'guest':
      return {
        mode: 'online',
        role: 'guest',
        code: ROOM_CODE,
        link: roomLink(origin),
        seats: [
          seat({ playerId: 0, remote: true, host: true, name: 'Constantin' }),
          seat({ playerId: 1, device: 'keyboardMouse', classId: 'tank', name: 'Camille' }),
          seat({ playerId: 2, remote: true, classId: 'healer', name: 'Léo' }),
        ],
        canLaunch: false,
        error: null,
      };
    case 'entry':
      return ENTRY;
    default:
      return { ...ENTRY, error: ERRORS[name] ?? null };
  }
}
